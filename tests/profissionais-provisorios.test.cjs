// node --test tests/*.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const key='planejamento-enfermagem-g32047-v22';
function app(saved){
 const nodes=new Map(),storage=new Map(),alerts=[];
 if(saved)storage.set(key,JSON.stringify(saved));
 const ctx=vm.createContext({console,Date,Math,alert:m=>alerts.push(m),confirm:()=>true,prompt:()=> 'Revisar planejamento',
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},querySelectorAll:()=>[]}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 const run=s=>vm.runInContext(s,ctx);
 return {run,nodes,storage,alerts,click:id=>nodes.get(id).onclick()};
}
function populate(a,ids=['doc2','doc3','staff-84002']){a.run(`
 db.active=['ENFM09'];
 const ids=${JSON.stringify(ids)};
 allExpected().forEach((x,i)=>{
  professor=ids[i%ids.length];startNew(x.cohort,x.subjectCode);
  draft.parts=[toStored({...partValue(0),teacher:professor,weeklyAssigned:i+1,day:days[i]},0)];saveDraft();
 });
 db.stages=stageExpected().map((x,i)=>({id:'g'+i,cohort:x.cohort,subjectCode:x.subjectCode,label:'Grupo A',location:stageLocations[0],students:10,people:[{id:ids[i%ids.length],weeklyAssigned:i+2,schedule:[{day:'Segunda',start:'07:00',end:'13:00'}]}]}));
 db.extras=ids.map((id,i)=>({id:'e'+i,teacher:id,type:'NDE',n:[3,4,6][i]}));go('conference');
 `);assert.equal(a.run('planningValidation().valid'),true);}
