const path = require('path');
const Database = require('better-sqlite3');

const dbDir = path.join(__dirname, 'db');
const dbPath = path.join(dbDir, 'lashes.db');

const db = new Database(dbPath);

db.prepare(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    service TEXT NOT NULL,
    preferred_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`).run();

module.exports = db;
