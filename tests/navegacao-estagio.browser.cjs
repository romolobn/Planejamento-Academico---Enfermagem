// Regressão de navegação na interface real.
// Executar no ambiente com Playwright e Chromium disponíveis:
// node --test tests/navegacao-estagio.browser.cjs
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
let server,browser,url;
before(async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'));
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 url=`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
});
after(async()=>{
 if(browser)await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
});
for(const [cohortCode,subjectCode,workflow] of [
 ['ENFM09','8955','editing'],
 ['ENFT09','8156','submitted'],
 ['ENFN10','8164','approved']
])for(const filled of [false,true])test(`Conferência → Campo: ${cohortCode}/${subjectCode}, ${filled?'preenchido':'pendente'}, ${workflow}`,async()=>{
 const context=await browser.newContext();
 try{
  const page=await context.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await page.evaluate(({cohortCode,subjectCode,workflow,filled})=>{
   db.active=[...new Set(['ENFM09',cohortCode])];
   const c=cohort(cohortCode);
   const other=stageSubjects().find(m=>m[2]===c.period&&m[0]!==subjectCode);
   const group=(id,code,label)=>({id,cohort:cohortCode,subjectCode:code,label,location:stageLocations[1],students:12,people:[
    {id:'doc2',weeklyAssigned:'0',schedule:[{day:'Terça',start:'08:00',end:'12:00'}]},
    {id:'staff-84002',weeklyAssigned:7,schedule:[{day:'Terça',start:'08:00',end:'12:00'}]}
   ]});
   db.stages=[group('outro-grupo',other[0],'Grupo Preservado')];
   if(filled)db.stages.push(group('grupo-alvo',subjectCode,'Grupo Alvo'));
   // Outros núcleos, observações e histórico também precisam permanecer intactos.
   startNew(cohortCode,'8161');
   draft.parts=[toStored({...partValue(0),day:'Quinta'},0)];saveDraft();
   db.extras=[{id:'extra-preservada',teacher:'doc3',type:'NDE',n:3}];
   db.observations=[{id:'observacao',nucleus:'E',cohort:cohortCode,subjectCode,subject:'Preservar',text:'Não alterar',status:'Validada'}];
   db.versions=[{when:'anterior',records:[],stages:[],extras:[]}];
   db.events=[{when:'anterior',action:'Histórico preservado'}];
   db.workflow=workflow;persist();
   stageTab='load';stageCohort='ENFM09';stageSubject='9211';go('conference');
  },{cohortCode,subjectCode,workflow,filled});
  const snapshot=()=>page.evaluate(()=>({data:JSON.stringify(db),storage:localStorage.getItem(key)}));
  const before=await snapshot();
  const row=page.locator(`[data-requirement="E|${cohortCode}|${subjectCode}"]`);
  assert.match(await row.innerText(),filled?/Completa/:/Pendente/);
  // Abrir Campo é o nome atual do antigo botão Abrir estágio.
  await row.getByRole('button',{name:'Abrir Campo',exact:true}).click();
  assert.equal(await page.evaluate(()=>screen),'stage');
  assert.equal(await page.evaluate(()=>stageTab),'groups');
  assert.match(await page.locator('h2').first().innerText(),/Estágio — Enfermagem/);
  assert.equal(await page.locator('#stagecohort').inputValue(),cohortCode);
  assert.equal(await page.locator('#stagesubject').inputValue(),subjectCode);
  assert.equal(await page.evaluate(()=>stageFor(stageCohort,stageSubject).length),filled?1:0);
  assert.equal(await page.locator('.item').filter({hasText:'Grupo Alvo'}).count(),filled?1:0);
  assert.deepEqual(await snapshot(),before);
  // Repetir a navegação não pode criar grupo nem alterar a seleção ou persistência.
  await page.getByRole('button',{name:'Conferência',exact:true}).click();
  await page.locator(`[data-requirement="E|${cohortCode}|${subjectCode}"]`).getByRole('button',{name:'Abrir Campo',exact:true}).click();
  assert.equal(await page.locator('#stagecohort').inputValue(),cohortCode);
  assert.equal(await page.locator('#stagesubject').inputValue(),subjectCode);
  assert.deepEqual(await snapshot(),before);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
