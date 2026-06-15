/**
 * Local backup/restore of the user's collection database.
 *
 * Backups are full, self-contained SQLite snapshots written with `VACUUM INTO`,
 * stored alongside the live database in a `backups/` folder. An automatic backup
 * is taken on every startup (before seeding) so the app can never wipe your
 * collection again, and manual backups can be made/restored/downloaded anytime.
 *
 * SAFETY: nothing here ever deletes a backup automatically — backups are only
 * removed when the user explicitly asks (DELETE route). Retention is unlimited
 * by default.
 */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { DB } from '../db/index.ts';

/** Backup filenames: `stickerdex-2026-06-15_14-30-05-manual.db`. */
const NAME_RE = /^stickerdex-[0-9A-Za-z_-]+\.db$/;

export interface BackupInfo {
  name: string;
  createdAt: string; // ISO
  sizeBytes: number;
  ownedStickers: number;
  spareCopies: number;
  matchResults: number;
  kind: 'auto' | 'manual';
}

/** The directory backups live in (next to the live DB). Created on demand. */
export function backupDir(): string {
  const base = resolve(process.env.DATABASE_PATH ?? './data/stickerdex.db');
  const dir = join(dirname(base), 'backups');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Resolve a validated backup path, guarding against path traversal. */
function backupPath(name: string): string {
  if (!NAME_RE.test(name)) throw new Error(`Invalid backup name: ${name}`);
  const dir = backupDir();
  const path = resolve(dir, name);
  if (dirname(path) !== resolve(dir)) throw new Error('Path traversal blocked');
  return path;
}

function stamp(): string {
  return new Date().toISOString().replace('T', '_').replace(/[:.]/g, '-').slice(0, 19);
}

function ownedCounts(db: Database.Database): { owned: number; spares: number; results: number } {
  const o = db.prepare('SELECT COUNT(*) c, COALESCE(SUM(count),0) s FROM collection WHERE count>0').get() as {
    c: number;
    s: number;
  };
  let results = 0;
  try {
    results = (db.prepare('SELECT COUNT(*) c FROM match_results').get() as { c: number }).c;
  } catch {
    /* table may not exist on very old snapshots */
  }
  return { owned: o.c, spares: Math.max(0, o.s - o.c), results };
}

function inspect(name: string): BackupInfo {
  const path = backupPath(name);
  const st = statSync(path);
  const snap = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const { owned, spares, results } = ownedCounts(snap);
    return {
      name,
      createdAt: st.mtime.toISOString(),
      sizeBytes: st.size,
      ownedStickers: owned,
      spareCopies: spares,
      matchResults: results,
      kind: name.includes('-auto.') ? 'auto' : 'manual',
    };
  } finally {
    snap.close();
  }
}

/**
 * Write a snapshot. `kind: 'auto'` skips empty collections so startup doesn't
 * pile up empty backups. Returns null when skipped.
 */
export function createBackup(db: DB, kind: 'auto' | 'manual' = 'manual'): BackupInfo | null {
  const owned = (db.prepare('SELECT COUNT(*) c FROM collection WHERE count>0').get() as { c: number }).c;
  if (kind === 'auto' && owned === 0) return null;

  const name = `stickerdex-${stamp()}-${kind}.db`;
  const path = backupPath(name);
  // VACUUM INTO writes a clean, consistent single-file copy (incl. WAL data).
  db.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  return inspect(name);
}

export function listBackups(): BackupInfo[] {
  const dir = backupDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => NAME_RE.test(n))
    .map((n) => {
      try {
        return inspect(n);
      } catch {
        return null;
      }
    })
    .filter((b): b is BackupInfo => b !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Restore a backup into the live database: replace the collection counts and
 * match results with the snapshot's. Returns how many of each were applied.
 */
export function restoreBackup(db: DB, name: string): { collection: number; matchResults: number } {
  const path = backupPath(name);
  if (!existsSync(path)) throw new Error(`No such backup: ${name}`);
  const snap = new Database(path, { readonly: true, fileMustExist: true });

  try {
    const counts = snap.prepare('SELECT code, count FROM collection').all() as {
      code: string;
      count: number;
    }[];
    let results: { num: number; home_score: number; away_score: number }[] = [];
    try {
      results = snap.prepare('SELECT num, home_score, away_score FROM match_results').all() as typeof results;
    } catch {
      /* snapshot may predate tournament tables */
    }

    const setCollection = db.prepare(
      `UPDATE collection SET count = @count, updated_at = datetime('now') WHERE code = @code`,
    );
    const resetCollection = db.prepare('UPDATE collection SET count = 0');
    const clearResults = db.prepare('DELETE FROM match_results');
    const insertResult = db.prepare(
      'INSERT OR REPLACE INTO match_results (num, home_score, away_score) VALUES (?, ?, ?)',
    );

    const run = db.transaction(() => {
      resetCollection.run();
      let applied = 0;
      for (const r of counts) applied += setCollection.run({ code: r.code, count: r.count }).changes;
      clearResults.run();
      for (const r of results) insertResult.run(r.num, r.home_score, r.away_score);
      return { collection: applied, matchResults: results.length };
    });
    return run();
  } finally {
    snap.close();
  }
}

/** Delete a backup — only ever called from the explicit user action. */
export function deleteBackup(name: string): void {
  const path = backupPath(name);
  if (existsSync(path)) unlinkSync(path);
}

/** Absolute path for download streaming (validated). */
export function backupFilePath(name: string): string {
  const path = backupPath(name);
  if (!existsSync(path)) throw new Error(`No such backup: ${name}`);
  return path;
}
