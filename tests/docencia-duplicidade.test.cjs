// Execute todas as regressões: node --test tests/*.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function app(saved){
  const elements=new Map(),storage=new Map(),alerts=[];
  if(saved)storage.set('planejamento-enfermagem-g32047-v22',JSON.stringify(saved));
  const context=vm.createContext({console,Date,Math,alert:m=>alerts.push(m),
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id)},querySelectorAll:()=>[]}});
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  const run=code=>vm.runInContext(code,context);
  const initialHTML=elements.get('app').innerHTML;
  run("render=()=>{};db.active=['ENFM05','ENFT05'];wire()");
  return {run,alerts,storage,initialHTML,change:(id,value)=>elements.get(id).onchange({target:{value}})};
}
function create(a,cohort='ENFM05',subject='8938'){
  a.run(`startNew('${cohort}','${subject}');saveDraft()`);
}
test('cria planejamento principal e bloqueia nova inclusão idêntica sem alterar dados',()=>{
  const a=app();create(a);assert.equal(a.run('db.records.length'),1);
  const before=a.run('JSON.stringify(db.records)'),stored=[...a.storage.values()];
  create(a);assert.equal(a.run('JSON.stringify(db.records)'),before);
  assert.deepEqual([...a.storage.values()],stored);assert.match(a.alerts.at(-1),/outro planejamento principal/);
});
test('permite editar o próprio registro mantendo a chave',()=>{
  const a=app();create(a);a.run("editRecord(db.records[0].id);draft.manualN=2;saveDraft()");
  assert.equal(a.run('db.records.length'),1);assert.equal(a.run('db.records[0].manualN'),2);
  assert.equal(a.alerts.length,0);
});
test('bloqueia edição de disciplina que colide com outro principal',()=>{
  const a=app();create(a);create(a,'ENFM05','8934');
  const before=a.run('JSON.stringify(db.records)'),stored=[...a.storage.values()];
  a.run('editRecord(db.records[0].id)');a.change('subject','8934');a.run('saveDraft()');
  assert.equal(a.run('JSON.stringify(db.records)'),before);assert.deepEqual([...a.storage.values()],stored);
  assert.match(a.alerts.at(-1),/outro planejamento principal/);
});
test('bloqueia edição de turma que colide com outro principal',()=>{
  // O evento de turma escolhe a primeira disciplina não estágio do período (8938).
  const a=app();create(a);create(a,'ENFT05');const before=a.run('JSON.stringify(db.records)');
  a.run('editRecord(db.records[0].id)');a.change('cohort','ENFT05');a.run('saveDraft()');
  assert.equal(a.run('JSON.stringify(db.records)'),before);assert.match(a.alerts.at(-1),/outro planejamento principal/);
});
test('permite a mesma disciplina em turmas distintas e mudança para chave livre',()=>{
  const a=app();create(a);create(a,'ENFT05');assert.equal(a.run('db.records.length'),2);
  a.run('editRecord(db.records[0].id)');a.change('subject','8934');a.run('saveDraft()');
  assert.equal(a.run('db.records[0].subjectCode'),'8934');assert.equal(a.alerts.length,0);
});
test('três professores, teoria e dois grupos pertencem ao mesmo planejamento',()=>{
  const a=app();a.run("startNew('ENFM05','8938')");a.change('groups','2');
  a.run("draft.parts=chooseParts().map((s,i)=>toStored({...partValue(i),teacher:P[i+2][0],day:days[i],start:'07:10',room:rooms[i]},i));completeDraft()");
  assert.equal(a.alerts.length,0);assert.equal(a.run('db.records.length'),1);
  assert.equal(a.run('db.records[0].parts.length'),3);
  assert.equal(a.run('new Set(db.records[0].parts.map(p=>p.teacher)).size'),3);
  a.run("editRecord(db.records[0].id);draft.parts[1].room=rooms[4];completeDraft()");
  assert.equal(a.run('db.records.length'),1);assert.equal(a.run('db.records[0].parts[1].room'),'A | 302');
});
test('sinaliza duplicados persistidos ao abrir sem modificar localStorage ou registros',()=>{
  const a=app();create(a);const base=JSON.parse(a.run('JSON.stringify(db)'));
  base.records.push({...structuredClone(base.records[0]),id:'outro-id'});
  const b=app(base);assert.match(b.initialHTML,/Planejamentos principais duplicados/);
  assert.match(b.initialHTML,/ENFM05\|8938/);
  assert.equal(b.run('db.records.length'),2);
  assert.equal(b.storage.get('planejamento-enfermagem-g32047-v22'),JSON.stringify(base));
  assert.equal(b.run('duplicateRecordKeys().length'),1);
  b.run('editRecord(db.records[0].id);saveDraft()');assert.equal(b.run('db.records.length'),2);
  assert.match(b.alerts.at(-1),/outro planejamento principal/);
});
test('grupos do mesmo principal não são sinalizados como duplicados',()=>{
  const a=app();a.run("startNew('ENFM05','8938');draft.groups=2;draft.parts=chooseParts().map((s,i)=>toStored(partValue(i),i));saveDraft()");
  assert.equal(a.run('duplicateRecordKeys().length'),0);
});
