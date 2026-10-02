const crypto = require('node:crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, original] = String(stored || '').split(':');
  if (!salt || !original) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(original, 'hex'));
}

function token(bytes = 32) { return crypto.randomBytes(bytes).toString('hex'); }
function id() { return crypto.randomUUID(); }
function hashToken(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function today() { return new Date().toISOString().slice(0, 10); }

module.exports = { hashPassword, verifyPassword, token, id, hashToken, today };
