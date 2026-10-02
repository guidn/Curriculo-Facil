const db = require('./db');
const config = require('./config');
const { token, hashToken, today } = require('./security');

function cookie(name, value, maxAgeSeconds) {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (maxAgeSeconds != null) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
  if (config.cookieSecure) parts.push('Secure');
  return parts.join('; ');
}

function setSession(res, userId) {
  const raw = token(32);
  const now = new Date();
  const expires = new Date(now.getTime() + config.sessionDays * 86400000);
  db.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)')
    .run(token(16), userId, hashToken(raw), expires.toISOString(), now.toISOString());
  res.setHeader('Set-Cookie', cookie('cf_session', raw, config.sessionDays * 86400));
}

function clearSession(res, raw) {
  if (raw) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(raw));
  res.setHeader('Set-Cookie', cookie('cf_session', '', 0));
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').filter(Boolean).map(v => {
    const i = v.indexOf('='); return [v.slice(0,i).trim(), decodeURIComponent(v.slice(i+1).trim())];
  }));
}

function getUser(req) {
  const raw = parseCookies(req).cf_session;
  if (!raw) return null;
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > datetime('now')`).get(hashToken(raw));
  return row || null;
}

function requireUser(req, res) {
  const user = getUser(req);
  if (!user) { res.statusCode = 401; return null; }
  return user;
}

module.exports = { setSession, clearSession, getUser, requireUser, parseCookies };
