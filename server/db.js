import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './db/migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir =
  process.env.RC_DATA_DIR || path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'racket-club.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  runMigrations(db);
  return db;
}

export function getDb() {
  return db;
}

export { dbPath };
