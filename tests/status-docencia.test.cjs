// node --test tests/*.test.cjs
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const key='planejamento-enfermagem-g32047-v22';
function app(saved){
 const nodes=new Map(),store=new Map(),alerts=[];
 if(saved)store.set(key,JSON.stringify(saved));
 const ctx=vm.createContext({console,Date,Math,alert:m=>alerts.push(m),confirm:()=>true,prompt:()=> 'Revisão',
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},querySelectorAll:()=>[]}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 const run=s=>vm.runInContext(s,ctx);return {run,nodes,store,alerts,click:id=>nodes.get(id).onclick()};
}
function complete(a,id='staff-84002'){a.run(`db.active=['ENFM09'];professor='${id}';allExpected().forEach((x,i)=>{startNew(x.cohort,x.subjectCode);draft.parts=[toStored({...partValue(0),weeklyAssigned:0,day:days[i]},0)];saveDraft()});db.stages=stageExpected().map((x,i)=>({id:'g'+i,cohort:x.cohort,subjectCode:x.subjectCode,label:'Grupo A',location:'HGNI',students:12,people:[{id:'doc2',weeklyAssigned:0,schedule:[{day:'Segunda',start:'07:00',end:'13:00'}]}]}));go('conference')`);assert.equal(a.run('planningValidation().valid'),true)}
function entry(a,index=0){return a.run(`planningValidation().entries.find(x=>x.nucleus==='D'&&x.cohort===db.records[${index}].cohort&&x.subjectCode===db.records[${index}].subjectCode).status`)}
function reject(a){
 const before=a.run('JSON.stringify(db)');a.run("go('conference')");assert.equal(a.run('getStatus(db.records[0])'),'Parcial');assert.equal(entry(a),'Parcial');
 a.click('submit');assert.equal(a.run('db.workflow'),'editing');assert.equal(a.run('JSON.stringify(db)'),before);
 a.run("db.workflow='submitted';go('admin')");a.click('approve');assert.equal(a.run('db.workflow'),'submitted');assert.equal(a.run('db.versions.length'),0);
}
test('planejamento válido com zero explícito é completo, enviável e aprovável',()=>{
 const a=app();complete(a);assert.equal(a.run('getStatus(db.records[0])'),'Completa');assert.equal(entry(a),'Completa');
 a.click('submit');a.run("go('admin')");a.click('approve');assert.equal(a.run('db.workflow'),'approved');
});
for(const value of ['',null,-1,1.5])test('carga '+JSON.stringify(value)+' não resulta em status completo',()=>{
 const a=app();complete(a);a.run(`db.records[0].parts[0].weeklyAssigned=${JSON.stringify(value)}`);reject(a);
});
for(const mutation of ["p.blocks=[[1,2]]","p.start='23:00'","delete p.teacher","p.room=''","delete p.room"])
 test('status e fluxo rejeitam '+mutation,()=>{const a=app();complete(a);a.run(`{let p=db.records[0].parts[0];${mutation}}`);reject(a)});
