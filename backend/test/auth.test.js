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
  assert.match(await home.text(), /Currículo Fácil/);

  const plans = await call('/api/plans');
  assert.equal(plans.status, 200);
  assert.equal((await plans.json()).plans.length, 3);
  const models = await call('/api/models');
  assert.equal(models.status, 200);
  assert.equal((await models.json()).models.length, 3);
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

  const created = await call('/api/resumes', {
    method: 'POST',
    cookie,
    payload: {
      title: 'Currículo de teste',
      template: 'classic',
      accent: '#1769aa',
      data: { name: 'Test User', summary: 'Portfolio' }
    }
  });
  assert.equal(created.status, 201);
  const resume = (await created.json()).resume;
  assert.equal(resume.template, 'classic');
  assert.equal(resume.accent, '#1769aa');

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
  assert.equal((await usage.json()).usage.resumeCreates, 1, 'invalid input must not consume quota');

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
  const developmentToken = (await forgot.json()).developmentToken;
  assert.ok(developmentToken);
  const reset = await call('/api/auth/reset-password', {
    method: 'POST',
    payload: { token: developmentToken, password: 'ReplacementPassword123' }
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
    payload: { token: developmentToken, password: 'AnotherPassword123' }
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
