const path = require('node:path');
const fs = require('node:fs');
const envPath = path => path;
try {
  const file = envPath(require('node:path').resolve(__dirname, '../../.env'));
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
} catch (_) {}

const env = process.env;
module.exports = {
  port: Number(env.PORT || 3000),
  nodeEnv: env.NODE_ENV || 'development',
  sessionDays: Number(env.SESSION_DAYS || 30),
  appUrl: env.APP_URL || 'http://localhost:3000',
  cookieSecure: env.COOKIE_SECURE === undefined ? (env.NODE_ENV || 'development') === 'production' : String(env.COOKIE_SECURE) === 'true',
  resetTokenMinutes: Number(env.RESET_TOKEN_MINUTES || 30),
  rootDir: path.resolve(__dirname, '../..'),
  dbFile: path.resolve(__dirname, '../data/curriculo-facil.sqlite')
};
