// node --test tests/*.test.cjs
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function app(){
 const nodes=new Map(),storage=new Map(),alerts=[];
 const ctx=vm.createContext({console,Date,Math,alert:m=>alerts.push(m),
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},querySelectorAll:()=>[]}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 return {run:s=>vm.runInContext(s,ctx),alerts,nodes,storage};
}
for(const code of ['ENFT09','ENFM09'])test('somente '+code+' ofertada sincroniza estado e criação de rascunho',()=>{
 const a=app();a.run(`db.active=['${code}'];stageCohort='ENFN10';stageSubject='8164';go('stage')`);
 assert.equal(a.run('stageCohort'),code);assert.equal(a.run('stageSubject'),'9211');
 a.run('stageNew()');assert.equal(a.run('sgDraft.cohort'),code);assert.equal(a.run('sgDraft.subjectCode'),'9211');
 assert.equal(a.run('db.stages.length'),0);assert.equal(a.run('db.active.length'),1);
});
test('várias ofertas preservam seleção válida da turma e da disciplina',()=>{
 const a=app();a.run("db.active=['ENFM09','ENFT09','ENFN10'];stageCohort='ENFT09';stageSubject='8156';stageSelection();stageSelection()");
 assert.equal(a.run('stageCohort'),'ENFT09');assert.equal(a.run('stageSubject'),'8156');
});
test('seleção inválida usa a mesma ordem previsível do seletor, sem reordenar oferta',()=>{
 const a=app();a.run("db.active=['ENFN10','ENFT09','ENFM09'];stageCohort='inexistente';stageSelection()");
 assert.equal(a.run('stageCohort'),'ENFM09');
 assert.equal(a.run('JSON.stringify(db.active)'), '["ENFN10","ENFT09","ENFM09"]');
 a.run("db.active=['ENFN10','ENFT09'];stageSelection()");assert.equal(a.run('stageCohort'),'ENFT09');
});
for(const active of [[],['ENFM01']])test('sem oferta de estágio '+JSON.stringify(active)+' não ativa turma nem cria grupo',()=>{
 const a=app();a.run(`db.active=${JSON.stringify(active)};go('stage')`);
 assert.equal(a.run('stageCohort'),'');assert.equal(a.run('stageSubject'),'');
 assert.match(a.nodes.get('app').innerHTML,/<button id="stageadd" disabled/);
 const before=a.run('JSON.stringify(db)');a.run('stageNew()');assert.equal(a.run('sgDraft'),null);
 assert.equal(a.run('JSON.stringify(db)'),before);assert.ok(a.alerts.length);
});
test('troca para outro período sincroniza disciplina com a turma escolhida',()=>{
 const a=app();a.run("db.active=['ENFN10'];stageCohort='ENFT09';stageSubject='8955';stageSelection()");
 assert.equal(a.run('stageCohort'),'ENFN10');assert.equal(a.run('stageSubject'),'8162');
 assert.equal(a.run('stageSelection().available.every(m=>m[2]===\'10\')'),true);
});
test('sincronização não modifica registros, cargas, histórico, rascunho aberto ou armazenamento',()=>{
 const a=app();a.run(`
 db.active=['ENFM09'];db.records=[{id:'docencia',parts:[]}];
 db.stages=[{id:'grupo',cohort:'ENFT09',subjectCode:'8955',location:'HGNI',students:12,people:[{id:'doc2',weeklyAssigned:0,schedule:[{day:'Terça',start:'08:00',end:'12:00'}]}]}];
 db.extras=[{teacher:'doc3',n:3}];db.versions=[{when:'preservar'}];db.events=[{action:'preservar'}];
 sgDraft=JSON.parse(JSON.stringify(db.stages[0]));stageCohort='ENFT09';stageSubject='8955';persist();
 `);
 const before=a.run('JSON.stringify([db,sgDraft])'),stored=[...a.storage.values()];
 a.run('stageSelection();stageSelection()');assert.equal(a.run('stageCohort'),'ENFM09');
 assert.equal(a.run('JSON.stringify([db,sgDraft])'),before);assert.deepEqual([...a.storage.values()],stored);
});
