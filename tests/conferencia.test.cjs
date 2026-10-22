// node --test tests/*.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const key='planejamento-enfermagem-g32047-v22';
function app(saved){
 const nodes=new Map(),storage=new Map(),alerts=[];
 if(saved)storage.set(key,JSON.stringify(saved));
 const ctx=vm.createContext({console,Date,Math,alert:m=>alerts.push(m),confirm:()=>true,prompt:()=> 'Correção acadêmica',
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},querySelectorAll:()=>[]}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 const run=s=>vm.runInContext(s,ctx);
 const initialHTML=nodes.get('app').innerHTML;
 // Keep the real renderer: verify the same validation in buttons and handlers.
 return {run,storage,alerts,nodes,initialHTML,click:id=>nodes.get(id).onclick(),change:(id,value)=>nodes.get(id).onchange({target:{value}})};
}
function complete(a){a.run(`
 db.active=['ENFM09'];
 allExpected().forEach((x,i)=>{
  startNew(x.cohort,x.subjectCode);
  let p={...partValue(0),weeklyAssigned:0,day:days[i],start:'07:10'};
  draft.parts=[toStored(p,0)];saveDraft();
 });
 db.stages=stageExpected().map((x,i)=>({id:'g'+i,cohort:x.cohort,subjectCode:x.subjectCode,label:'Grupo A',location:stageLocations[0],students:10,people:[{id:P[2][0],weeklyAssigned:0,schedule:[{day:'Segunda',start:'07:00',end:'13:00'}]}]}));
 go('conference');
 `);assert.equal(a.run('planningValidation().valid'),true);}
