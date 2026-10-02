const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','basic','premium')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'modern',
  accent TEXT NOT NULL DEFAULT '#742cff',
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  shared_token TEXT UNIQUE,
  shared_at TEXT
);
CREATE TABLE IF NOT EXISTS usage_daily (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  exports INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  resume_creates INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, usage_date)
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK(plan IN ('basic','premium')),
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);
const userColumns = db.prepare('PRAGMA table_info(users)').all().map(column => column.name);
if (!userColumns.includes('resume_profile_json')) {
  db.exec("ALTER TABLE users ADD COLUMN resume_profile_json TEXT NOT NULL DEFAULT '{}'");
}
module.exports = db;
