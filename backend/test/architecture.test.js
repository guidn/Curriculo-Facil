'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createAuthUseCases}=require('../src/application/auth-use-cases');
const {createResumeUseCases}=require('../src/application/resume-use-cases');
const {createUsageUseCases}=require('../src/application/usage-use-cases');
const {capacity,presentationIsValid}=require('../src/domain/resume-policy');
const {normalizeResumeProfile}=require('../src/domain/profile');
const {normalizeResumeData}=require('../src/domain/resume-data');
const rendering=require('../../js/resume-rendering');

test('domain policies stay independent of HTTP and SQLite',()=>{
  assert.deepEqual(capacity(2,{resumeLimit:2}),{current:2,limit:2,available:0});
  assert.equal(capacity(9,{resumeLimit:null}).available,null);
  assert.equal(presentationIsValid('modern','#742cff'),true);
  assert.equal(presentationIsValid('unknown','#742cff'),false);
  assert.equal(normalizeResumeProfile({skills:'Excel, vendas'}).skills.length,2);
  assert.throws(()=>normalizeResumeProfile({experiences:[{startDate:'2025-03-01',endDate:'2024-03-01'}]}),/posterior/);
});

test('structured resume data keeps legacy fields and optional sections',()=>{
  const resume=normalizeResumeData({name:'Ana',role:'Designer',education:[{course:'Design',school:'Universidade'}],skills:'Figma, Pesquisa',projects:[{name:'App',technologies:['Figma']}]});
  assert.equal(resume.personal.name,'Ana');
  assert.equal(resume.personal.headline,'Designer');
  assert.equal(resume.education[0].institution,'Universidade');
  assert.deepEqual(resume.skills,['Figma','Pesquisa']);
  assert.equal(resume.projects[0].technologies[0],'Figma');
  assert.throws(()=>normalizeResumeData({experiences:[{startDate:'2025-02-30'}]}),/datas válidas/);
  assert.throws(()=>normalizeResumeData({education:[{startDate:'2025-03-01',endDate:'2024-03-01'}]}),/posterior/);
  const html=rendering.renderBody(resume);
  assert.match(html,/Formação acadêmica/);
  assert.doesNotMatch(html,/Experiência profissional|Cursos|Certificações/,'empty sections are omitted');
  for(const template of ['modern','classic','minimal','executive','creative'])assert.match(rendering.renderDocument({template,data:resume}),new RegExp(`template-${template}`));
  assert.match(rendering.toText({title:'Ana',data:resume}),/HABILIDADES/);
});

test('fictional demo resume retains every section in all five renderer templates',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const demo=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/demo-resume.json'),'utf8'));
  assert.equal(demo.data.experiences.length,2);
  assert.equal(demo.data.education.length,2);
  assert.equal(demo.data.courses.length,3);
  assert.equal(demo.data.skills.length,8);
  assert.equal(demo.data.languages.length,2);
  assert.equal(demo.data.projects.length,2);
  assert.equal(demo.data.certifications.length,2);
  for(const template of ['modern','classic','minimal','executive','creative']){
    const html=rendering.renderDocument({...demo,template});
    for(const content of ['Ana Ribeiro','Nuvem Exemplo','Universidade Metropolitana','Fundamentos de Product Management','Product Analytics Essentials','Central de indicadores','Inglês'])assert.ok(html.includes(content),`${template} omitted ${content}`);
  }
  const escaped=rendering.renderBody({name:'<script>alert(1)</script>',summary:'A & B'});
  assert.doesNotMatch(escaped,/<script>/);
  assert.match(escaped,/A &amp; B/);
});

test('new resume wizard includes a separate review stage and uses the shared renderer',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'../../pages/builder/novo-curriculo.html'),'utf8');
  const controller=fs.readFileSync(path.join(__dirname,'../../js/features/new-resume.mjs'),'utf8');
  assert.match(html,/data-wizard-step="4"/);
  assert.match(html,/data-final-preview/);
  assert.match(controller,/ResumeRendering\.renderBody/);
  assert.match(controller,/activeStep !== panels\.length - 1/);
});

test('model library keeps real renderer previews and carries template choice into signup',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'../../pages/builder/modelos.html'),'utf8');
  const feature=fs.readFileSync(path.join(__dirname,'../../js/features/billing.mjs'),'utf8');
  const auth=fs.readFileSync(path.join(__dirname,'../../js/features/auth.mjs'),'utf8');
  assert.match(html,/css\/pages\/resume-renderer\.css/);
  assert.match(feature,/ResumeRendering\.renderBody/);
  assert.match(feature,/\.\.\/auth\/cadastro\.html/);
  assert.match(auth,/routeAfterAuth/);
});

