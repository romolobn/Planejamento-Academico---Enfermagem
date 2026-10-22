// node --test tests/*.test.cjs
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const k22='planejamento-enfermagem-g32047-v22',k21='planejamento-enfermagem-g32047-v21',k19='planejamento-enfermagem-g32047-v19';
function app(initial={},controls={}){
 const store=new Map(Object.entries(initial)),nodes=new Map(),reads=[],writes=[],alerts=[];
 const context=vm.createContext({console,Date,Math,alert:m=>alerts.push(m),localStorage:{getItem:k=>{reads.push(k);if(controls.readDenied===true||controls.readDenied===k)throw Error('SecurityError');return store.has(k)?store.get(k):null},setItem:(k,v)=>{if(controls.quota)throw Error('QuotaExceededError');writes.push([k,v]);store.set(k,v)}},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},querySelectorAll:()=>[]}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],context);
 return {run:s=>vm.runInContext(s,context),store,nodes,reads,writes,alerts,controls};
}
function data(){return {records:[{id:'r1',cohort:'ENFM09',period:'9',shift:'manha',subjectCode:'9211',subjectName:'Supervisão',teacher:'doc2',manualN:1,parts:[{key:'theory',kind:'theory',label:'Supervisão em sala',group:'Turma inteira',teacher:'doc2',weeklyAssigned:0,n:1,day:'Segunda',start:'07:10',room:'A | 201',blocks:[[430,480]]}]}],extras:[{id:'e1',teacher:'doc3',type:'NDE',n:3}],stages:[{id:'g1',cohort:'ENFM09',subjectCode:'9211',label:'Grupo A',location:'HGNI',students:12,people:[{id:'doc3',weeklyAssigned:7,schedule:[{day:'Sexta',start:'08:00',end:'13:00'}]}]}],active:['ENFM09'],workflow:'approved',comments:'Preservar comentário',events:[{when:'antigo',action:'Reaberto para correção',reason:'Motivo preservado'}],observations:[{id:'o1',nucleus:'D',cohort:'ENFM09',subjectCode:'9211',subject:'Docência',text:'Preservar',status:'Validada'}],versions:[{when:'anterior',records:[{preservado:true}]}],unknownMetadata:{preservar:'sem alteração'}}}
const raw=()=>JSON.stringify(data(),null,2);
test('V22 válido prevalece e não é regravado ou substituído por V21',()=>{
 const v22=raw(),a=app({[k22]:v22,[k21]:'{quebrado'});
 assert.equal(a.run('JSON.stringify(db)'),JSON.stringify(data()));assert.equal(a.run('storageRecovery.blocked'),false);assert.equal(a.run('storageRecovery.source'),k22);
 assert.deepEqual(a.reads,[k22]);assert.equal(a.store.get(k22),v22);assert.equal(a.writes.length,0);
});
test('V22 ausente migra V21 compatível sem alterar a chave de origem',()=>{
 const v21=raw(),a=app({[k21]:v21});assert.equal(a.run('storageRecovery.blocked'),false);assert.equal(a.run('storageRecovery.source'),k21);
 assert.equal(a.run('JSON.stringify(db)'),JSON.stringify(data()));assert.equal(a.store.has(k22),false);assert.equal(a.writes.length,0);
 a.run('persist()');assert.equal(a.store.get(k21),v21);assert.equal(a.store.get(k22),JSON.stringify(data()));assert.equal(a.writes.length,1);
});
test('V22 inválido recupera V21 somente para consulta/exportação e preserva os dois originais',()=>{
 const invalid='{V22 quebrado',v21=raw(),a=app({[k22]:invalid,[k21]:v21});
 assert.equal(a.run('storageRecovery.blocked'),true);assert.equal(a.run('storageRecovery.source'),k21);assert.equal(a.run('JSON.stringify(db)'),JSON.stringify(data()));assert.equal(a.run('canEdit()'),false);
 a.run('persist()');assert.equal(a.store.get(k22),invalid);assert.equal(a.store.get(k21),v21);assert.equal(a.writes.length,0);
 assert.match(a.nodes.get('app').innerHTML,/somente para consulta e exportação/);assert.match(a.nodes.get('app').innerHTML,/planejamento-enfermagem-g32047-v21/);assert.doesNotMatch(a.nodes.get('app').innerHTML,/<button id="(?:saveextra|submit|approve|reopen)"/);
});
test('backup exportável preserva texto bruto inclusive JSON inválido e caracteres especiais',()=>{
 const invalid='\u0000{ "dados": "<b>&\ud800"',v21=raw(),a=app({[k22]:invalid,[k21]:v21});
 const bundle=JSON.parse(a.run('storageOriginalsDocument()'));
 assert.equal(bundle.sources.find(s=>s.key===k22).raw,invalid);assert.equal(bundle.sources.find(s=>s.key===k21).raw,v21);
 assert.equal(a.writes.length,0);
});
test('cópia recuperada usa a migração V21 existente e não perde núcleos, cargas, aprovações ou motivos',()=>{
 const a=app({[k22]:'{bad',[k21]:raw()});a.run('globalThis.downloaded=[];downloadRecoveryFile=(name,text)=>downloaded.push({name,text})');
 a.nodes.get('storage-recovered').onclick();const downloaded=JSON.parse(a.run('JSON.stringify(downloaded)'));
 assert.equal(downloaded[0].name,'planejamento_copia_recuperada.json');assert.deepEqual(JSON.parse(downloaded[0].text),data());assert.equal(a.writes.length,0);
});
for(const v21 of [null,'{também quebrado',JSON.stringify({records:{não:'lista'}})])test('V22 inválido sem V21 recuperável '+JSON.stringify(v21)+' mantém bloqueio e originais',()=>{
 const initial={[k22]:'{V22 original'};if(v21!==null)initial[k21]=v21;const a=app(initial);
 assert.equal(a.run('storageRecovery.blocked'),true);assert.equal(a.run('storageRecovery.preview'),false);a.run('persist()');
 assert.deepEqual(Object.fromEntries(a.store),initial);assert.equal(a.writes.length,0);assert.equal(a.nodes.has('storage-recovered'),false);
 assert.match(a.nodes.get('app').innerHTML,/Não foi possível carregar/);
});
test('V21 inválido com V22 ausente não cria V22 vazio',()=>{
 const a=app({[k21]:'{quebrado'});assert.equal(a.run('storageRecovery.blocked'),true);a.run('persist()');assert.equal(a.store.has(k22),false);assert.equal(a.store.get(k21),'{quebrado');
});
for(const invalid of ['', 'null','false','[]','{}','{"records":null}','{"records":{},"stages":[]}','{"records":[],"stages":null}','{"records":[{"parts":null}]}','{"records":[],"stages":[{"people":{}}]}','{"records":[],"stages":[{"people":[{"schedule":null}]}]}','{"records":[],"events":[null]}','{"records":[],"workflow":"desconhecido"}','{"records":[],"unknown":1e999}'])
 test('estrutura V22 '+JSON.stringify(invalid)+' não autoriza descarte ou substituição',()=>{
 const a=app({[k22]:invalid,[k21]:raw()});assert.equal(a.run('storageRecovery.blocked'),true);assert.equal(a.run('storageRecovery.source'),k21);assert.equal(a.store.get(k22),invalid);a.run('persist()');assert.equal(a.store.get(k22),invalid);assert.equal(a.writes.length,0);
});
test('falha de estrutura de V21 não é ignorada para iniciar um planejamento vazio editável',()=>{
 const bad=JSON.stringify({records:[],extras:'dados não reconhecidos'}),a=app({[k21]:bad});assert.equal(a.run('storageRecovery.blocked'),true);assert.equal(a.run('canEdit()'),false);assert.equal(a.store.get(k21),bad);assert.equal(a.store.has(k22),false);
});
test('dados academicamente incompletos mas estruturalmente reconhecidos permanecem intactos',()=>{
 const source=data();source.records[0].parts[0].weeklyAssigned='';source.records[0].parts[0].blocks=null;const value=JSON.stringify(source),a=app({[k22]:value});
 assert.equal(a.run('storageRecovery.blocked'),false);assert.equal(a.run('getStatus(db.records[0])'),'Parcial');assert.equal(a.run('JSON.stringify(db)'),value);assert.equal(a.store.get(k22),value);assert.equal(a.writes.length,0);
});
test('V21 com campos opcionais ausentes recebe os mesmos padrões, sem preencher cargas',()=>{
 const source={records:[],extras:[],stages:[{id:'g',people:[{id:'doc2',schedule:[]}]}]},value=JSON.stringify(source),a=app({[k21]:value});
 assert.equal(a.run('storageRecovery.blocked'),false);assert.equal(a.run('db.stages[0].people[0].weeklyAssigned'),undefined);assert.equal(a.run('db.workflow'),'editing');assert.equal(a.run('db.events.length'),0);assert.equal(a.store.get(k21),value);
});
test('V19 compatível continua convertendo IDs em memória sem apagar ou regravar a origem',()=>{
 const source={records:[{teacher:'doc4',parts:[{teacher:'doc4'}]}],extras:[{teacher:'doc5'}],events:[]},value=JSON.stringify(source),a=app({[k19]:value});
 assert.equal(a.run('storageRecovery.blocked'),false);assert.equal(a.run('db.records[0].teacher'),'staff-84002');assert.equal(a.run('db.extras[0].teacher'),'staff-78027');assert.equal(a.store.get(k19),value);assert.equal(a.store.has(k22),false);
});
test('ausência de todas as chaves permite novo planejamento sem gravar na abertura',()=>{
 const a=app();assert.equal(a.run('storageRecovery.blocked'),false);assert.equal(a.run('canEdit()'),true);assert.equal(a.writes.length,0);a.run('persist()');assert.equal(a.store.has(k22),true);
});
test('chave V22 modificada após carregar bloqueia sobrescrita e preserva as duas versões',()=>{
 const original=raw(),changed='{mudança externa',a=app({[k22]:original});a.store.set(k22,changed);a.run('persist()');
 assert.equal(a.run('storageRecovery.blocked'),true);assert.equal(a.store.get(k22),changed);assert.equal(a.writes.length,0);
 const bundle=JSON.parse(a.run('storageOriginalsDocument()'));assert.ok(bundle.sources.some(s=>s.raw===original));assert.ok(bundle.sources.some(s=>s.raw===changed));
});
test('falha de gravação mantém original e disponibiliza a cópia em memória sem afirmar sucesso',()=>{
 const value=raw(),controls={quota:true},a=app({[k22]:value},controls);a.run("db.comments='Edição ainda não salva';persist()");
 assert.equal(a.run('storageRecovery.blocked'),true);assert.equal(a.store.get(k22),value);assert.match(a.nodes.get('app').innerHTML,/gravação não foi confirmada/);assert.equal(a.run('db.comments'),'Edição ainda não salva');
});
test('falha de acesso ao armazenamento é sinalizada, sem tentativa de escrita',()=>{
 const a=app({[k22]:raw()},{readDenied:true});assert.equal(a.run('storageRecovery.blocked'),true);assert.equal(a.run('storageRecovery.preview'),false);a.run('persist()');assert.equal(a.writes.length,0);
 const bundle=JSON.parse(a.run('storageOriginalsDocument()'));assert.ok(bundle.sources.every(s=>s.status==='unreadable'&&s.raw===null));
});
test('recarregar a recuperação não altera nenhuma chave ou histórico',()=>{
 const initial={[k22]:'{quebrado',[k21]:raw()},a=app(initial),b=app(Object.fromEntries(a.store));assert.equal(a.run('JSON.stringify(db)'),b.run('JSON.stringify(db)'));assert.deepEqual(Object.fromEntries(b.store),initial);assert.equal(b.writes.length,0);
});