test('identifica provisórios por doc2/doc3, sem classificar profissionais reais pelo texto',()=>{
 const a=app();assert.equal(a.run("P.find(p=>p[0]==='doc2')[1]"),'A DEFINIR');assert.equal(a.run("P.find(p=>p[0]==='doc3')[1]"),'EM CONTRATAÇÃO');
 assert.equal(a.run("isProvisionalProfessional('doc2')"),true);assert.equal(a.run("isProvisionalProfessional('doc3')"),true);
 a.run("P.find(p=>p[0]==='staff-84002')[1]='A DEFINIR'");assert.equal(a.run("isProvisionalProfessional('staff-84002')"),false);assert.equal(a.run("isSalaryProfessional('staff-84002')"),true);
});
for(const id of ['doc2','doc3'])test(id+' pode preencher os três núcleos, ser enviado e aprovado',()=>{
 const a=app();populate(a,[id]);a.click('submit');assert.equal(a.run('db.workflow'),'submitted');a.run("go('admin')");a.click('approve');assert.equal(a.run('db.workflow'),'approved');
 assert.equal(a.run('db.versions[0].records.every(r=>r.parts.every(p=>p.teacher===\''+id+'\'))'),true);
 assert.equal(a.run('db.versions[0].stages.every(g=>g.people.every(p=>p.id===\''+id+'\'))'),true);
 a.run("go('salary')");assert.doesNotMatch(a.nodes.get('app').innerHTML,/A DEFINIR|EM CONTRATAÇÃO|class="salary-person"/);
 assert.equal(a.run('excelRows(true).length'),1);
});
test('seletores de cadastro e consulta de Campo oferecem ambos os IDs provisórios',()=>{
 const a=app();a.run("db.active=['ENFM09'];go('stage');stageNew()");
 let html=a.nodes.get('app').innerHTML;
 assert.match(html,/<option value="doc2"/);assert.match(html,/<option value="doc3"/);assert.match(html,/provisório/);
 a.run("sgDraft.students=10;sgDraft.people=[{id:'doc2',weeklyAssigned:0,schedule:[{day:'Segunda',start:'07:00',end:'13:00'}]},{id:'doc3',weeklyAssigned:4,schedule:[{day:'Segunda',start:'07:00',end:'13:00'}]}]");
 assert.equal(a.run('Boolean(stageComplete(sgDraft))'),true);
 a.run("stageTab='load';go('stage')");html=a.nodes.get('app').innerHTML;assert.match(html,/<option value="doc2"/);assert.match(html,/<option value="doc3"/);
});
test('totais de planejamento incluem provisórios nos três núcleos; Grade Salarial inclui somente identificados',()=>{
 const a=app();populate(a);
 assert.equal(a.run('planningValidation().loads.sala'),17);assert.equal(a.run('planningValidation().loads.campo'),20);
 assert.equal(a.run('P.reduce((n,p)=>n+extra(p[0]),0)'),13);
 assert.equal(a.run("JSON.stringify(professionalLoadTotals(['doc2','doc3']))"),'{"sala":12,"extra":7,"campo":16}');
 assert.equal(a.run("JSON.stringify(professionalLoadTotals(['staff-84002']))"),'{"sala":5,"extra":6,"campo":4}');
 assert.match(a.nodes.get('app').innerHTML,/diferença é intencional/);
 a.run("go('salary')");const html=a.nodes.get('app').innerHTML;
 assert.doesNotMatch(html,/A DEFINIR|EM CONTRATAÇÃO/);assert.match(html,/ALEXANDRE GONCALVES/);
 assert.match(html,/docência 5 tempos semanais; extraclasse 6 tempos semanais; estágio 4/);
 assert.match(html,/Dentro de Sala 12; Extraclasse 7; Campo 16/);
 assert.match(html,/2 atribuições de aula • 1 extraclasse • 1 atribuições de estágio/);
});
test('Excel salarial exclui provisórios de todos os núcleos, mas exportação geral os preserva e identifica',()=>{
 const a=app();populate(a);
 const salary=JSON.parse(a.run('JSON.stringify(excelRows(true))'));
 assert.equal(salary.length,5);assert.ok(salary.slice(1).every(r=>r[7]==='ALEXANDRE GONCALVES'));
 assert.deepEqual(salary.slice(1).map(r=>r[0]),['DENTRO DE SALA','DENTRO DE SALA','ATIVIDADES EXTRACLASSE','ESTÁGIO']);
 const general=JSON.parse(a.run('JSON.stringify(excelRows())'));
 assert.equal(general.length,15);assert.ok(general.some(r=>r[7]==='A DEFINIR (provisório)'&&r[9]==='Provisório'));
 assert.ok(general.some(r=>r[7]==='EM CONTRATAÇÃO (provisório)'&&r[9]==='Provisório'));
 const xml=a.run('excelDocument(true)');assert.doesNotMatch(xml,/A DEFINIR|EM CONTRATAÇÃO/);assert.match(xml,/Grade Salarial 2027.1/);assert.match(xml,/Critérios/);
 assert.match(a.run('excelDocument()'),/A DEFINIR/);assert.match(a.run('excelDocument()'),/Planejamento 2027.1/);
});
test('resumos de planejamento identificam as cargas provisórias',()=>{
 const a=app();populate(a);a.run("go('summary')");assert.match(a.nodes.get('app').innerHTML,/A DEFINIR \(provisório\)/);assert.match(a.nodes.get('app').innerHTML,/EM CONTRATAÇÃO \(provisório\)/);
 assert.equal(a.run("classification('doc2')"),'Provisório');assert.equal(a.run("classification('doc3')"),'Provisório');
});
test('profissional real do cadastro anterior continua disponível na grade e no Excel salarial',()=>{
 const a=app();populate(a);a.run("db.extras.push({id:'legado',teacher:'doc12',type:'NDE',n:2});go('salary')");
 assert.match(a.nodes.get('app').innerHTML,/CARLOS EDUARDO MOREIRA GUARIDO/);
 assert.equal(a.run("excelRows(true).some(r=>r[7]==='CARLOS EDUARDO MOREIRA GUARIDO')"),true);
});
test('recarga e reabertura mantêm IDs, cargas e três núcleos sem conversão ou perda',()=>{
 const a=app();populate(a);a.click('submit');a.run("go('admin')");a.click('approve');
 const saved=JSON.parse(a.storage.get(key));const b=app(saved);
 for(const field of ['records','extras','stages','versions'])assert.equal(b.run('JSON.stringify(db.'+field+')'),JSON.stringify(saved[field]));
 b.run("go('admin')");b.click('reopen');assert.equal(b.run('db.workflow'),'editing');
 for(const field of ['records','extras','stages','versions'])assert.equal(b.run('JSON.stringify(db.'+field+')'),JSON.stringify(saved[field]));
 assert.equal(b.run('planningValidation().loads.sala'),17);assert.equal(b.run('planningValidation().loads.campo'),20);
});
test('abrir grade e produzir os dois tipos de exportação não modifica registros',()=>{
 const a=app();populate(a);const before=a.run('JSON.stringify(db)');a.run("go('salary');excelDocument(true);excelDocument();go('summary')");assert.equal(a.run('JSON.stringify(db)'),before);
});
test('provisórios não dispensam carga válida, sala ou verificação de conflito de turma',()=>{
 const a=app();populate(a,['doc2']);a.run("db.records[0].parts[0].weeklyAssigned='';go('conference')");assert.equal(a.run('planningValidation().valid'),false);
 a.run("db.records[0].parts[0].weeklyAssigned=1;db.records[0].parts[0].room='inválida'");assert.equal(a.run('planningValidation().valid'),false);
 a.run("db.records[0].parts[0].room=rooms[0];db.records[1].parts[0].day=db.records[0].parts[0].day");
 assert.equal(a.run('planningValidation().valid'),false);assert.ok(a.run('planningValidation().conflicts.some(x=>x.includes(\'Turma\'))'));
});
