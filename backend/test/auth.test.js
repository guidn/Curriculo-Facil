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
  const wizardPage = await call('/pages/builder/novo-curriculo.html');
  const wizardHtml = await wizardPage.text();
  assert.equal((wizardHtml.match(/data-wizard-step=/g) || []).length, 4);
  assert.match(wizardHtml, /data-add-experience/);
  assert.match(wizardHtml, /data-add-education/);
  assert.match(wizardHtml, /data-step-next/);
  assert.match(wizardHtml, /data-step-back/);
  assert.equal((wizardHtml.match(/type="radio" name="template"/g) || []).length, 5);
  assert.match(wizardHtml, /data-preview-name/);
  assert.match(wizardHtml, /name="experienceStartDate" type="date"/);
  assert.match(wizardHtml, /name="template"/);
  const editorPage = await call('/pages/builder/editor.html');
  const editorHtml = await editorPage.text();
  assert.match(editorHtml, /data-save-preview/);
  assert.match(editorHtml, /data-return-editor/);
  assert.match(editorHtml, /editor-back/);
  assert.doesNotMatch(editorHtml, /data-editor-view/);
  assert.match(editorHtml, /data-save-status/);
  assert.match(editorHtml, /data-zoom="fit"/);
  assert.match(editorHtml, /data-template="creative"/);
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
  assert.equal((await models.json()).models.length, 5);
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
        experiences: [{ role: 'Analyst', company: 'Example Co', startDate: '2022-01-01', endDate: '2024-02-01', description: 'Reporting' }],
        education: [{ course: 'Business', school: 'Example College', period: '2020–2022' }],
        skills: ['Excel', 'Communication']
      }
    }
  });
  assert.equal(created.status, 201);
  const resume = (await created.json()).resume;
  assert.equal(resume.template, 'classic');
  assert.equal(resume.accent, '#1769aa');
  assert.equal(resume.data.experiences.length, 1);
  assert.equal(resume.data.education.length, 1);
  assert.equal(resume.data.skills.length, 2);
  const exported = await call(`/api/resumes/${resume.id}/export`, { method: 'POST', cookie });
  const exportedHtml = await exported.text();
  assert.equal(exported.status, 200);
  assert.match(exportedHtml, /paper template-classic/);
  assert.match(exportedHtml, /template-classic \.head/);
  assert.match(exportedHtml, /2022/);
  const resumeUpdated = await call(`/api/resumes/${resume.id}`, { method: 'PATCH', cookie, payload: { title: 'Currículo atualizado', template: 'executive', accent: '#1f3a5f', data: { ...resume.data, role: 'Analyst' } } });
  assert.equal(resumeUpdated.status, 200);
  assert.equal((await resumeUpdated.json()).resume.template, 'executive');

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
