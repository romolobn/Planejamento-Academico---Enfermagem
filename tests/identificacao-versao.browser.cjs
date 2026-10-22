// node --test tests/identificacao-versao.browser.cjs
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');let server,browser,url;
const k22='planejamento-enfermagem-g32047-v22',k21='planejamento-enfermagem-g32047-v21';
before(async()=>{const html=fs.readFileSync(path.join(__dirname,'../index.html'));server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']})});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))});
async function visit(initial,fn){const context=await browser.newContext();try{await context.addInitScript(initial=>{for(const [key,value]of Object.entries(initial))localStorage.setItem(key,value)},initial);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await fn(page);assert.deepEqual(errors,[])}finally{await context.close()}}
test('interface identifica Protótipo 22 na abertura e não apresenta identificação atual V21 nos módulos',()=>visit({},async page=>{
 assert.match(await page.locator('.header-subtitle').innerText(),/Protótipo 22/);assert.match(await page.locator('#app').innerText(),/Protótipo 22 de testes/);assert.doesNotMatch(await page.locator('body').innerText(),/(?:Versão|Protótipo) 21/i);
 for(const screen of ['home','stage','conference','admin','summary','salary','extra','choose']){await page.evaluate(screen=>go(screen),screen);assert.doesNotMatch(await page.locator('body').innerText(),/(?:Versão|Protótipo) 21/i)}
 assert.equal(await page.evaluate(()=>localStorage.length),0);
}));
test('chaves V22 e V21 e referências históricas documentadas permanecem intactas',()=>visit({},async page=>{
 assert.deepEqual(await page.evaluate(()=>[key,previousKey]),[k22,k21]);const readme=fs.readFileSync(path.join(__dirname,'../README.md'),'utf8');assert.match(readme,/Conferência da V21 mantidas/);assert.match(readme,/versão 22 importa os dados da versão 21/);
}));
test('V22 inválido continua permitindo consulta protegida do V21 sem alterar originais',()=>{
 const v22='{original V22 inválido',v21=JSON.stringify({records:[],extras:[{id:'e1',teacher:'doc2',type:'NDE',n:3}],active:['ENFT09'],comments:'Contexto histórico V21 preservado'});
 return visit({[k22]:v22,[k21]:v21},async page=>{
 assert.match(await page.locator('.header-subtitle').innerText(),/Protótipo 22/);assert.match(await page.locator('#app').innerText(),/Recuperação segura do armazenamento/);assert.equal(await page.evaluate(()=>storageRecovery.blocked),true);assert.equal(await page.evaluate(()=>storageRecovery.source),k21);assert.equal(await page.evaluate(()=>db.comments),'Contexto histórico V21 preservado');assert.equal(await page.evaluate(()=>db.extras[0].n),3);assert.equal(await page.evaluate(()=>canEdit()),false);assert.deepEqual(await page.evaluate(([a,b])=>[localStorage.getItem(a),localStorage.getItem(b)],[k22,k21]),[v22,v21]);
 });
});
