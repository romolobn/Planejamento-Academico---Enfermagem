// node --test tests/status-docencia.browser.cjs
// Requer Playwright e Chromium disponíveis no ambiente.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');let server,browser,url;
before(async()=>{const html=fs.readFileSync(path.join(__dirname,'../index.html'));server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']})});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))});
async function visit(fn){const context=await browser.newContext();try{const page=await context.newPage(),errors=[],alerts=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());await d.accept()});await page.goto(url);await fn(page,alerts);assert.deepEqual(errors,[])}finally{await context.close()}}
async function complete(page){await page.evaluate(()=>{db.active=['ENFM09'];allExpected().forEach((x,i)=>{startNew(x.cohort,x.subjectCode);draft.parts=[toStored({...partValue(0),weeklyAssigned:0,day:days[i]},0)];saveDraft()});db.stages=stageExpected().map((x,i)=>({id:'g'+i,cohort:x.cohort,subjectCode:x.subjectCode,label:'Grupo A',location:'HGNI',students:12,people:[{id:'doc2',weeklyAssigned:0,schedule:[{day:'Segunda',start:'07:00',end:'13:00'}]}]}));persist();go('conference')})}
const row=(page,code='9211',nucleus='D',cohort='ENFM09')=>page.locator(`[data-requirement="${nucleus}|${cohort}|${code}"]`);
const snapshot=page=>page.evaluate(()=>({data:JSON.stringify(db),stored:localStorage.getItem(key)}));
test('professores múltiplos e provisórios com zero válido aparecem completos e permitem aprovação',()=>visit(async page=>{
 await complete(page);await page.evaluate(()=>{editRecord(db.records[0].id);updatePart(0,'weeklyAssigned',7);addDocTeacher();updatePart(step,'teacher','doc2');updatePart(step,'weeklyAssigned',0);updatePart(step,'day','Terça');updatePart(step,'start','08:50');addDocTeacher();updatePart(step,'teacher','doc3');updatePart(step,'weeklyAssigned',3);updatePart(step,'day','Quarta');updatePart(step,'start','08:50');saveDraft()});
 assert.equal(await row(page).locator('.tag').innerText(),'Completa');assert.equal(await page.evaluate(()=>getStatus(db.records[0])),'Completa');assert.equal(await page.locator('#submit').isEnabled(),true);
 await page.locator('#submit').click();await page.getByRole('button',{name:'Planejamento Acadêmico (simulação)',exact:true}).click();await page.locator('#approve').click();assert.equal(await page.evaluate(()=>db.workflow),'approved');
}));
test('legado com carga vazia e horário inconsistente é parcial após recarga, sem correção automática',()=>visit(async page=>{
 await complete(page);await page.evaluate(()=>{db.records[0].parts[0].weeklyAssigned='';db.records[0].parts[0].blocks=[[1,2]];persist()});const before=await snapshot(page);await page.reload();await page.getByRole('button',{name:'Conferência',exact:true}).click();
 assert.equal(await row(page).locator('.tag').innerText(),'Parcial');assert.equal(await page.evaluate(()=>getStatus(db.records[0])),'Parcial');assert.equal(await row(page,'9211','E').locator('.tag').innerText(),'Completa');assert.equal(await page.locator('#submit').isDisabled(),true);assert.deepEqual(await snapshot(page),before);
}));
test('conflitos mudam status das duas linhas e não são ocultados por filtro nem liberam aprovação',()=>visit(async(page,alerts)=>{
 await complete(page);await page.evaluate(()=>{db.records[1].parts[0].day='Segunda';persist();go('conference')});const before=await snapshot(page);
 for(const code of ['9211','8955'])assert.equal(await row(page,code).locator('.tag').innerText(),'Parcial');
 assert.equal(await page.evaluate(()=>getStatus(db.records[0])),'Parcial');assert.equal(await page.locator('#submit').isDisabled(),true);
 await page.locator('#fstatus').selectOption('Completa');assert.equal(await row(page).count(),0);assert.equal(await page.locator('#submit').isDisabled(),true);assert.deepEqual(await snapshot(page),before);
 await page.evaluate(()=>{db.workflow='submitted';go('admin')});await page.locator('#approve').click();assert.match(alerts.at(-1),/conflitos/);assert.equal(await page.evaluate(()=>db.workflow),'submitted');assert.equal(await page.evaluate(()=>db.versions.length),0);
}));
test('teoria e grupos práticos distintos preservam status válido; etapa faltante fica parcial',()=>visit(async page=>{
 await page.evaluate(()=>{db.active=['ENFM05'];startNew('ENFM05','8938');draft.groups=2;draft.parts=chooseParts().map((s,i)=>toStored({...partValue(i),teacher:P[i+2][0],day:i===0?'Segunda':'Terça',room:rooms[i]},i));saveDraft()});
 assert.equal(await row(page,'8938','D','ENFM05').locator('.tag').innerText(),'Completa');assert.equal(await page.evaluate(()=>getStatus(db.records[0])),'Completa');
 await page.evaluate(()=>{db.records[0].parts.pop();persist();go('conference')});const before=await snapshot(page);assert.equal(await row(page,'8938','D','ENFM05').locator('.tag').innerText(),'Parcial');assert.equal(await page.evaluate(()=>getStatus(db.records[0])),'Parcial');assert.deepEqual(await snapshot(page),before);
}));
