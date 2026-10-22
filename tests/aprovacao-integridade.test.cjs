// node --test tests/aprovacao-integridade.test.cjs
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const key='planejamento-enfermagem-g32047-v22';
function app(saved){
 const nodes=new Map(),storage=new Map(),alerts=[],controls={confirm:true,reason:'Revisar supervisões'};
 if(saved)storage.set(key,JSON.stringify(saved));
 const ctx=vm.createContext({console,Date,Math,alert:m=>alerts.push(m),confirm:()=>controls.confirm,prompt:()=>controls.reason,localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},querySelectorAll:()=>[]}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 const run=s=>vm.runInContext(s,ctx);return {run,storage,nodes,alerts,controls,click:id=>nodes.get(id).onclick(),json:s=>JSON.parse(run('JSON.stringify('+s+')'))};
}
function complete(a){a.run(`db.active=['ENFM09','ENFN09'];allExpected().forEach((x,i)=>{startNew(x.cohort,x.subjectCode);draft.parts=[toStored({...partValue(0),weeklyAssigned:i%3,day:days[i%6]},0)];saveDraft()});db.stages=stageExpected().map((x,i)=>({id:'g'+i,cohort:x.cohort,subjectCode:x.subjectCode,label:'Grupo A',location:stageLocations[0],students:12,people:[{id:'doc3',weeklyAssigned:i%4,schedule:[{day:'Segunda',start:'07:00',end:'13:00'}]}]}));db.extras=[{id:'e1',teacher:'doc2',type:'NDE',n:3}];db.comments='Orientação administrativa armazenada';db.observations=[{id:'oD',nucleus:'D',cohort:'ENFM09',subjectCode:'9211',subject:'Docência',text:'Conferir supervisão',status:'Validada',when:'data da observação',custom:{preservar:true}},{id:'oE',nucleus:'E',cohort:'ENFN09',subjectCode:'9211',subject:'Campo',text:'Campo conferido',status:'Validada'}];go('conference')`);assert.equal(a.run('planningValidation().valid'),true)}
function approve(a){a.run("go('conference')");a.click('submit');assert.equal(a.run('db.workflow'),'submitted');a.run("go('admin')");a.click('approve');assert.equal(a.run('db.workflow'),'approved')}
test('aprovação preserva turmas ofertadas e somente elas',()=>{
 const a=app();complete(a);approve(a);assert.deepEqual(a.json('db.versions[0].active'),['ENFM09','ENFN09']);assert.equal(a.run('db.versions.length'),1);
});
test('observações preservam núcleo, vínculo, conteúdo, estado e metadados',()=>{
 const a=app();complete(a);const observations=a.json('db.observations');approve(a);assert.deepEqual(a.json('db.versions[0].observations'),observations);
});
test('contexto administrativo inclui orientações, estado aprovado e eventos até aprovação',()=>{
 const a=app();complete(a);approve(a);const v=a.json('db.versions[0]');assert.equal(v.comments,'Orientação administrativa armazenada');assert.equal(v.workflow,'approved');assert.deepEqual(v.events,a.json('db.events'));assert.equal(v.events.at(-1).action,'Planejamento aprovado');assert.equal(v.events.at(-1).at,v.when);assert.ok(Number.isFinite(Date.parse(v.when)));assert.equal(v.events.at(-1).when,new Date(v.when).toLocaleString('pt-BR'));assert.equal('versions' in v,false);
});
test('retratos conservam separadamente os três núcleos e cargas, inclusive zero',()=>{
 const a=app();complete(a);const before=a.json('[db.records,db.stages,db.extras]');approve(a);assert.deepEqual(a.json('[db.versions[0].records,db.versions[0].stages,db.versions[0].extras]'),before);assert.equal(a.run('db.versions[0].records[0].parts[0].weeklyAssigned'),0);
});
test('cópias profundas impedem alterações retroativas em todos os campos',()=>{
 const a=app();complete(a);approve(a);const first=a.run('JSON.stringify(db.versions[0])');a.click('reopen');a.run(`db.active.pop();db.records[0].parts[0].weeklyAssigned=17;db.stages[0].people[0].weeklyAssigned=19;db.extras[0].n=7;db.observations[0].status='Pendente';db.observations[0].custom.preservar=false;db.comments='Nova orientação';db.events[0].action='Alterado no estado atual';persist()`);assert.equal(a.run('JSON.stringify(db.versions[0])'),first);const b=app(JSON.parse(a.storage.get(key)));assert.equal(b.run('JSON.stringify(db.versions[0])'),first);
});
test('reabertura e nova aprovação preservam retrato antigo e registram novo contexto',()=>{
 const a=app();complete(a);approve(a);const first=a.run('JSON.stringify(db.versions[0])');a.click('reopen');a.run(`db.active=['ENFM09'];db.records[0].parts[0].weeklyAssigned=7;db.observations[0].text='Supervisão revisada';db.comments='Orientação nova'`);approve(a);assert.equal(a.run('db.versions.length'),2);assert.equal(a.run('JSON.stringify(db.versions[0])'),first);assert.deepEqual(a.json('db.versions[1].active'),['ENFM09']);assert.equal(a.run('db.versions[1].comments'),'Orientação nova');assert.equal(a.run('db.versions[1].records[0].parts[0].weeklyAssigned'),7);assert.equal(a.run('db.versions[1].observations[0].text'),'Supervisão revisada');assert.equal(a.run("db.versions[1].events.find(e=>e.reason).reason"),a.controls.reason);
});
test('histórico antigo permanece sem campos inventados ao carregar, consultar e aprovar novamente',()=>{
 const a=app();complete(a);a.run(`db.versions=[{when:'2026-01-01T00:00:00.000Z',records:[],stages:[],extras:[]}];db.events=[{when:'histórico antigo',action:'Planejamento aprovado'}];persist()`);const saved=JSON.parse(a.storage.get(key)),b=app(saved),old=JSON.stringify(saved.versions[0]);b.run("go('admin')");assert.equal(b.storage.get(key),JSON.stringify(saved));assert.match(b.nodes.get('app').innerHTML,/histórico antigo/);approve(b);assert.equal(b.run('JSON.stringify(db.versions[0])'),old);assert.equal(b.run('db.versions[0].active'),undefined);assert.equal(b.run('db.versions[0].observations'),undefined);assert.equal(b.run('db.events[0].at'),undefined);assert.equal(b.run('db.versions.length'),2);
});
test('motivos administrativos ficam nos eventos, separados das observações acadêmicas',()=>{
 const a=app();complete(a);approve(a);a.controls.reason='Redistribuição administrativa';a.click('reopen');const obs=a.json('db.observations');approve(a);assert.deepEqual(a.json('db.versions[1].observations'),obs);assert.equal(a.run("db.versions[1].events.filter(e=>e.reason).length"),1);assert.equal(a.run("db.versions[1].events.find(e=>e.reason).reason"),'Redistribuição administrativa');assert.equal(a.run("db.versions[0].events.some(e=>e.reason)"),false);
});
for(const status of ['Pendente','Corrigida'])test('observação '+status+' continua impedindo aprovação sem gerar retrato',()=>{
 const a=app();complete(a);a.run("db.workflow='submitted';go('admin')");a.run(`db.observations[0].status='${status}'`);const before=a.run('JSON.stringify(db)');a.click('approve');assert.equal(a.run('JSON.stringify(db)'),before);assert.equal(a.run('db.versions.length'),0);
});
test('cancelar aprovação não cria retrato nem modifica dados',()=>{
 const a=app();complete(a);a.run("go('conference')");a.click('submit');a.run("go('admin')");const old=a.run('JSON.stringify(db)'),stored=a.storage.get(key);a.controls.confirm=false;a.click('approve');assert.equal(a.run('JSON.stringify(db)'),old);assert.equal(a.storage.get(key),stored);
});
test('aprovação não altera cálculos ou exportações acadêmicas',()=>{
 const a=app();complete(a);const before=a.json('[db.records,db.stages,db.extras]'),xml=a.run('excelDocument()'),salary=a.run('excelDocument(true)'),rows=a.run('JSON.stringify(salaryRows(P[2][0]))');approve(a);assert.deepEqual(a.json('[db.records,db.stages,db.extras]'),before);assert.equal(a.run('excelDocument()'),xml);assert.equal(a.run('excelDocument(true)'),salary);assert.equal(a.run('JSON.stringify(salaryRows(P[2][0]))'),rows);
});
