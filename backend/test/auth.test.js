'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { test, before, after } = require('node:test');

const root = path.resolve(__dirname, '../..');
const serverPath = path.join(root, 'backend/src/server.js');
let tempDir;
let dbFile;
let serverUrl;
let child;
let inspectionDb;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function call(route, { method = 'GET', payload, cookie, sendOrigin = true } = {}) {
  const headers = {};
  if (payload !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (sendOrigin && !['GET', 'HEAD'].includes(method)) headers.origin = serverUrl;
  return fetch(serverUrl + route, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
}

before(async () => {
  tempDir = mkdtempSync(path.join(os.tmpdir(), 'curriculo-facil-test-'));
  dbFile = path.join(tempDir, 'test.sqlite');
  const port = 30000 + Math.floor(Math.random() * 20000);
  serverUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [serverPath], {
    cwd: root,
    stdio: 'ignore',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      APP_URL: serverUrl,
      COOKIE_SECURE: 'false',
      DB_FILE: dbFile
    }
  });

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
    try {
      const response = await fetch(serverUrl + '/api/plans');
      if (response.ok) return;
    } catch {}
    await wait(100);
  }
  child.kill();
  throw new Error('Server did not become ready within 10 seconds');
});

after(async () => {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([once(child, 'exit'), wait(2000)]);
  }
  if (inspectionDb) inspectionDb.close();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

test('public pages, authentication, sessions, recovery and resume ownership', async () => {
  const home = await call('/');
  assert.equal(home.status, 200);
  const homeHtml = await home.text();
  assert.match(homeHtml, /Currículo Fácil/);
  assert.match(homeHtml, /data-public-home/);
  assert.match(homeHtml, /js\/app\.mjs/);
  const demoResponse=await call('/api/dev/demo-resume');
  assert.equal(demoResponse.status,200);
  assert.equal((await demoResponse.json()).resume.data.personal.name,'Rafael Costa');
  assert.equal((await call('/backend/test/fixtures/demo-resume.json')).status,404,'backend and test fixtures are not served as static files');
  assert.equal((await call('/pages/builder/demo.html')).status,200);
  const wizardPage = await call('/pages/builder/novo-curriculo.html');
  const wizardHtml = await wizardPage.text();
  assert.equal((wizardHtml.match(/data-wizard-step=/g) || []).length, 5);
  assert.match(wizardHtml, /data-add-experience/);
  assert.match(wizardHtml, /data-add-education/);
  assert.match(wizardHtml, /data-step-next/);
  assert.match(wizardHtml, /data-step-back/);
  assert.match(wizardHtml, /data-template-cards/);
  assert.match(wizardHtml, /resume-rendering\.js/);
  assert.match(wizardHtml, /name="experienceStartDate" type="date"/);
  assert.match(await (await call('/js/features/new-resume.mjs')).text(), /name="template"/);
  const editorPage = await call('/pages/builder/editor.html');
  const editorHtml = await editorPage.text();
  assert.match(editorHtml, /data-save-preview/);
  assert.match(editorHtml, /data-editor-courses/);
  assert.match(editorHtml, /data-editor-languages/);
  assert.match(editorHtml, /data-editor-certifications/);
  assert.match(editorHtml, /data-editor-projects/);
  assert.match(editorHtml, /data-export-format="word"/);
  assert.match(editorHtml, /data-return-editor/);
  assert.match(editorHtml, /editor-back/);
  assert.doesNotMatch(editorHtml, /data-editor-view/);
  assert.match(editorHtml, /data-save-status/);
  assert.match(editorHtml, /data-zoom="fit"/);
  assert.match(editorHtml, /data-template-options/);
  assert.match(await (await call('/js/features/editor.mjs')).text(), /data-template="\$\{escapeHtml\(item\.id\)\}"/);
  const profilePage = await call('/pages/app/perfil.html');
  const profileHtml = await profilePage.text();
  assert.match(profileHtml, /Informações para o currículo/);
  assert.match(profileHtml, /data-editor-experiences/);
  assert.match(profileHtml, /data-editor-education/);
  assert.match(profileHtml, /profile-session-card/);
  assert.match(profileHtml, /profile-brand-mark/);
  assert.doesNotMatch(profileHtml.slice(0,profileHtml.indexOf('<main')), /data-logout/);
  const recoveryPage = await call('/pages/auth/esqueci-senha.html');
  const recoveryHtml = await recoveryPage.text();
  assert.match(recoveryHtml, /data-reset-next/);
  assert.match(recoveryHtml, /app\.mjs/);
  const resetPage = await call('/pages/auth/reset-senha.html');
  assert.match(await resetPage.text(), /autocomplete="one-time-code"/);
  const dashboardResponse = await call('/pages/app/dashboard.html');
  const dashboardHtml = await dashboardResponse.text();
  assert.match(dashboardHtml, /data-home-link/);
  assert.match(dashboardHtml, /data-member-home="dashboard.html"/);
  const browserModule = await call('/js/app.mjs');
  assert.match(browserModule.headers.get('content-type'), /javascript/);
  assert.match(await browserModule.text(), /features\/auth\.mjs/);

  const plans = await call('/api/plans');
  assert.equal(plans.status, 200);
  assert.equal((await plans.json()).plans.length, 3);
  const models = await call('/api/models');
  assert.equal(models.status, 200);
  const modelCatalog=(await models.json()).models;
  assert.equal(modelCatalog.length, 5);
  assert.equal(modelCatalog[0].id,'modern');
  assert.ok(modelCatalog.every(model=>model.atsFriendly && model.accent));
  assert.match(profileHtml, /profile-session-card/);
  assert.match(profileHtml, /profile-brand-mark/);
  const authClient = await call('/js/features/auth.mjs');
  assert.match(await authClient.text(), /novo-curriculo\.html\?onboarding=1/);
  assert.equal((await call('/api/resumes')).status, 401);

  const email = `test-${crypto.randomUUID()}@example.test`;
  const password = 'OriginalPassword123';
  const registration = await call('/api/auth/register', {
    method: 'POST',
    payload: { name: 'Test User', email, password }
  });
  assert.equal(registration.status, 201);
  const cookie = registration.headers.get('set-cookie')?.match(/^cf_session=[^;]+/)?.[0];
  assert.ok(cookie, 'registration should set the session cookie');
  assert.match(registration.headers.get('set-cookie'), /HttpOnly/);
  assert.match(registration.headers.get('set-cookie'), /SameSite=Lax/);

  const me = await call('/api/auth/me', { cookie });
  assert.equal((await me.json()).user.email, email);
  const profileSaved = await call('/api/profile', {
    method: 'PATCH', cookie,
    payload: { name: 'Test User', resumeProfile: { role: 'Analyst', phone: '11999990000', city: 'São Paulo', skills: ['Excel'], experiences: [{ role: 'Analyst', company: 'Example Co', startDate: '2022-01-01' }] } }
  });
  assert.equal(profileSaved.status, 200);
  assert.equal((await profileSaved.json()).user.resumeProfile.experiences[0].company, 'Example Co');
  const invalidProfileDate = await call('/api/profile', {
    method: 'PATCH', cookie,
    payload: { name: 'Test User', resumeProfile: { experiences: [{ role: 'Analyst', startDate: '2024-04-01', endDate: '2023-03-01' }] } }
  });
  assert.equal(invalidProfileDate.status, 400, 'profile service rejects reversed date ranges');

  const created = await call('/api/resumes', {
    method: 'POST',
    cookie,
    payload: {
      title: 'Currículo de teste',
      template: 'classic',
      accent: '#1769aa',
      data: {
        name: 'Test User',
        summary: 'Portfolio',
        experiences: [
          { role: 'Analista de dados', company: 'Example Co', location: 'São Paulo, SP', startDate: '2022-01-01', endDate: '2024-02-01', description: 'Criação de relatórios e indicadores para apoiar decisões.' },
          { role: 'Assistente de operações', company: 'Empresa Anterior', location: 'Remoto', startDate: '2020-02-01', endDate: '2021-12-01', description: 'Automatização de processos e documentação de rotinas.' }
        ],
        education: [
          { course: 'Administração de Empresas', school: 'Example College', startDate: '2018-02-01', endDate: '2021-12-01' },
          { course: 'Análise de Dados', school: 'Instituto Exemplo', startDate: '2022-03-01', endDate: '2023-02-01' }
        ],
        skills: ['Excel', 'SQL', 'Comunicação', 'Análise de dados', 'Power BI', 'Organização', 'Resolução de problemas', 'Trabalho em equipe'],
        courses: [
          {name:'Excel avançado',institution:'Escola Exemplo',date:'2024-03-01'},
          {name:'Fundamentos de SQL',institution:'Academia Digital',date:'2023-07-01'},
          {name:'Visualização de dados',institution:'Instituto Exemplo',date:'2023-10-01'}
        ],
        languages: [{name:'Português',proficiency:'Nativo'},{name:'Inglês',proficiency:'Intermediário'}],
        certifications: [{name:'Certificação de análise',issuer:'Instituto Exemplo',date:'2025-02-01'}],
        projects: [
          {name:'Painel de indicadores',description:'Relatórios de desempenho com métricas mensais.',technologies:['Excel','SQL'],url:'https://example.test/projeto'},
          {name:'Automação de relatórios',description:'Script que consolida arquivos e reduz tarefas manuais.',technologies:['JavaScript','Node.js'],url:'https://example.test/automacao'}
        ],
        personal: {linkedin:'https://linkedin.com/in/test-user',github:'https://github.com/test-user',portfolio:'https://example.test'}
      }
    }
  });
  assert.equal(created.status, 201);
  const resume = (await created.json()).resume;
  assert.equal(resume.template, 'classic');
  assert.equal(resume.accent, '#1769aa');
  assert.equal(resume.data.experiences.length, 2);
  assert.equal(resume.data.education.length, 2);
  assert.equal(resume.data.skills.length, 8);
  assert.equal(resume.data.personal.name, 'Test User');
  assert.equal(resume.data.courses[0].name, 'Excel avançado');
  assert.equal(resume.data.courses.length, 3);
  assert.equal(resume.data.languages.length, 2);
  assert.equal(resume.data.projects.length, 2);
  assert.equal(resume.data.projects[0].technologies.length, 2);
  const invalidResumeDates=await call(`/api/resumes/${resume.id}`,{method:'PATCH',cookie,payload:{data:{experiences:[{startDate:'2025-04-01',endDate:'2024-03-01'}]}}});
  assert.equal(invalidResumeDates.status,400,'invalid resume date ranges are rejected without a server error');
  const exported = await call(`/api/resumes/${resume.id}/export?format=print`, { method: 'POST', cookie });
  const exportedHtml = await exported.text();
  assert.equal(exported.status, 200);
  assert.match(exportedHtml, /resume-paper template-classic/);
  assert.match(exportedHtml, /css\/pages\/resume-renderer\.css/);
  assert.match(await (await call('/css/pages/resume-renderer.css')).text(), /\.paper\[data-template="classic"\]/);
  assert.match(exportedHtml, /2022/);
  const resumeUpdated = await call(`/api/resumes/${resume.id}`, { method: 'PATCH', cookie, payload: { title: 'Currículo atualizado', template: 'executive', accent: '#1f3a5f', data: { ...resume.data, role: 'Analyst' } } });
  assert.equal(resumeUpdated.status, 200);
  assert.equal((await resumeUpdated.json()).resume.template, 'executive');
  assert.equal((await (await call(`/api/resumes/${resume.id}`, { cookie })).json()).resume.title, 'Currículo atualizado', 'PATCH updates the existing resume');
  const shared = await call(`/api/resumes/${resume.id}/share`, { method: 'POST', cookie });
  assert.equal(shared.status, 200);
  const shareUrl = (await shared.json()).url;
  assert.match(shareUrl, /\/share\/[a-f0-9]+$/);
  assert.equal((await call(new URL(shareUrl).pathname)).status, 200, 'the share link opens the saved resume');

  const otherEmail = `other-${crypto.randomUUID()}@example.test`;
  const otherRegistration = await call('/api/auth/register', {
    method: 'POST',
    payload: { name: 'Other User', email: otherEmail, password: 'AnotherPassword123' }
  });
  const otherCookie = otherRegistration.headers.get('set-cookie')?.match(/^cf_session=[^;]+/)?.[0];
  assert.equal(otherRegistration.status, 201);
  assert.equal((await call(`/api/resumes/${resume.id}`, { cookie: otherCookie })).status, 404);

  const invalid = await call('/api/resumes', {
    method: 'POST',
    cookie,
    payload: { template: 'invalid', accent: '#742cff', data: {} }
  });
  assert.equal(invalid.status, 400);
  const usage = await call('/api/usage', { cookie });
  assert.equal((await usage.json()).resumeCapacity.available, 1, 'invalid input must not consume saved-resume capacity');

  const secondResume = await call('/api/resumes', { method: 'POST', cookie, payload: { title: 'Segundo currículo', template: 'modern', accent: '#742cff', data: {} } });
  assert.equal(secondResume.status, 201);
  const blockedResume = await call('/api/resumes', { method: 'POST', cookie, payload: { title: 'Terceiro currículo', template: 'modern', accent: '#742cff', data: {} } });
  assert.equal(blockedResume.status, 409);
  assert.equal((await blockedResume.json()).code, 'RESUME_LIMIT_REACHED');
  const second = (await secondResume.json()).resume;
  assert.equal((await call(`/api/resumes/${second.id}`, { method: 'DELETE', cookie })).status, 204);
  assert.equal((await call(`/api/resumes/${second.id}`, { cookie })).status, 404);
  assert.equal((await (await call('/api/usage', { cookie })).json()).resumeCapacity.available, 1, 'deleting a resume releases a saved slot');

  const upgrade = await call('/api/billing/dev-activate', { method:'POST', cookie, payload:{plan:'basic'} });
  assert.equal(upgrade.status, 200);
  const pdf = await call(`/api/resumes/${resume.id}/export?format=pdf`, { method:'POST', cookie });
  assert.equal(pdf.status,200);
  assert.match(pdf.headers.get('content-type'),/application\/pdf/);
  assert.equal((await pdf.text()).slice(0,8),'%PDF-1.3','PDF export produces a searchable PDF document');
  const word = await call(`/api/resumes/${resume.id}/export?format=word`, { method:'POST', cookie });
  assert.equal(word.status, 200);
  assert.match(word.headers.get('content-type'), /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.deepEqual([...new Uint8Array(await word.arrayBuffer()).slice(0,2)], [0x50,0x4b], 'DOCX is a zipped OOXML document');
  const plain = await call(`/api/resumes/${resume.id}/export?format=txt`, { method:'POST', cookie });
  assert.equal(plain.status, 200);
  assert.match(plain.headers.get('content-type'), /text\/plain/);
  assert.match(await plain.text(), /EXPERIÊNCIA PROFISSIONAL/);
  const badFormat = await call(`/api/resumes/${resume.id}/export?format=html`, { method:'POST', cookie });
  assert.equal(badFormat.status, 400, 'invalid export formats are rejected');

  const csrf = await call('/api/resumes', {
    method: 'POST',
    cookie,
    sendOrigin: false,
    payload: { title: 'Blocked', data: {} }
  });
  assert.equal(csrf.status, 403);

  inspectionDb = new DatabaseSync(dbFile);
  const user = inspectionDb.prepare('SELECT password_hash FROM users WHERE email=?').get(email);
  assert.ok(user.password_hash);
  assert.notEqual(user.password_hash, password);
  const sessionToken = cookie.slice('cf_session='.length);
  const session = inspectionDb.prepare('SELECT token_hash FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=?)').get(email);
  assert.equal(session.token_hash, crypto.createHash('sha256').update(sessionToken).digest('hex'));

  const forgot = await call('/api/auth/forgot-password', {
    method: 'POST',
    payload: { email }
  });
  const developmentCode = (await forgot.json()).developmentCode;
  assert.match(developmentCode, /^\d{6}$/);
  const reset = await call('/api/auth/reset-password', {
    method: 'POST',
    payload: { code: developmentCode, password: 'ReplacementPassword123' }
  });
  assert.equal(reset.status, 200);
  assert.equal((await call('/api/auth/me', { cookie })).status, 401, 'password reset revokes old sessions');

  const login = await call('/api/auth/login', {
    method: 'POST',
    payload: { email, password: 'ReplacementPassword123' }
  });
  assert.equal(login.status, 200);
  const loginCookie = login.headers.get('set-cookie')?.match(/^cf_session=[^;]+/)?.[0];
  assert.ok(loginCookie);
  assert.equal((await call('/api/auth/me', { cookie: loginCookie })).status, 200);

  const usedToken = await call('/api/auth/reset-password', {
    method: 'POST',
    payload: { code: developmentCode, password: 'AnotherPassword123' }
  });
  assert.equal(usedToken.status, 400, 'a recovery token can only be used once');
  const logout = await call('/api/auth/logout', { method: 'POST', cookie: loginCookie });
  assert.equal(logout.status, 200);
  assert.equal((await call('/api/auth/me', { cookie: loginCookie })).status, 401, 'logout revokes the session');
  inspectionDb.close();
  inspectionDb = null;

  const rateResponses = [];
  for (let i = 0; i < 10; i++) {
    rateResponses.push(await call('/api/auth/login', {
      method: 'POST',
      payload: { email, password: 'WrongPassword123' }
    }));
  }
  assert.equal(rateResponses.at(-1).status, 429, 'login attempts should be rate limited');
});

