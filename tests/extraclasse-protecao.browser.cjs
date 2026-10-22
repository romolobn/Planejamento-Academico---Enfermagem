// node --test tests/extraclasse-protecao.browser.cjs
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
let server,browser,url;
before(async()=>{const html=fs.readFileSync(path.join(__dirname,'../index.html'));server=http.createServer((req,res)=>res.end(html));await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']})});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))});
async function visit(fn){const context=await browser.newContext();try{const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.type()==='prompt'?'Revisar atividades extraclasse':undefined));await page.goto(url);await fn(page);assert.deepEqual(errors,[])}finally{await context.close()}}
const snapshot=page=>page.evaluate(()=>({db:JSON.stringify(db),storage:JSON.stringify(Object.entries(localStorage))}));
async function capture(page){await page.evaluate(()=>{go('home');go('extra');$('nextra').value='4';window.savedExtra=$('saveextra').onclick;savedExtra();window.extraTeacher=db.extras[0].teacher;window.removeExtra=document.querySelector('[data-delextra]').onclick;go('extra');$('nextra').value='7';window.savedExtra=$('saveextra').onclick})}
for(const workflow of ['submitted','approved'])for(const operation of ['save','delete'])test(`${workflow}: chamada direta de ${operation} não altera memória nem armazenamento`,async()=>visit(async page=>{
 await capture(page);await page.evaluate(workflow=>{db.workflow=workflow;persist()},workflow);const old=await snapshot(page);
 await page.evaluate(operation=>operation==='save'?window.savedExtra():window.removeExtra(),operation);assert.deepEqual(await snapshot(page),old);
}));
for(const operation of ['save','delete'])test(`recuperação protegida: chamada direta de ${operation} é bloqueada`,async()=>visit(async page=>{
 await capture(page);await page.evaluate(()=>{localStorage.setItem(key,'{original inválido');storageRecovery.blocked=true;render()});const old=await snapshot(page);
 await page.evaluate(operation=>operation==='save'?window.savedExtra():window.removeExtra(),operation);assert.deepEqual(await snapshot(page),old);assert.equal(await page.locator('#saveextra,[data-delextra]').count(),0);
}));
test('aberto: cria e exclui pela interface; recarga preserva dados e demais núcleos',async()=>visit(async page=>{
 const other=await page.evaluate(()=>JSON.stringify([db.records,db.stages]));await page.evaluate(()=>go('home'));await page.locator('#extra').click();await page.locator('#type').selectOption('Coordenação');await page.locator('#nextra').fill('5');await page.locator('#saveextra').click();
 assert.equal(await page.evaluate(()=>db.extras[0].n),5);assert.equal(await page.evaluate(()=>extra(professor)),5);await page.reload();await page.evaluate(()=>go('home'));assert.equal(await page.evaluate(()=>db.extras[0].type),'Coordenação');await page.locator('[data-delextra]').click();assert.equal(await page.evaluate(()=>db.extras.length),0);assert.equal(await page.evaluate(()=>JSON.stringify([db.records,db.stages])),other);await page.reload();assert.equal(await page.evaluate(()=>db.extras.length),0);
}));
test('reabertura administrativa válida volta a permitir criação e exclusão',async()=>visit(async page=>{
 await page.evaluate(()=>{db.active=['ENFM09'];allExpected().forEach((x,i)=>{startNew(x.cohort,x.subjectCode);draft.parts=[toStored({...partValue(0),weeklyAssigned:0,day:days[i]},0)];saveDraft()});db.stages=stageExpected().map((x,i)=>({id:'g'+i,cohort:x.cohort,subjectCode:x.subjectCode,label:'Grupo A',location:'HGNI',students:12,people:[{id:'doc2',weeklyAssigned:0,schedule:[{day:'Segunda',start:'07:00',end:'13:00'}]}]}));go('conference')});
 await page.locator('#submit').click();await page.evaluate(()=>go('admin'));await page.locator('#approve').click();assert.equal(await page.evaluate(()=>db.workflow),'approved');await page.locator('#reopen').click();assert.equal(await page.evaluate(()=>canEdit()),true);await capture(page);assert.equal(await page.evaluate(()=>db.extras.length),1);await page.evaluate(()=>window.removeExtra());assert.equal(await page.evaluate(()=>db.extras.length),0);
}));
test('validação de carga extraclasse permanece inalterada',async()=>visit(async page=>{
 await page.evaluate(()=>go('extra'));const old=await snapshot(page);for(const value of ['', '0','-1','1.5']){await page.locator('#nextra').fill(value);await page.evaluate(()=>$('saveextra').onclick());assert.deepEqual(await snapshot(page),old)}
}));
