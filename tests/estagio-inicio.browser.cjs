// node --test tests/estagio-inicio.browser.cjs
// Requer Playwright e Chromium disponíveis no ambiente.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
let server,browser,url;
before(async()=>{const html=fs.readFileSync(path.join(__dirname,'../index.html'));server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']})});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))});
async function visit(fn){const context=await browser.newContext();try{const page=await context.newPage(),errors=[],alerts=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());await d.accept()});await page.goto(url);await fn(page,alerts);assert.deepEqual(errors,[])}finally{await context.close()}}
const snapshot=page=>page.evaluate(()=>({data:JSON.stringify(db),stored:localStorage.getItem(key)}));
async function existing(page){await page.evaluate(()=>{
 db.active=['ENFM09'];const group=(id,label)=>({id,label,cohort:'ENFM09',subjectCode:'9211',location:'HGNI',students:'12',people:[
 {id:'doc2',weeklyAssigned:'0',schedule:[{day:'Segunda',start:'07:00',end:'13:00'},{day:'Sexta',start:'09:00',end:'15:00'}]},
 {id:'doc3',weeklyAssigned:'7',schedule:[{day:'Segunda',start:'07:00',end:'13:00'},{day:'Quarta',start:'08:00',end:'14:00'}]}
 ]});db.stages=[group('grupo-a','Grupo A'),group('grupo-b','Grupo B')];db.extras=[{id:'extra',teacher:'staff-84002',type:'NDE',n:3}];persist();go('stage');
})}
test('grupo novo com início vazio é bloqueado; horário flexível preenchido permite salvar',()=>visit(async(page,alerts)=>{
 await page.evaluate(()=>{db.active=['ENFM09'];persist();stageNew()});const before=await snapshot(page);
 await page.locator('#sglocation').selectOption('HGNI');await page.locator('#sgstudents').fill('12');await page.locator('#sgweekly-0').fill('0');await page.locator('#sgstart-0-0').fill('');
 await page.locator('#sgsave').click();assert.match(alerts.at(-1),/horário inicial.*profissional 1, horário 1 do Grupo A/);
 assert.equal(await page.locator('#sgstart-0-0').inputValue(),'');assert.equal(await page.locator('#sgstart-0-0').evaluate(e=>e===document.activeElement),true);
 assert.equal(await page.locator('#sglocation').inputValue(),'HGNI');assert.equal(await page.locator('#sgstudents').inputValue(),'12');assert.equal(await page.locator('#sgweekly-0').inputValue(),'0');assert.deepEqual(await snapshot(page),before);
 await page.locator('#sgstart-0-0').fill('05:15');await page.locator('#sgsave').click();assert.equal(await page.evaluate(()=>screen),'stage');assert.equal(await page.evaluate(()=>db.stages[0].people[0].schedule[0].start),'05:15');
}));
for(const group of ['grupo-a','grupo-b'])test('edição e limpeza em '+group+' preservam armazenamento, formulário e outros grupos',()=>visit(async(page,alerts)=>{
 await existing(page);const before=await snapshot(page);await page.locator(`[data-stage-edit="${group}"]`).click();
 await page.locator('#sgstudents').fill('22');await page.locator('#sglocation').selectOption('CAPS III');await page.locator('#sgweekly-1').fill('9');await page.locator('#sgday-0-0').selectOption('Quarta');await page.locator('#sgend-0-0').fill('16:30');await page.locator('#sgstart-0-0').fill('08:15');await page.locator('#sgstart-0-0').fill('');
 await page.locator('#sgsave').click();assert.match(alerts.at(-1),/horário inicial/);await page.locator('#sgsaveanother').click();assert.match(alerts.at(-1),/horário inicial/);
 assert.equal(await page.locator('#sgstart-0-0').inputValue(),'');assert.equal(await page.locator('#sgstudents').inputValue(),'22');assert.equal(await page.locator('#sgweekly-1').inputValue(),'9');assert.equal(await page.locator('#sglocation').inputValue(),'CAPS III');assert.equal(await page.locator('#sgend-0-0').inputValue(),'16:30');assert.equal(await page.locator('#sgstart-0-1').inputValue(),'09:00');assert.equal(await page.locator('#sgstart-1-0').inputValue(),'07:00');assert.deepEqual(await snapshot(page),before);
 // Uma renderização intermediária também não pode restaurar o início apagado.
 await page.locator('[data-sg-dayadd="0"]').click();assert.equal(await page.locator('#sgstart-0-0').inputValue(),'');assert.equal(await page.locator('#sgweekly-1').inputValue(),'9');assert.deepEqual(await snapshot(page),before);
 await page.locator('#sgstart-0-0').fill('08:15');await page.locator('#sgsave').click();assert.equal(await page.evaluate(()=>screen),'stage');
 const saved=await page.evaluate(group=>db.stages.find(g=>g.id===group),group);assert.equal(saved.people[0].schedule[0].start,'08:15');assert.equal(saved.people[0].weeklyAssigned,'0');assert.equal(saved.people[1].weeklyAssigned,'9');
 const other=group==='grupo-a'?'grupo-b':'grupo-a',old=JSON.parse(before.data);
 assert.deepEqual(await page.evaluate(id=>db.stages.find(g=>g.id===id),other),old.stages.find(g=>g.id===other));
 await page.reload();assert.equal(await page.evaluate(group=>db.stages.find(g=>g.id===group).people[0].schedule[0].start,group),'08:15');
}));
test('valida horário adicional do segundo profissional sem afetar profissionais ou grupos',()=>visit(async(page,alerts)=>{
 await existing(page);const before=await snapshot(page);await page.locator('[data-stage-edit="grupo-a"]').click();await page.locator('#sgstart-1-1').fill('');await page.locator('#sgsave').click();
 assert.match(alerts.at(-1),/EM CONTRATAÇÃO.*profissional 2, horário 2 do Grupo A/);assert.equal(await page.locator('#sgstart-1-1').evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('#sgstart-1-1').inputValue(),'');assert.deepEqual(await snapshot(page),before);
 await page.locator('#sgstart-1-1').fill('07:00');await page.locator('#sgsave').click();assert.equal(await page.evaluate(()=>screen),'stage');assert.equal(await page.evaluate(()=>db.stages.length),2);
}));