test('múltiplos professores válidos são completos; invalidar apenas um torna o principal parcial',()=>{
 const a=app();complete(a);a.run("editRecord(db.records[0].id);addDocTeacher();updatePart(step,'weeklyAssigned',7);updatePart(step,'day','Terça');updatePart(step,'start','08:50');addDocTeacher();updatePart(step,'weeklyAssigned',3);updatePart(step,'day','Quarta');updatePart(step,'start','08:50');saveDraft()");
 assert.equal(a.run('getStatus(db.records[0])'),'Completa');assert.equal(entry(a),'Completa');
 a.run("db.records[0].parts[2].weeklyAssigned=''");reject(a);
});
for(const type of ['professor','sala','turma'])test('conflito de '+type+' torna parcial sem mudar regras de horários',()=>{
 const a=app();complete(a);
 if(type==='turma')a.run("db.records[1].parts[0].day='Segunda';db.records[1].parts[0].teacher='staff-78027';db.records[1].parts[0].room=rooms[1]");
 else a.run(`{let r=JSON.parse(JSON.stringify(db.records[0]));r.id='outro-periodo';r.cohort='ENFM10';r.period='10';r.subjectCode='8162';r.subjectName=subject('8162','10')[1];r.parts[0].teacher='${type==='professor'?'staff-84002':'staff-78027'}';r.parts[0].room=rooms[${type==='professor'?1:0}];db.active.push('ENFM10');db.records.push(r)}`);
 const errors=a.run('docenciaReview(db.records[0]).errors.join(" | ")');assert.match(errors,new RegExp(type==='professor'?'Professor':type==='sala'?'Sala':'Turma'));
 assert.equal(a.run('docenciaErrors(db.records[0]).length'),0);reject(a);
});
test('conflito interno entre professores de supervisão é parcial',()=>{
 const a=app();complete(a);a.run("editRecord(db.records[0].id);addDocTeacher();updatePart(step,'weeklyAssigned',7);updatePart(step,'day','Segunda');updatePart(step,'room',rooms[1]);saveDraft()");
 assert.equal(a.run('docenciaErrors(db.records[0]).length'),0);reject(a);
});
test('duplicidade legada também produz status compatível com a Conferência',()=>{
 const a=app();complete(a);a.run("{let r=JSON.parse(JSON.stringify(db.records[0]));r.id='duplicado';r.parts[0].day='Sexta';r.parts[0].start='10:40';r.parts[0].blocks=calc('10:40',1,'manha');db.records.push(r)}");
 assert.equal(a.run('planningValidation().conflicts.length'),0);assert.match(a.run('docenciaReview(db.records[0]).errors.join(" ")'),/duplicados/);reject(a);
});
test('teoria e grupos práticos completos permanecem válidos; falta de um grupo é parcial',()=>{
 const a=app();a.run("db.active=['ENFM05'];startNew('ENFM05','8938');draft.groups=2;draft.parts=chooseParts().map((s,i)=>toStored({...partValue(i),teacher:P[i+2][0],day:i===0?'Segunda':'Terça',room:rooms[i]},i));saveDraft()");
 assert.equal(a.run('getStatus(db.records[0])'),'Completa');assert.equal(entry(a),'Completa');
 a.run('db.records[0].parts.pop()');assert.equal(a.run('getStatus(db.records[0])'),'Parcial');assert.equal(entry(a),'Parcial');
});
for(const id of ['doc2','doc3'])test(id+' continua completo, enviável e aprovável',()=>{
 const a=app();complete(a,id);assert.equal(a.run('getStatus(db.records[0])'),'Completa');a.click('submit');a.run("go('admin')");a.click('approve');assert.equal(a.run('db.workflow'),'approved');
});
test('Campo incompleto não é confundido com a validade de Docência',()=>{
 const a=app();complete(a);a.run("db.stages[0].people[0].weeklyAssigned=''");
 assert.equal(a.run('getStatus(db.records[0])'),'Completa');assert.equal(entry(a),'Completa');
 assert.equal(a.run("planningValidation().entries.find(x=>x.nucleus==='E').status"),'Parcial');assert.equal(a.run('planningValidation().valid'),false);
});
test('dados antigos inconsistentes são sinalizados sem migração, correção ou invalidação de aprovação anterior',()=>{
 const a=app();complete(a);a.run("db.records[0].parts[0].weeklyAssigned='';db.records[0].parts[0].blocks=[[1,2]];db.workflow='approved';db.versions=[{when:'antiga',preservar:true}];persist()");
 const saved=JSON.parse(a.store.get(key)),b=app(saved);b.run("go('conference');getStatus(db.records[0])");
 assert.equal(b.run('getStatus(db.records[0])'),'Parcial');assert.equal(b.run('db.workflow'),'approved');assert.equal(b.run('JSON.stringify(db)'),JSON.stringify(saved));assert.equal(b.store.get(key),JSON.stringify(saved));
});
test('conflitos de turmas não ofertadas não alteram o status das exigências ofertadas',()=>{
 const a=app();complete(a);a.run("{let r=JSON.parse(JSON.stringify(db.records[0]));r.id='inativo';r.cohort='ENFM10';r.period='10';r.subjectCode='8162';db.records.push(r)}");
 assert.equal(a.run('getStatus(db.records[0])'),'Completa');assert.equal(entry(a),'Completa');assert.equal(a.run('planningValidation().valid'),true);
});
test('status é somente leitura e não muda cargas, grade salarial ou exportações',()=>{
 const a=app();complete(a);const before=a.run('JSON.stringify(db)'),salary=a.run('JSON.stringify(salaryRows(P[2][0]))'),xml=a.run('excelDocument()');
 a.run('db.records.forEach(getStatus);planningValidation();db.records.forEach(getStatus)');
 assert.equal(a.run('JSON.stringify(db)'),before);assert.equal(a.run('JSON.stringify(salaryRows(P[2][0]))'),salary);assert.equal(a.run('excelDocument()'),xml);
});