test('authentication use cases depend on repository and security ports',async()=>{
  const records={users:[],sessions:[],resets:[]};
  const users={findByEmail:email=>records.users.find(user=>user.email===email),findById:id=>records.users.find(user=>user.id===id),create:user=>records.users.push({...user,plan:'free',resumeProfile:{}}),updatePassword:(id,passwordHash)=>{records.users.find(user=>user.id===id).passwordHash=passwordHash}};
  const sessions={create:session=>records.sessions.push(session),findUser:hash=>records.users.find(user=>user.id===records.sessions.find(session=>session.tokenHash===hash)?.userId),remove:hash=>{records.sessions=records.sessions.filter(session=>session.tokenHash!==hash)},removeForUser:id=>{records.sessions=records.sessions.filter(session=>session.userId!==id)}};
  const passwordResets={removeForUser:id=>{records.resets=records.resets.filter(reset=>reset.userId!==id)},create:reset=>records.resets.push(reset),findUsable:hash=>records.resets.find(reset=>reset.tokenHash===hash&&!reset.usedAt),markUsed:id=>{records.resets.find(reset=>reset.id===id).usedAt='used'}};
  let tokenCounter=0;
  const security={id:()=>`id-${++tokenCounter}`,token:()=>`token-${++tokenCounter}`,hashToken:value=>`hash:${value}`,hashPassword:value=>`password:${value}`,verifyPassword:(value,hash)=>hash===`password:${value}`,randomInt:()=>7};
  const useCases=createAuthUseCases({users,sessions,passwordResets,security,mailer:{configured:()=>false},settings:{sessionDays:30,resetTokenMinutes:30,nodeEnv:'development'},clock:()=>new Date('2026-01-01T00:00:00Z')});

  const registered=await useCases.register({name:'  Ana Silva ',email:'ANA@example.test',password:'password123'});
  assert.equal(registered.user.name,'Ana Silva');
  assert.equal((await useCases.login({email:'ana@example.test',password:'password123'})).user.email,'ana@example.test');
  assert.equal((await useCases.login({email:'ana@example.test',password:'wrong'})).status,401);
  const recovery=await useCases.requestPasswordReset('ana@example.test');
  assert.equal(recovery.developmentCode,'000007');
  assert.deepEqual(useCases.resetPassword({code:'000007',password:'changed123'}),{ok:true});
  assert.equal(useCases.resetPassword({code:'000007',password:'changed123'}).status,400);
  assert.equal(records.sessions.length,0);
});

test('resume use cases enforce capacity and ownership through repository ports',()=>{
  const items=[];
  const repository={listForUser:id=>items.filter(item=>item.userId===id),countForUser:id=>items.filter(item=>item.userId===id).length,findForUser:(id,userId)=>items.find(item=>item.id===id&&item.userId===userId),create:item=>items.push({...item}),update(){},remove:(id,userId)=>{const index=items.findIndex(item=>item.id===id&&item.userId===userId);if(index<0)return false;items.splice(index,1);return true}};
  const useCases=createResumeUseCases({resumes:repository,plans:{free:{resumeLimit:1}},makeId:()=>`resume-${items.length+1}`,now:()=>new Date('2026-01-01T00:00:00Z').toISOString()});
  const owner={id:'owner',plan:'free'},outsider={id:'outsider',plan:'free'};
  const first=useCases.create(owner,{title:'Primeiro'});
  assert.equal(first.title,'Primeiro');
  assert.equal(useCases.create(owner,{}).code,'RESUME_LIMIT_REACHED');
  assert.equal(useCases.get(outsider,first.id),null);
  assert.equal(useCases.remove(outsider,first.id),false);
  assert.equal(useCases.remove(owner,first.id),true);
  assert.ok(useCases.create(owner,{}).id);
});

test('browser ES modules resolve through the new presentation structure',async()=>{
  const {pathToFileURL}=require('node:url');
  const path=require('node:path');
  globalThis.document={addEventListener(){}};
  try {
    await import(pathToFileURL(path.resolve(__dirname,'../../js/app.mjs')));
  } finally { delete globalThis.document; }
});

