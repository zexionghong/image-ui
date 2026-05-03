import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'data', 'image2.db')

// Ensure data directory exists
import fs from 'fs'
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    size INTEGER DEFAULT 0,
    mime_type TEXT DEFAULT '',
    category TEXT DEFAULT 'uncategorized',
    tags TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    is_generated INTEGER DEFAULT 0,
    prompt TEXT,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS generation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    style TEXT,
    reference_image_id INTEGER,
    result_image_id INTEGER,
    parameters TEXT DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

export default db
