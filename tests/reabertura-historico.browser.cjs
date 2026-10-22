// node --test tests/reabertura-historico.browser.cjs
// Requer Playwright e Chromium disponíveis no ambiente.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');let browser,server,url;
before(async()=>{const html=fs.readFileSync(path.join(__dirname,'../index.html'));server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']})});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))});
async function visit(fn){const context=await browser.newContext({timezoneId:'America/Sao_Paulo'});try{const page=await context.newPage(),errors=[],dialogs={reason:'Revisão administrativa',confirm:true,alerts:[]};page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{if(d.type()==='prompt'){if(dialogs.reason===null)await d.dismiss();else await d.accept(dialogs.reason)}else if(d.type()==='confirm'){if(dialogs.confirm)await d.accept();else await d.dismiss()}else{dialogs.alerts.push(d.message());await d.accept()}});await page.goto(url);await fn(page,dialogs);assert.deepEqual(errors,[])}finally{await context.close()}}
async function approved(page){await page.evaluate(()=>{db.active=['ENFM09'];allExpected().forEach((x,i)=>{startNew(x.cohort,x.subjectCode);draft.parts=[toStored({...partValue(0),weeklyAssigned:0,day:days[i]},0)];saveDraft()});db.stages=stageExpected().map((x,i)=>({id:'g'+i,cohort:x.cohort,subjectCode:x.subjectCode,label:'Grupo A',location:'HGNI',students:12,people:[{id:'doc2',weeklyAssigned:0,schedule:[{day:'Segunda',start:'07:00',end:'13:00'}]}]}));db.comments='Orientação acadêmica';db.observations=[{id:'obs',nucleus:'D',cohort:'ENFM09',subjectCode:'9211',subject:'Docência',text:'Observação preservada',status:'Validada'}];go('conference')});await approve(page)}
async function approve(page){await page.getByRole('button',{name:'Conferência',exact:true}).click();await page.locator('#submit').click();await page.getByRole('button',{name:'Planejamento Acadêmico (simulação)',exact:true}).click();await page.locator('#approve').click();assert.equal(await page.evaluate(()=>db.workflow),'approved')}
const snapshot=page=>page.evaluate(()=>({db:JSON.stringify(db),stored:localStorage.getItem(key)}));
test('duas reaberturas reais preservam motivos e histórico após recargas',()=>visit(async(page,dialogs)=>{
 await approved(page);assert.equal(await page.evaluate(()=>canEdit()),false);const observations=await page.evaluate(()=>JSON.stringify([db.observations,db.comments]));
 dialogs.reason='Primeira revisão da supervisão';await page.locator('#reopen').click();assert.equal(await page.evaluate(()=>canEdit()),true);assert.match(await page.locator('#app').innerText(),/Motivo administrativo da reabertura: Primeira revisão da supervisão/);
 const first=await page.evaluate(()=>db.events.at(-1));assert.ok(Number.isFinite(Date.parse(first.at)));assert.equal(first.reason,dialogs.reason);
 await page.reload();await page.getByRole('button',{name:'Planejamento Acadêmico (simulação)',exact:true}).click();assert.match(await page.locator('#app').innerText(),/Primeira revisão da supervisão/);await approve(page);
 dialogs.reason='Segunda revisão de distribuição';await page.locator('#reopen').click();await page.reload();await page.getByRole('button',{name:'Planejamento Acadêmico (simulação)',exact:true}).click();
 const events=await page.evaluate(()=>db.events.filter(e=>e.action==='Reaberto para correção'));assert.deepEqual(events.map(e=>e.reason),['Primeira revisão da supervisão','Segunda revisão de distribuição']);assert.deepEqual(events[0],first);assert.equal(await page.evaluate(()=>db.versions.length),2);assert.equal(await page.evaluate(()=>JSON.stringify([db.observations,db.comments])),observations);
 assert.match(await page.locator('#app').innerText(),/Primeira revisão da supervisão/);assert.match(await page.locator('#app').innerText(),/Segunda revisão de distribuição/);
}));
test('vazio, espaços e cancelamento mantêm aprovado e armazenamento intacto',()=>visit(async(page,dialogs)=>{
 await approved(page);const before=await snapshot(page);
 for(const value of ['', '   ', null]){dialogs.reason=value;await page.locator('#reopen').click();assert.match(dialogs.alerts.at(-1),/Informe o motivo/);assert.deepEqual(await snapshot(page),before);assert.equal(await page.evaluate(()=>canEdit()),false)}
 dialogs.reason='Motivo válido';dialogs.confirm=false;await page.locator('#reopen').click();assert.deepEqual(await snapshot(page),before);assert.equal(await page.evaluate(()=>db.workflow),'approved');
}));
test('histórico antigo é preservado e motivo com HTML não é interpretado',()=>visit(async(page,dialogs)=>{
 await approved(page);await page.evaluate(()=>{db.events.unshift({when:'Histórico antigo',action:'Reaberto para correção'});persist();render()});const old=await page.evaluate(()=>JSON.stringify(db.events));
 await page.reload();await page.getByRole('button',{name:'Planejamento Acadêmico (simulação)',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.stringify(db.events)),old);
 dialogs.reason='<b>Motivo textual</b> & manter';await page.locator('#reopen').click();assert.equal(await page.evaluate(()=>JSON.stringify(db.events.slice(0,-1))),old);assert.match(await page.locator('#app').innerText(),/<b>Motivo textual<\/b> & manter/);assert.equal(await page.locator('b').filter({hasText:'Motivo textual'}).count(),0);
}));
