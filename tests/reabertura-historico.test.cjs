// node --test tests/*.test.cjs
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const key='planejamento-enfermagem-g32047-v22';
function app(saved){
 const nodes=new Map(),store=new Map(),alerts=[],controls={promptValue:'Revisar distribuição docente',confirmValue:true,promptCalls:0,confirmCalls:0};
 if(saved)store.set(key,JSON.stringify(saved));
 const ctx=vm.createContext({console,Date,Math,alert:m=>alerts.push(m),prompt:()=>{controls.promptCalls++;return controls.promptValue},confirm:()=>{controls.confirmCalls++;return controls.confirmValue},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},querySelectorAll:()=>[]}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 const run=s=>vm.runInContext(s,ctx);return {run,nodes,store,alerts,controls,click:id=>nodes.get(id).onclick()};
}
function approve(a){a.run("go('conference')");a.click('submit');a.run("go('admin')");a.click('approve');assert.equal(a.run('db.workflow'),'approved')}
function approved(a){a.run(`db.active=['ENFM09'];allExpected().forEach((x,i)=>{startNew(x.cohort,x.subjectCode);draft.parts=[toStored({...partValue(0),weeklyAssigned:0,day:days[i]},0)];saveDraft()});db.stages=stageExpected().map((x,i)=>({id:'g'+i,cohort:x.cohort,subjectCode:x.subjectCode,label:'Grupo A',location:'HGNI',students:12,people:[{id:'doc2',weeklyAssigned:0,schedule:[{day:'Segunda',start:'07:00',end:'13:00'}]}]}));db.comments='Orientação acadêmica preservada';db.observations=[{id:'obs',nucleus:'D',cohort:'ENFM09',subjectCode:'9211',subject:'Docência',text:'Observação acadêmica',status:'Validada'}]`);approve(a)}
test('reabertura válida grava motivo e data/hora no evento e mantém dados acadêmicos',()=>{
 const a=app();approved(a);const before=a.run('JSON.stringify([db.records,db.stages,db.extras,db.observations,db.comments,db.versions])');const old=a.run('JSON.stringify(db.events)');
 const time=Date.now();a.controls.promptValue='  Atualizar supervisão do semestre  ';a.click('reopen');
 const event=JSON.parse(a.run('JSON.stringify(db.events.at(-1))'));
 assert.equal(event.action,'Reaberto para correção');assert.equal(event.reason,'Atualizar supervisão do semestre');
 assert.ok(Date.parse(event.at)>=time&&Date.parse(event.at)<=Date.now());assert.equal(event.when,new Date(event.at).toLocaleString('pt-BR'));
 assert.equal(a.run('db.workflow'),'editing');assert.equal(a.run('canEdit()'),true);
 assert.equal(a.run('JSON.stringify(db.events.slice(0,-1))'),old);assert.equal(a.run('JSON.stringify([db.records,db.stages,db.extras,db.observations,db.comments,db.versions])'),before);
 assert.match(a.nodes.get('app').innerHTML,/Motivo administrativo da reabertura/);assert.match(a.nodes.get('app').innerHTML,/Atualizar supervisão do semestre/);
});
for(const value of ['', '   ', null])test('motivo '+JSON.stringify(value)+' mantém aprovado, bloqueado e sem gravação',()=>{
 const a=app();approved(a);const before=a.run('JSON.stringify(db)'),stored=a.store.get(key),confirmCalls=a.controls.confirmCalls;
 a.controls.promptValue=value;a.click('reopen');assert.equal(a.run('db.workflow'),'approved');assert.equal(a.run('canEdit()'),false);
 assert.equal(a.run('JSON.stringify(db)'),before);assert.equal(a.store.get(key),stored);assert.equal(a.controls.confirmCalls,confirmCalls);assert.match(a.alerts.at(-1),/Informe o motivo/);
});
test('cancelar confirmação após informar motivo não grava evento nem libera edição',()=>{
 const a=app();approved(a);const before=a.run('JSON.stringify(db)'),stored=a.store.get(key);a.controls.confirmValue=false;a.click('reopen');
 assert.equal(a.run('JSON.stringify(db)'),before);assert.equal(a.store.get(key),stored);assert.equal(a.run('canEdit()'),false);
});
test('motivo e vínculo ao evento sobrevivem a salvar e recarregar',()=>{
 const a=app();approved(a);a.controls.promptValue='Rever escala de quarta-feira';a.click('reopen');
 const saved=JSON.parse(a.store.get(key)),b=app(saved);b.run("go('admin')");
 assert.equal(b.run('JSON.stringify(db)'),JSON.stringify(saved));assert.equal(b.run('db.events.at(-1).reason'),'Rever escala de quarta-feira');
 assert.match(b.nodes.get('app').innerHTML,/Rever escala de quarta-feira/);assert.equal(b.store.get(key),JSON.stringify(saved));
});
test('duas reaberturas sucessivas preservam motivos, aprovações e ordem dos eventos',()=>{
 const a=app();approved(a);a.controls.promptValue='Primeira revisão';a.click('reopen');const first=JSON.parse(a.run('JSON.stringify(db.events.at(-1))'));
 approve(a);a.controls.promptValue='Segunda revisão';a.click('reopen');
 const reopened=JSON.parse(a.run("JSON.stringify(db.events.filter(e=>e.action==='Reaberto para correção'))"));
 assert.deepEqual(reopened.map(e=>e.reason),['Primeira revisão','Segunda revisão']);assert.deepEqual(reopened[0],first);assert.equal(a.run('db.versions.length'),2);
 assert.equal(a.run("db.events.filter(e=>e.action==='Planejamento aprovado').length"),2);
 const b=app(JSON.parse(a.store.get(key)));assert.equal(b.run("JSON.stringify(db.events.filter(e=>e.reason).map(e=>e.reason))"),'["Primeira revisão","Segunda revisão"]');
});
test('observações acadêmicas e comentários não recebem o motivo administrativo',()=>{
 const a=app();approved(a);const before=a.run('JSON.stringify([db.observations,db.comments])');a.controls.promptValue='Justificativa exclusivamente administrativa';a.click('reopen');
 assert.equal(a.run('JSON.stringify([db.observations,db.comments])'),before);assert.equal(a.run('db.events.at(-1).reason'),'Justificativa exclusivamente administrativa');
});
test('histórico antigo sem motivo ou instante ISO permanece inalterado na abertura e após novo evento',()=>{
 const a=app();approved(a);a.run("db.events=[{when:'01/02/2026, 10:00:00',action:'Planejamento aprovado'},{when:'02/02/2026, 11:00:00',action:'Reaberto para correção'},{when:'03/02/2026, 12:00:00',action:'Planejamento aprovado'}];persist()");
 const saved=JSON.parse(a.store.get(key)),b=app(saved),old=JSON.stringify(saved.events);
 b.run("go('admin')");assert.equal(b.run('JSON.stringify(db.events)'),old);assert.equal(b.store.get(key),JSON.stringify(saved));
 b.click('reopen');assert.equal(b.run('JSON.stringify(db.events.slice(0,-1))'),old);assert.equal(b.run('db.events[1].reason'),undefined);
});
test('reabertura de enviado preserva orientação acadêmica e não exige justificativa de aprovado',()=>{
 const a=app();a.run("db.workflow='submitted';db.comments='Anterior';go('admin')");a.run("$('comments').value='Orientação para correção'");a.click('reopen');
 assert.equal(a.controls.promptCalls,0);assert.equal(a.run('db.workflow'),'editing');assert.equal(a.run('db.comments'),'Orientação para correção');assert.equal(a.run('db.events.at(-1).reason'),undefined);
});
test('exibição escapa HTML e mantém o motivo como texto',()=>{
 const a=app();approved(a);a.controls.promptValue='<b>Revisar</b> & preservar';a.click('reopen');
 assert.equal(a.run('db.events.at(-1).reason'),'<b>Revisar</b> & preservar');assert.match(a.nodes.get('app').innerHTML,/&lt;b&gt;Revisar&lt;\/b&gt; &amp; preservar/);assert.doesNotMatch(a.nodes.get('app').innerHTML,/<b>Revisar<\/b>/);
});
test('reabertura não altera cálculos, cargas, grade ou documentos exportados',()=>{
 const a=app();approved(a);const rows=a.run('JSON.stringify(salaryRows(P[2][0]))'),xml=a.run('excelDocument()'),salaryXml=a.run('excelDocument(true)');
 a.click('reopen');assert.equal(a.run('JSON.stringify(salaryRows(P[2][0]))'),rows);assert.equal(a.run('excelDocument()'),xml);assert.equal(a.run('excelDocument(true)'),salaryXml);
});
