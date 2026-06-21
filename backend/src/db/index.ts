/**
 * SQLite connection (singleton). The database file location is configurable via
 * DATABASE_PATH so the Docker image can point it at a mounted volume.
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { SCHEMA_SQL } from './schema.ts';

export type DB = Database.Database;

let instance: DB | null = null;

export function getDb(): DB {
  if (instance) return instance;

  const dbPath = resolve(process.env.DATABASE_PATH ?? './data/stickerdex.db');
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  migrate(db);

  instance = db;
  return db;
}

/**
 * Idempotent column additions for databases created before a column existed.
 * SQLite has no "ADD COLUMN IF NOT EXISTS", so we check pragma table_info first.
 */
function migrate(db: DB): void {
  const cols = (db.prepare('PRAGMA table_info(stickers)').all() as { name: string }[]).map(
    (c) => c.name,
  );
  const add: Record<string, string> = {
    club: 'TEXT',
    jersey: 'INTEGER',
    caps: 'INTEGER',
    goals: 'INTEGER',
  };
  for (const [col, type] of Object.entries(add)) {
    if (!cols.includes(col)) db.exec(`ALTER TABLE stickers ADD COLUMN ${col} ${type}`);
  }

  // match_results.source: distinguishes feed-supplied scores from user edits.
  const resultCols = (db.prepare('PRAGMA table_info(match_results)').all() as { name: string }[]).map(
    (c) => c.name,
  );
  if (resultCols.length > 0 && !resultCols.includes('source')) {
    db.exec(`ALTER TABLE match_results ADD COLUMN source TEXT NOT NULL DEFAULT 'feed'`);
  }
}

/** For tests: open an isolated in-memory database. */
export function createMemoryDb(): DB {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  migrate(db);
  return db;
}
