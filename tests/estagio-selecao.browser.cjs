// node --test tests/estagio-selecao.browser.cjs
// Requer Playwright e Chromium disponíveis no ambiente.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
let server,browser,url;
before(async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'));
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))});
async function visit(fn){
 const context=await browser.newContext();
 try{const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(url);await fn(page);assert.deepEqual(errors,[])}finally{await context.close()}
}
const snapshot=page=>page.evaluate(()=>({data:JSON.stringify(db),stored:localStorage.getItem(key)}));
for(const [code,load] of [['ENFT09','7'],['ENFM09','0']])test('seleção exibida e salvamento corretos com somente '+code,()=>visit(async page=>{
 await page.evaluate(code=>{db.active=[code];db.extras=[{id:'extra',teacher:'doc3',type:'NDE',n:3}];persist()},code);
 const before=await snapshot(page);await page.getByRole('button',{name:'🏥 Estágio',exact:true}).click();
 assert.equal(await page.locator('#stagecohort').inputValue(),code);assert.equal(await page.evaluate(()=>stageCohort),code);
 assert.deepEqual(await snapshot(page),before);
 await page.locator('#stageadd').click();assert.equal(await page.evaluate(()=>sgDraft.cohort),code);
 await page.locator('#sgstudents').fill('12');await page.locator('#sgperson-0').selectOption('doc2');await page.locator('#sgweekly-0').fill(load);await page.locator('#sgsave').click();
 assert.equal(await page.evaluate(()=>db.stages.length),1);assert.equal(await page.evaluate(()=>db.stages[0].cohort),code);
 assert.equal(await page.evaluate(()=>db.stages[0].people[0].weeklyAssigned),load);
 assert.deepEqual(await page.evaluate(()=>db.extras),[{id:'extra',teacher:'doc3',type:'NDE',n:3}]);
 assert.deepEqual(await page.evaluate(()=>db.active),[code]);
 // Navegação explícita da Conferência deve preservar a disciplina solicitada.
 const saved=await snapshot(page);await page.getByRole('button',{name:'Conferência',exact:true}).click();
 await page.locator(`[data-requirement="E|${code}|8156"]`).getByRole('button',{name:'Abrir Campo',exact:true}).click();
 assert.equal(await page.locator('#stagecohort').inputValue(),code);assert.equal(await page.locator('#stagesubject').inputValue(),'8156');
 assert.deepEqual(await snapshot(page),saved);
 await page.reload();await page.getByRole('button',{name:'🏥 Estágio',exact:true}).click();
 assert.equal(await page.locator('#stagecohort').inputValue(),code);assert.equal(await page.evaluate(()=>db.stages[0].cohort),code);
}));
test('seleção manual válida persiste nas renderizações e retorno ao módulo',()=>visit(async page=>{
 await page.evaluate(()=>{db.active=['ENFM09','ENFT09','ENFN10'];persist();go('stage')});const before=await snapshot(page);
 await page.locator('#stagecohort').selectOption('ENFN10');await page.locator('#stagesubject').selectOption('8164');
 await page.getByRole('button',{name:'Docência',exact:true}).click();await page.getByRole('button',{name:'Estágio',exact:true}).click();
 assert.equal(await page.locator('#stagecohort').inputValue(),'ENFN10');assert.equal(await page.locator('#stagesubject').inputValue(),'8164');
 assert.equal(await page.evaluate(()=>stageCohort),'ENFN10');assert.deepEqual(await snapshot(page),before);
}));
test('retirada de oferta selecionada pela interface escolhe próxima válida sem alterar dados acadêmicos',()=>visit(async page=>{
 await page.evaluate(()=>{db.active=['ENFT09','ENFN10'];db.stages=[{id:'preservar',cohort:'ENFN10',subjectCode:'8164',label:'Grupo A',location:'HGNI',students:10,people:[{id:'doc3',weeklyAssigned:0,schedule:[{day:'Sexta',start:'07:00',end:'13:00'}]}]}];db.extras=[{id:'extra',teacher:'doc2',type:'NDE',n:3}];stageCohort='ENFT09';stageSubject='8955';persist();go('stage')});
 const academic=()=>page.evaluate(()=>JSON.stringify([db.records,db.stages,db.extras,db.observations,db.events,db.versions]));const before=await academic();
 await page.getByRole('button',{name:'Planejamento Acadêmico (simulação)',exact:true}).click();await page.locator('[data-active="ENFT09"]').uncheck();
 await page.getByRole('button',{name:'Estágio',exact:true}).click();assert.equal(await page.locator('#stagecohort').inputValue(),'ENFN10');assert.equal(await page.evaluate(()=>stageCohort),'ENFN10');
 assert.equal(await page.locator('#stagesubject').inputValue(),'8162');assert.deepEqual(await page.evaluate(()=>db.active),['ENFN10']);assert.equal(await academic(),before);
 const saved=await snapshot(page);await page.getByRole('button',{name:'Conferência',exact:true}).click();
 await page.locator('[data-requirement="E|ENFN10|8164"]').getByRole('button',{name:'Abrir Campo',exact:true}).click();assert.equal(await page.locator('#stagesubject').inputValue(),'8164');assert.deepEqual(await snapshot(page),saved);
}));
for(const active of [[],['ENFM01']])test('ausência de turmas elegíveis '+JSON.stringify(active)+' mantém seleção vazia e cadastro bloqueado',()=>visit(async page=>{
 await page.evaluate(active=>{db.active=active;persist();go('stage')},active);const before=await snapshot(page);
 assert.equal(await page.locator('#stagecohort').inputValue(),'');assert.equal(await page.evaluate(()=>stageCohort),'');assert.equal(await page.locator('#stagesubject').inputValue(),'');assert.equal(await page.locator('#stageadd').isDisabled(),true);
 await page.evaluate(()=>stageNew());assert.equal(await page.evaluate(()=>sgDraft),null);assert.deepEqual(await snapshot(page),before);assert.deepEqual(await page.evaluate(()=>db.active),active);
}));
