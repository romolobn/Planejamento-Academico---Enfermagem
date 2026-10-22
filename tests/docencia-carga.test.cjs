// Execute com: node --test tests/docencia-carga.test.cjs
// Usa as funções e os eventos reais do HTML, sem dependências externas.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function app(){
  const elements=new Map(),storage=new Map(),alerts=[];
  const context=vm.createContext({console,Date,Math,alert:m=>alerts.push(m),
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id)},querySelectorAll:()=>[]}});
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script,context);
  const run=code=>vm.runInContext(code,context);
  run("render=()=>{}; db.active=['ENFM09','ENFT09','ENFM01']; startNew('ENFM09','9211'); wire()");
  return {run,alerts,change:(id,value)=>elements.get(id).onchange({target:{value}})};
}
for(const load of [7,0])test(`preserva ${load} ao mudar supervisão, horário e reabrir registro`,()=>{
  const a=app();a.change('docweekly',String(load));a.change('manualN','2');
  assert.equal(a.run('partValue(0).weeklyAssigned'),load);
  assert.equal(a.run('partValue(0).n'),2);
  assert.equal(a.run('partValue(0).blocks.length'),2);
  a.change('day','Terça');a.change('start','08:00');a.change('room','A | 202');
  a.run("go('data'); go('lesson')");
  assert.equal(a.run('partValue(0).weeklyAssigned'),load);
  a.run('completeDraft()');assert.equal(a.run('db.records.length'),1);
  a.run('editRecord(db.records[0].id)');a.change('manualN','1');
  assert.equal(a.run('partValue(0).weeklyAssigned'),load);
  assert.equal(a.run('partValue(0).teacher'), 'staff-84002');
});
test('carga nova começa vazia e não é derivada dos tempos de supervisão',()=>{
  const a=app();assert.equal(a.run('partValue(0).weeklyAssigned'),'');
  a.change('manualN','2');assert.equal(a.run('partValue(0).weeklyAssigned'),'');
  a.run('draft.parts=[toStored(toPart(0),0)]; completeDraft()');
  assert.equal(a.run('db.records.length'),0);assert.ok(a.alerts.length);
});
for(const invalid of ['', '-1','1.5'])test(`rejeita ${JSON.stringify(invalid)} sem restaurar carga anterior`,()=>{
  const a=app();a.change('docweekly','7');a.change('docweekly',invalid);a.change('manualN','2');
  assert.equal(a.run('partValue(0).weeklyAssigned'),invalid);
  a.run('completeDraft()');assert.equal(a.run('db.records.length'),0);
  a.run('saveDraft()');assert.equal(a.run('db.records.length'),0);assert.ok(a.alerts.length>=3);
});
test('cargas de profissionais em registros distintos permanecem independentes',()=>{
  const a=app();a.change('docweekly','7');a.run('completeDraft()');
  a.run("professor='staff-78027'; startNew('ENFT09','9211')");a.change('docweekly','0');a.change('manualN','2');a.run('completeDraft()');
  assert.equal(a.run('db.records.length'),2);
  a.run('editRecord(db.records[0].id)');a.change('manualN','3');a.run('completeDraft()');
  assert.equal(a.run("regular('staff-84002')"),7);assert.equal(a.run("regular('staff-78027')"),0);
  assert.equal(a.run('db.records[0].parts[0].n'),3);assert.equal(a.run('db.records[1].parts[0].n'),2);
});
test('disciplina comum mantém cálculo pela matriz e divisão de grupos',()=>{
  const a=app();a.run("startNew('ENFM01','8914')");
  assert.equal(a.run('required(draft)[0].n'),2);assert.equal(a.run('partValue(0).weeklyAssigned'),null);
  a.change('groups','2');assert.equal(a.run('required(draft).length'),3);
  assert.equal(a.run('required(draft).every(p=>p.n===2)'),true);
});