function blocked(a){
 a.run("go('conference')");assert.match(a.nodes.get('app').innerHTML,/<button id="submit" disabled/);
 a.click('submit');assert.equal(a.run('db.workflow'),'editing');
}
test('Conferência exige seis Docências e cinco Campos para ENFM09',()=>{
 const a=app();a.run("db.active=['ENFM09'];go('conference')");
 assert.equal(a.run('allExpected().length'),6);assert.equal(a.run('stageExpected().length'),5);
 assert.equal(a.run('planningValidation().entries.length'),11);
 assert.match(a.nodes.get('app').innerHTML,/data-requirement="D\|ENFM09\|9211"/);
 assert.match(a.nodes.get('app').innerHTML,/data-requirement="E\|ENFM09\|9211"/);
});
test('Campo completo e Docência ausente impede envio e aprovação',()=>{
 const a=app();complete(a);a.run("db.records=db.records.filter(r=>r.subjectCode!=='9211')");blocked(a);
 a.run("db.workflow='submitted';go('admin')");a.click('approve');assert.equal(a.run('db.workflow'),'submitted');assert.equal(a.run('db.versions.length'),0);
});
test('Docência completa e Campo ausente impede envio',()=>{
 const a=app();complete(a);a.run("db.stages=db.stages.filter(g=>g.subjectCode!=='9211')");blocked(a);
});
test('grupo parcial ou Docência incompleta impede envio',()=>{
 const a=app();complete(a);a.run("db.stages[0].people[0].weeklyAssigned=''");blocked(a);
 a.run("db.stages[0].people[0].weeklyAssigned=0;db.records[0].parts=[]");blocked(a);
});
test('ambos completos permitem enviar e aprovar; Campo sobreposto não bloqueia',()=>{
 const a=app();complete(a);assert.doesNotMatch(a.nodes.get('app').innerHTML,/<button id="submit" disabled/);
 a.click('submit');assert.equal(a.run('db.workflow'),'submitted');a.run("go('admin')");a.click('approve');
 assert.equal(a.run('db.workflow'),'approved');assert.equal(a.run('db.versions.length'),1);
});
test('todos os professores de Docência são validados, incluindo carga zero',()=>{
 const a=app();complete(a);
 a.run(`editRecord(db.records[0].id);addDocTeacher();updatePart(step,'weeklyAssigned',7);updatePart(step,'day','Terça');updatePart(step,'start','08:50');addDocTeacher();updatePart(step,'weeklyAssigned',3);updatePart(step,'day','Quarta');updatePart(step,'start','08:50');saveDraft()`);
 assert.equal(a.run('planningValidation().valid'),true);
 assert.equal(a.run('db.records[0].parts.length'),3);
 a.run("db.records[0].parts[1].weeklyAssigned=''");blocked(a);
});
for(const invalid of ['', ' ', -1, 1.5, null, true])test(`carga inválida ${JSON.stringify(invalid)} impede envio e aprovação`,()=>{
 const a=app();complete(a);a.run(`db.records[0].parts[0].weeklyAssigned=${JSON.stringify(invalid)}`);blocked(a);
 a.run("db.workflow='submitted';go('admin')");a.click('approve');assert.equal(a.run('db.workflow'),'submitted');
});
for(const mutate of ["p.room='inexistente'","p.day='Domingo'","p.start='23:00'","p.start=undefined","p.blocks=null","p.blocks='inválido'","p.teacher='desconhecido'","p.n=0","p.key=''","p.kind='practice'"])
 test('integridade de Docência: '+mutate,()=>{
 const a=app();complete(a);a.run(`{let p=db.records[0].parts[0];${mutate}}`);blocked(a);
 assert.equal(a.run("getStatus(db.records[0])"),'Parcial');
});
test('turmas não ofertadas não geram pendências, conflitos ou duplicidades bloqueantes',()=>{
 const a=app();complete(a);a.run("db.records.push({...JSON.parse(JSON.stringify(db.records[0])),id:'inativo1',cohort:'ENFT09'},{...JSON.parse(JSON.stringify(db.records[0])),id:'inativo2',cohort:'ENFT09'})");
 assert.equal(a.run('planningValidation().valid'),true);assert.equal(a.run('planningValidation().entries.some(x=>x.cohort===\'ENFT09\')'),false);
 a.run('db.active=[]');assert.equal(a.run('planningValidation().entries.length'),0);blocked(a);
});
test('filtros visuais não reduzem exigências globais nem liberam envio',()=>{
 const a=app();complete(a);a.run("db.records=db.records.filter(r=>r.subjectCode!=='9211');filterPeriod='1';filterShift='noite';filterStatus='Completa';go('conference')");
 assert.match(a.nodes.get('app').innerHTML,/Nenhuma exigência para os filtros/);blocked(a);
});
test('duplicado principal legado é preservado, sinalizado e bloqueia envio e aprovação',()=>{
 const a=app();complete(a);a.run("{let r=JSON.parse(JSON.stringify(db.records[0]));r.id='duplicado';r.parts[0].day='Sexta';r.parts[0].start='08:50';r.parts[0].blocks=calc('08:50',1,'manha');db.records.push(r)}");
 assert.equal(a.run('planningValidation().conflicts.length'),0);assert.equal(a.run('planningValidation().issues.length'),0);
 const before=a.run('JSON.stringify(db.records)');blocked(a);assert.match(a.nodes.get('app').innerHTML,/principais duplicados/);
 a.run("db.workflow='submitted';go('admin')");a.click('approve');assert.equal(a.run('db.workflow'),'submitted');
 assert.equal(a.run('JSON.stringify(db.records)'),before);
});
test('abrir aprovação antiga incompleta não altera estado, histórico ou armazenamento',()=>{
 const a=app();complete(a);a.run("db.records=[];db.workflow='approved';db.versions=[{when:'anterior',records:[{preservado:true}]}];db.events=[{action:'Aprovação anterior'}];persist()");
 const saved=JSON.parse(a.storage.get(key)),b=app(saved);
 assert.equal(b.storage.get(key),JSON.stringify(saved));assert.equal(b.run('db.workflow'),'approved');
 assert.equal(b.run('JSON.stringify(db.versions)'),JSON.stringify(saved.versions));
 b.run("go('admin')");b.click('reopen');assert.equal(b.run('db.workflow'),'editing');blocked(b);
 assert.equal(b.run('JSON.stringify(db.versions)'),JSON.stringify(saved.versions));
});
test('aprovação antiga enviada e incompleta exige correção; reabertura e novo envio revalidam',()=>{
 const a=app();complete(a);a.run("db.workflow='submitted';db.versions=[{when:'preservar'}];db.records[0].parts[0].weeklyAssigned='';go('admin')");
 a.click('approve');assert.equal(a.run('db.workflow'),'submitted');assert.equal(a.run('db.versions.length'),1);
 a.click('reopen');blocked(a);a.run('db.records[0].parts[0].weeklyAssigned=0');a.click('submit');
 assert.equal(a.run('db.workflow'),'submitted');a.run("go('admin')");a.click('approve');assert.equal(a.run('db.versions.length'),2);
});
test('observações de Docência e Campo guardam núcleos e não compartilham vínculo',()=>{
 const a=app();complete(a);a.run("go('admin')");
 for(const nucleus of ['D','E']){
  a.run(`$('obsSubject').value='${nucleus}|ENFM09|9211';$('obsText').value='Revisar ${nucleus}'`);a.click('addObservation');
 }
 assert.equal(a.run('db.observations.length'),2);
 assert.equal(a.run('db.observations[0].nucleus'),'D');assert.equal(a.run('db.observations[1].nucleus'),'E');
 assert.equal(a.run('db.observations.every(o=>o.cohort===\'ENFM09\'&&o.subjectCode===\'9211\')'),true);
 a.run("db.workflow='submitted';go('admin')");a.click('approve');assert.equal(a.run('db.workflow'),'submitted');
 a.run("db.observations.forEach(o=>o.status='Validada')");a.click('approve');assert.equal(a.run('db.workflow'),'approved');
 const b=app(JSON.parse(a.storage.get(key)));assert.equal(b.run('db.observations[0].nucleus'),'D');assert.equal(b.run('db.observations[1].nucleus'),'E');
});
test('observação antiga não é associada por aproximação; vínculo explícito preserva conteúdo',()=>{
 const a=app();complete(a);a.run("db.workflow='submitted';db.observations=[{id:'antiga',subject:'Docência · ENFM09 · texto antigo',text:'Preservar texto',status:'Validada'}];go('admin')");
 a.click('approve');assert.equal(a.run('db.workflow'),'submitted');assert.match(a.nodes.get('app').innerHTML,/sem vínculo estruturado/);
 a.run("linkObservation(db.observations[0],'D|ENFM09|9211')");a.click('approve');assert.equal(a.run('db.workflow'),'approved');
 assert.equal(a.run('db.observations[0].subject'),'Docência · ENFM09 · texto antigo');assert.equal(a.run('db.observations[0].text'),'Preservar texto');
});
test('cargas ausentes no armazenamento não são preenchidas na abertura ou validação',()=>{
 const a=app();complete(a);a.run('delete db.records[0].parts[0].weeklyAssigned;delete db.stages[0].people[0].weeklyAssigned;persist()');
 const data=JSON.parse(a.storage.get(key)),b=app(data);b.run('planningValidation()');
 assert.equal(b.run('db.records[0].parts[0].weeklyAssigned'),undefined);assert.equal(b.run('db.stages[0].people[0].weeklyAssigned'),undefined);
 assert.equal(b.storage.get(key),JSON.stringify(data));assert.equal(b.run('planningValidation().valid'),false);
});
test('validação não recalcula nem altera cargas ou relatórios',()=>{
 const a=app();complete(a);const before=a.run('JSON.stringify(db)');
 const sala=a.run("JSON.stringify(salaryRows(P[2][0]))"),campo=a.run('stageLoad(P[2][0])');
 a.run('planningValidation();planningValidation()');assert.equal(a.run('JSON.stringify(db)'),before);
 assert.equal(a.run('JSON.stringify(salaryRows(P[2][0]))'),sala);assert.equal(a.run('stageLoad(P[2][0])'),campo);
});
test('conflito real de Docência impede envio e aprovação pelas mesmas regras',()=>{
 const a=app();complete(a);a.run("let p=db.records[1].parts[0];p.day=db.records[0].parts[0].day;p.blocks=calc(p.start,p.n,'manha')");
 assert.ok(a.run('planningValidation().conflicts.length')>0);blocked(a);
 a.run("db.workflow='submitted';go('admin')");a.click('approve');assert.equal(a.run('db.workflow'),'submitted');
});
for(const value of ['',-1,1.5])test('carga de Campo inválida '+JSON.stringify(value)+' impede envio e aprovação',()=>{
 const a=app();complete(a);a.run(`db.stages[0].people[0].weeklyAssigned=${JSON.stringify(value)}`);blocked(a);
 a.run("db.workflow='submitted';go('admin')");a.click('approve');assert.equal(a.run('db.workflow'),'submitted');
});
for(const value of ['null','{}','[null]'])test('estrutura inválida de atribuições '+value+' é sinalizada sem interromper Conferência',()=>{
 const a=app();complete(a);a.run(`db.records[0].parts=${value}`);blocked(a);
 assert.equal(a.run('planningValidation().valid'),false);
});
test('totais da Conferência não usam cargas de referência para campos ausentes',()=>{
 const a=app();complete(a);assert.equal(a.run('planningValidation().loads.sala'),2);assert.equal(a.run('planningValidation().loads.campo'),0);
 a.run('delete db.records[0].parts[0].weeklyAssigned');a.run("go('conference')");
 assert.equal(a.run('planningValidation().loads'),null);
 assert.match(a.nodes.get('app').innerHTML,/Nenhuma carga ausente foi preenchida/);
});
