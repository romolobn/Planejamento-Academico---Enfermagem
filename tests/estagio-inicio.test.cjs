// node --test tests/*.test.cjs
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function app(edit=false){
 const nodes=new Map(),storage=new Map(),alerts=[];let focused;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{focus:()=>{focused=id}});return nodes.get(id)};
 const ctx=vm.createContext({console,Date,Math,alert:m=>alerts.push(m),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:node,querySelectorAll:()=>[]}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 const run=s=>vm.runInContext(s,ctx);
 run(`db.active=['ENFM09'];stageNew();sgDraft.students='12';sgDraft.location='HGNI';sgDraft.people=[
 {id:'doc2',weeklyAssigned:'0',schedule:[{day:'Segunda',start:'07:00',end:'13:00'},{day:'Sexta',start:'09:00',end:'15:00'}]},
 {id:'doc3',weeklyAssigned:'7',schedule:[{day:'Segunda',start:'07:00',end:'13:00'}]}];
 db.stages=[{...JSON.parse(JSON.stringify(sgDraft)),id:'outro',label:'Grupo B'}];
 db.extras=[{id:'extra',teacher:'doc3',type:'NDE',n:3}];
 `);
 if(edit)run("db.stages.unshift(JSON.parse(JSON.stringify(sgDraft)));sgDraft=JSON.parse(JSON.stringify(db.stages[0]));sgDraft.saved=true");
 run('persist()');
 const draft=JSON.parse(run('JSON.stringify(sgDraft)'));
 node('sglocation').value=draft.location;node('sgstudents').value=draft.students;
 draft.people.forEach((p,i)=>{node('sgperson-'+i).value=p.id;node('sgweekly-'+i).value=p.weeklyAssigned;p.schedule.forEach((s,j)=>{node(`sgday-${i}-${j}`).value=s.day;node(`sgstart-${i}-${j}`).value=s.start;node(`sgend-${i}-${j}`).value=s.end})});
 return {run,nodes,storage,alerts,focused:()=>focused};
}
for(const [i,j] of [[0,0],[0,1],[1,0]])test(`início vazio em profissional ${i+1}, horário ${j+1} bloqueia com mensagem e foco corretos`,()=>{
 const a=app();const before=a.run('JSON.stringify(db)'),stored=[...a.storage.values()];
 a.nodes.get(`sgstart-${i}-${j}`).value='';a.run('stageSave(false)');
 assert.equal(a.run(`sgDraft.people[${i}].schedule[${j}].start`),'');
 assert.match(a.alerts.at(-1),new RegExp(`horário inicial.*profissional ${i+1}, horário ${j+1} do Grupo A`));
 assert.equal(a.focused(),`sgstart-${i}-${j}`);assert.equal(a.run('JSON.stringify(db)'),before);assert.deepEqual([...a.storage.values()],stored);
});
test('limpar horário de grupo existente não restaura valor nem sobrescreve registro',()=>{
 const a=app(true),before=a.run('JSON.stringify(db)'),stored=[...a.storage.values()];
 a.nodes.get('sgstart-0-0').value='08:15';a.run('stageReadForm()');a.nodes.get('sgstart-0-0').value='';
 a.run('stageSave(false);stageReadForm();render()');
 assert.equal(a.run('sgDraft.people[0].schedule[0].start'),'');assert.equal(a.run('db.stages[0].people[0].schedule[0].start'),'07:00');
 assert.equal(a.run('JSON.stringify(db)'),before);assert.deepEqual([...a.storage.values()],stored);
});
test('falha de validação preserva outros campos e os demais profissionais e grupos',()=>{
 const a=app(true),other=a.run('JSON.stringify(db.stages[1])');
 a.nodes.get('sglocation').value='CAPS III';a.nodes.get('sgstudents').value='22';a.nodes.get('sgweekly-1').value='9';
 a.nodes.get('sgday-0-0').value='Quarta';a.nodes.get('sgend-0-0').value='16:30';a.nodes.get('sgstart-0-0').value='';a.run('stageSave(false)');
 assert.equal(a.run('sgDraft.location'),'CAPS III');assert.equal(a.run('sgDraft.students'),'22');assert.equal(a.run('sgDraft.people[1].weeklyAssigned'),'9');
 assert.equal(a.run('sgDraft.people[0].schedule[0].day'),'Quarta');assert.equal(a.run('sgDraft.people[0].schedule[0].end'),'16:30');
 assert.equal(a.run('sgDraft.people[0].schedule[1].start'),'09:00');assert.equal(a.run('JSON.stringify(db.stages[1])'),other);
});
test('salvar e adicionar outro também bloqueia vazio sem abrir novo rascunho',()=>{
 const a=app(),id=a.run('sgDraft.id'),before=a.run('JSON.stringify(db)');a.nodes.get('sgstart-1-0').value='';a.run('stageSave(true)');
 assert.equal(a.run('sgDraft.id'),id);assert.equal(a.run('screen'),'stageform');assert.equal(a.run('JSON.stringify(db)'),before);
});
test('horários flexíveis e sobrepostos são aceitos, mantendo os outros grupos',()=>{
 const a=app(true),other=a.run('JSON.stringify(db.stages[1])');
 a.nodes.get('sgstart-0-0').value='05:15';a.nodes.get('sgend-0-0').value='11:45';a.run('stageSave(false)');
 assert.equal(a.alerts.length,0);assert.equal(a.run('screen'),'stage');assert.equal(a.run('db.stages.length'),2);
 assert.equal(a.run('db.stages[0].people[0].schedule[0].start'),'05:15');assert.equal(a.run('db.stages[0].people[0].weeklyAssigned'),'0');
 assert.equal(a.run('db.stages[0].people[1].weeklyAssigned'),'7');assert.equal(a.run('JSON.stringify(db.stages[1])'),other);
});
test('preencher início após erro permite salvar sem alterar a carga dos demais',()=>{
 const a=app();a.nodes.get('sgstart-0-0').value='';a.run('stageSave(false)');a.nodes.get('sgstart-0-0').value='07:30';a.run('stageSave(false)');
 assert.equal(a.run('db.stages.length'),2);assert.equal(a.run('db.stages[1].people[0].schedule[0].start'),'07:30');assert.equal(a.run('db.stages[1].people[1].weeklyAssigned'),'7');
});
