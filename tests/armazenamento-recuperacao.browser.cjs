// node --test tests/armazenamento-recuperacao.browser.cjs
// Requer Playwright e Chromium disponíveis no ambiente.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const k22='planejamento-enfermagem-g32047-v22',k21='planejamento-enfermagem-g32047-v21';let browser,server,url;
before(async()=>{const html=fs.readFileSync(path.join(__dirname,'../index.html'));server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']})});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))});
function dataset(label){return {records:[{id:label,cohort:'ENFM09',period:'9',shift:'manha',subjectCode:'9211',subjectName:'Supervisão',teacher:'doc2',manualN:1,parts:[{key:'theory',kind:'theory',label:'Supervisão em sala',group:'Turma inteira',teacher:'doc2',weeklyAssigned:0,n:1,day:'Segunda',start:'07:10',room:'A | 201',blocks:[[430,480]]}]}],extras:[],stages:[{id:'g1',cohort:'ENFM09',subjectCode:'9211',label:'Grupo A',location:'HGNI',students:12,people:[{id:'doc3',weeklyAssigned:7,schedule:[{day:'Sexta',start:'08:00',end:'13:00'}]}]}],active:['ENFM09'],workflow:'editing',comments:label,events:[{when:'anterior',action:'Reaberto para correção',reason:'Motivo preservado'}],observations:[{id:'o1',nucleus:'D',cohort:'ENFM09',subjectCode:'9211',subject:'Docência',text:'Preservar observação',status:'Validada'}],versions:[{when:'anterior',preservar:true}],customMetadata:{preservar:true}}}
async function visit(initial,fn){const context=await browser.newContext();try{await context.addInitScript(initial=>{if(sessionStorage.getItem('fixture-seeded'))return;for(const [key,value]of Object.entries(initial))localStorage.setItem(key,value);sessionStorage.setItem('fixture-seeded','yes')},initial);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(url);await fn(page);assert.deepEqual(errors,[])}finally{await context.close()}}
const originals=page=>page.evaluate(([k22,k21])=>({v22:localStorage.getItem(k22),v21:localStorage.getItem(k21)}),[k22,k21]);
async function downloadedJSON(page,id){const [d]=await Promise.all([page.waitForEvent('download'),page.locator('#'+id).click()]);return JSON.parse(fs.readFileSync(await d.path(),'utf8'))}
test('V22 válido prevalece sobre V21 e mantém dados e originais ao consultar e recarregar',async()=>{
 const v22=JSON.stringify(dataset('V22'),null,2),v21=JSON.stringify(dataset('V21'));
 await visit({[k22]:v22,[k21]:v21},async page=>{
 assert.equal(await page.evaluate(()=>db.comments),'V22');assert.equal(await page.locator('#storage-originals').count(),0);
 await page.getByRole('button',{name:'Conferência',exact:true}).click();assert.deepEqual(await originals(page),{v22,v21});await page.reload();assert.equal(await page.evaluate(()=>db.comments),'V22');assert.deepEqual(await originals(page),{v22,v21});
 });
});
test('V22 ausente utiliza V21 compatível; gravação explícita cria V22 sem modificar V21',async()=>{
 const source=dataset('V21'),v21=JSON.stringify(source,null,2);
 await visit({[k21]:v21},async page=>{
 assert.equal(await page.evaluate(()=>storageRecovery.blocked),false);assert.equal(await page.evaluate(()=>db.comments),'V21');assert.deepEqual(await originals(page),{v22:null,v21});
 await page.getByRole('button',{name:'📚 Docência',exact:true}).click();await page.locator('#extra').click();await page.locator('#nextra').fill('4');await page.locator('#saveextra').click();
 const stored=await originals(page);assert.equal(stored.v21,v21);const saved=JSON.parse(stored.v22);assert.deepEqual(saved.records,source.records);assert.deepEqual(saved.stages,source.stages);assert.deepEqual(saved.observations,source.observations);assert.deepEqual(saved.versions,source.versions);assert.equal(saved.extras[0].n,4);
 await page.reload();assert.equal(await page.evaluate(()=>db.extras[0].n),4);assert.equal((await originals(page)).v21,v21);
 });
});
test('V22 inválido com V21 válido abre recuperação protegida e exporta ambas as cópias sem sobrescrever',async()=>{
 const v22='{V22 original <script>não executar</script>',source=dataset('V21'),v21=JSON.stringify(source,null,2);
 await visit({[k22]:v22,[k21]:v21},async page=>{
 assert.match(await page.locator('h2').innerText(),/Recuperação segura/);assert.match(await page.locator('[role="alert"]').innerText(),/somente para consulta e exportação/);
 assert.equal(await page.evaluate(()=>canEdit()),false);assert.equal(await page.locator('input, select, textarea').count(),0);assert.equal(await page.locator('#submit,#approve,#saveextra,#sgsave').count(),0);
 assert.equal(await page.evaluate(()=>db.records[0].parts[0].weeklyAssigned),0);assert.equal(await page.evaluate(()=>db.stages[0].people[0].weeklyAssigned),7);
 const backup=await downloadedJSON(page,'storage-originals');assert.equal(backup.sources.find(s=>s.key===k22).raw,v22);assert.equal(backup.sources.find(s=>s.key===k21).raw,v21);
 const recovered=await downloadedJSON(page,'storage-recovered');assert.deepEqual(recovered,source);assert.deepEqual(await originals(page),{v22,v21});
 await page.evaluate(()=>persist());assert.deepEqual(await originals(page),{v22,v21});await page.reload();assert.match(await page.locator('h2').innerText(),/Recuperação segura/);assert.deepEqual(await originals(page),{v22,v21});
 });
});
for(const v21 of [null,'{V21 também inválido'])test('V22 inválido sem V21 recuperável '+JSON.stringify(v21)+' não cria planejamento vazio gravável',async()=>{
 const v22='{V22 quebrado',initial={[k22]:v22};if(v21!==null)initial[k21]=v21;
 await visit(initial,async page=>{assert.match(await page.locator('[role="alert"]').innerText(),/Não foi possível carregar/);assert.equal(await page.locator('#storage-recovered').count(),0);assert.equal(await page.evaluate(()=>canEdit()),false);await page.evaluate(()=>persist());assert.deepEqual(await originals(page),{v22,v21});const backup=await downloadedJSON(page,'storage-originals');assert.equal(backup.sources.find(s=>s.key===k22).raw,v22)});
});
test('V21 inválido com V22 ausente mantém origem e bloqueia gravação',async()=>{
 const v21='{V21 inválido';await visit({[k21]:v21},async page=>{assert.match(await page.locator('h2').innerText(),/Recuperação segura/);await page.evaluate(()=>persist());assert.deepEqual(await originals(page),{v22:null,v21})});
});
test('estrutura V22 desconhecida é preservada integralmente e não é descartada como vazia',async()=>{
 const v22=JSON.stringify({records:{dados:'não reconhecidos'},metadados:{preservar:true}}),v21=JSON.stringify(dataset('V21'));
 await visit({[k22]:v22,[k21]:v21},async page=>{assert.match(await page.locator('#app').innerText(),/records deve ser uma lista/);assert.equal(await page.evaluate(()=>storageRecovery.blocked),true);const backup=await downloadedJSON(page,'storage-originals');assert.equal(backup.sources.find(s=>s.key===k22).raw,v22);assert.deepEqual(await originals(page),{v22,v21})});
});
test('falha de gravação exibe proteção e conserva tanto original quanto edição em memória',async()=>{
 const v22=JSON.stringify(dataset('V22'));
 await visit({[k22]:v22},async page=>{
 await page.evaluate(k22=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===k22)throw new DOMException('Sem espaço','QuotaExceededError');return original.call(this,key,value)}},k22);
 await page.getByRole('button',{name:'📚 Docência',exact:true}).click();await page.locator('#extra').click();await page.locator('#nextra').fill('4');await page.locator('#saveextra').click();
 assert.match(await page.locator('[role="alert"]').innerText(),/gravação não foi confirmada/);assert.equal((await originals(page)).v22,v22);const recovered=await downloadedJSON(page,'storage-recovered');assert.equal(recovered.extras[0].n,4);const backup=await downloadedJSON(page,'storage-originals');assert.equal(backup.sources.find(s=>s.key===k22).raw,v22);
 });
});
