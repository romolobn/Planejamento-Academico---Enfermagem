// node --test tests/*.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function app(saved){
 const nodes=new Map(),store=new Map(),alerts=[];
 if(saved)store.set('planejamento-enfermagem-g32047-v22',saved);
 const context=vm.createContext({console,Date,Math,alert:m=>alerts.push(m),
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},querySelectorAll:()=>[]}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],context);
 const run=s=>vm.runInContext(s,context);
 run("render=()=>{};db.active=['ENFM09'];wire()");
 return {run,alerts,store,change:(id,value)=>nodes.get(id).onchange({target:{value}})};
}
function three(){
 const a=app();a.run("startNew('ENFM09','9211')");
 a.change('docweekly','7');a.change('day','Segunda');a.run('addDocTeacher()');
 a.change('docweekly','0');a.change('day','Terça');a.run('addDocTeacher()');
 a.change('docweekly','3');a.change('day','Quarta');return a;
}
test('três professores com 7, 0 e 3 em um único principal e totais de sala separados do campo',()=>{
 const a=three();a.run('completeDraft()');assert.equal(a.alerts.length,0);
 assert.equal(a.run('db.records.length'),1);assert.equal(a.run('db.records[0].parts.length'),3);
 assert.equal(a.run('new Set(db.records[0].parts.map(p=>p.key)).size'),3);
 for(const [id,n] of [['staff-84002',7],['staff-78027',0],['staff-67011',3]]){
  assert.equal(a.run(`regular('${id}')`),n);assert.equal(a.run(`salaryRows('${id}')[0].weeklyT`),n);assert.equal(a.run(`stageLoad('${id}')`),0);
 }
 assert.equal(a.run('db.stages.length'),0);
});
test('editar professor intermediário não muda cargas ou ordem dos outros; remoção preserva demais',()=>{
 const a=three();a.run('step=1');a.change('docweekly','5');
 assert.equal(a.run('JSON.stringify(draft.parts.map(p=>p.weeklyAssigned))'),'[7,5,3]');
 a.run('removeDocTeacher()');assert.equal(a.run('JSON.stringify(draft.parts.map(p=>p.weeklyAssigned))'),'[7,3]');
 a.run('completeDraft()');assert.equal(a.run('db.records[0].parts.length'),2);
});
test('voltar/avançar, alterar supervisões, horários e salas preserva atribuições',()=>{
 const a=three();a.run('step=1');a.change('start','08:00');a.change('room','A | 202');
 a.change('manualN','2');a.run("go('data');go('lesson')");
 assert.equal(a.run('JSON.stringify(draft.parts.map(p=>p.weeklyAssigned))'),'[7,0,3]');
 assert.equal(a.run('draft.parts.every(p=>p.n===2&&p.blocks.length===2)'),true);
 a.run('completeDraft()');assert.equal(a.run('db.records.length'),1);
});
test('persistência e reabertura mantêm chaves, profissionais, cargas e horários',()=>{
 const a=three();a.run('completeDraft()');const stored=a.store.get('planejamento-enfermagem-g32047-v22');
 const b=app(stored);assert.equal(b.run('JSON.stringify(db.records)'),a.run('JSON.stringify(db.records)'));
 b.run('editRecord(db.records[0].id)');assert.equal(b.run('chooseParts().length'),3);
 b.run('step=1');b.change('docweekly','4');b.run('completeDraft()');
 assert.equal(b.run('JSON.stringify(db.records[0].parts.map(p=>p.weeklyAssigned))'),'[7,4,3]');
});
for(const value of ['', '-1','1.5'])test(`carga inválida ${JSON.stringify(value)} em apenas um professor impede salvar`,()=>{
 const a=three();a.run('step=1');a.change('docweekly',value);a.run('completeDraft();saveDraft()');
 assert.equal(a.run('db.records.length'),0);assert.equal(a.run('draft.parts[0].weeklyAssigned'),7);
 assert.equal(a.run('draft.parts[2].weeklyAssigned'),3);assert.ok(a.alerts.length);
});
test('conflitos entre supervisões impedem conclusão; correção de dia permite salvar',()=>{
 const a=three();a.run('step=1');a.change('day','Segunda');a.run('completeDraft()');
 assert.equal(a.run('db.records.length'),0);assert.match(a.alerts.at(-1),/Turma ENFM09/);
 a.change('day','Terça');a.run('completeDraft()');assert.equal(a.run('db.records.length'),1);
 // Conflitos continuam comparando professor/sala/turma contra outros principais.
 a.run("startNew('ENFM09','8955');updatePart(0,'weeklyAssigned',2);updatePart(0,'day','Segunda');draft.parts=[toStored(toPart(0),0)];completeDraft()");
 assert.equal(a.run('db.records.length'),1);assert.match(a.alerts.at(-1),/Professor|Sala|Turma/);
});
test('impede duas atribuições do mesmo professor no principal sem alterar as demais',()=>{
 const a=three();a.run('step=1');a.change('docprof','staff-84002');a.run('saveDraft()');
 assert.equal(a.run('db.records.length'),0);assert.match(a.alerts.at(-1),/única atribuição/);
 assert.equal(a.run('draft.parts[2].weeklyAssigned'),3);
});
test('registro legado de uma supervisão mantém dados e aceita adição sem migração destrutiva',()=>{
 const a=app();a.run("startNew('ENFM09','9211');updatePart(0,'weeklyAssigned',7);completeDraft()");
 const before=a.run('JSON.stringify(db.records[0].parts[0])');const b=app(a.store.get('planejamento-enfermagem-g32047-v22'));
 b.run('editRecord(db.records[0].id);addDocTeacher()');
 assert.equal(b.run('JSON.stringify(draft.parts[0])'),before);
 assert.equal(b.run('draft.parts[1].weeklyAssigned'),'');
});
test('alterações de docência não escrevem nem recarregam cargas de Campo',()=>{
 const a=three();a.run("db.stages=[{id:'campo',cohort:'ENFM09',subjectCode:'9211',people:[{id:'staff-84002',weeklyAssigned:9}]}]");
 const before=a.run('JSON.stringify(db.stages)');a.run('completeDraft()');
 assert.equal(a.run('JSON.stringify(db.stages)'),before);assert.equal(a.run("stageLoad('staff-84002')"),9);
 assert.equal(a.run("regular('staff-84002')"),7);
});
test('inclusão a partir do primeiro professor e remoção da chave legada mantêm os outros',()=>{
 const a=three();a.run('step=0;addDocTeacher()');
 assert.equal(a.run('JSON.stringify(draft.parts.slice(0,3).map(p=>p.weeklyAssigned))'),'[7,0,3]');
 a.change('docweekly','2');a.change('day','Sexta');
 a.run('step=0;removeDocTeacher()');
 assert.equal(a.run('draft.parts.some(p=>p.key===\'theory\')'),false);
 a.run('completeDraft()');assert.equal(a.run('db.records.length'),1);
 assert.equal(a.run('JSON.stringify(db.records[0].parts.map(p=>p.weeklyAssigned))'),'[0,3,2]');
});
test('status do próprio planejamento exige carga válida para todos os professores',()=>{
 const a=three();assert.equal(a.run('getStatus(draft)'),'Completa');
 a.run('step=1');a.change('docweekly','');assert.equal(a.run('getStatus(draft)'),'Parcial');
 a.change('docweekly','0');assert.equal(a.run('getStatus(draft)'),'Completa');
});
