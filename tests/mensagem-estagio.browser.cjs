const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');let browser,server,url;
const message='As cargas individuais de Docência — Dentro de Sala e Estágio — Campo são registradas e apuradas separadamente.';
before(async()=>{const html=fs.readFileSync(path.join(__dirname,'../index.html'));server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']})});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))});
async function visit(fn){const ctx=await browser.newContext();try{const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await fn(page);assert.deepEqual(errors,[])}finally{await ctx.close()}}
test('Docência apresenta orientação atual e módulos não afirmam ausência da apuração de Estágio',()=>visit(async page=>{
 await page.getByRole('button',{name:'📚 Docência',exact:true}).click();assert.ok((await page.locator('#app').innerText()).includes(message));const obsolete=/(?:não|nao) implementad[oa]|apura[çc][ãa]o[^.\n]{0,100}(?:indispon[ií]vel|inexistente)/i;
 for(const screen of ['home','stage','summary','conference','admin','salary','choose']){await page.evaluate(screen=>go(screen),screen);assert.doesNotMatch(await page.locator('#app').innerText(),obsolete)}
 assert.equal(await page.evaluate(()=>localStorage.length),0);
}));
test('consulta preserva cargas separadas, cálculos, documentos, armazenamento e históricos',()=>visit(async page=>{
 await page.evaluate(()=>{db.active=['ENFM09'];startNew('ENFM09','9211');draft.parts=[toStored({...partValue(0),weeklyAssigned:7,day:'Segunda'},0)];saveDraft();db.stages=[{id:'g1',label:'Grupo A',cohort:'ENFM09',subjectCode:'9211',location:'HGNI',students:12,people:[{id:P[2][0],weeklyAssigned:4,schedule:[{day:'Segunda',start:'07:00',end:'13:00'}]}]}];db.extras=[{id:'e1',teacher:P[2][0],type:'NDE',n:3}];db.events=[{when:'Anterior',action:'Reaberto para correção',reason:'Preservar motivo'}];db.versions=[{when:'Anterior',records:[]}];persist()});
 const snapshot=()=>page.evaluate(()=>({data:JSON.stringify(db),storage:localStorage.getItem(key),salary:salaryView(),general:excelDocument(),specific:excelDocument(true),totals:professionalLoadTotals(assignedProfessionalIds())}));const before=await snapshot();assert.deepEqual(before.totals,{sala:7,extra:3,campo:4});await page.evaluate(()=>go('home'));assert.ok((await page.locator('#app').innerText()).includes(message));for(const screen of ['summary','stage','home'])await page.evaluate(screen=>go(screen),screen);assert.deepEqual(await snapshot(),before);await page.reload();await page.evaluate(()=>go('home'));assert.ok((await page.locator('#app').innerText()).includes(message));assert.deepEqual(await snapshot(),before);
}));
