/**
 * Mutations and reads for the user's collection state. `count` is the number of
 * copies owned: 0 = missing, 1 = owned, >1 = (count - 1) duplicates available
 * for swapping.
 */
import type { DB } from '../db/index.ts';
import type { CollectionMap } from '../types.ts';

export function getCollectionMap(db: DB): CollectionMap {
  const rows = db.prepare('SELECT code, count FROM collection').all() as {
    code: string;
    count: number;
  }[];
  const map: CollectionMap = {};
  for (const r of rows) map[r.code] = r.count;
  return map;
}

function exists(db: DB, code: string): boolean {
  return db.prepare('SELECT 1 FROM stickers WHERE code = ?').get(code) !== undefined;
}

/** Sets an absolute count for a code. Returns the new count, or null if unknown. */
export function setCount(db: DB, code: string, count: number): number | null {
  if (!exists(db, code)) return null;
  const safe = Math.max(0, Math.floor(count));
  db.prepare(
    `INSERT INTO collection (code, count, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(code) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at`,
  ).run(code, safe);
  return safe;
}

/** Adds delta (may be negative) to a code's count, clamped at 0. */
export function adjustCount(db: DB, code: string, delta: number): number | null {
  const current = db.prepare('SELECT count FROM collection WHERE code = ?').get(code) as
    | { count: number }
    | undefined;
  if (current === undefined && !exists(db, code)) return null;
  const next = Math.max(0, (current?.count ?? 0) + Math.floor(delta));
  return setCount(db, code, next);
}

/** Bulk absolute-set of many codes. Returns count of applied updates. */
export function bulkSet(db: DB, updates: Record<string, number>): number {
  const run = db.transaction((entries: [string, number][]) => {
    let applied = 0;
    for (const [code, count] of entries) {
      if (setCount(db, code, count) !== null) applied++;
    }
    return applied;
  });
  return run(Object.entries(updates));
}

/** Replaces the entire collection (used by import). Unknown codes are skipped. */
export function replaceCollection(db: DB, map: CollectionMap): number {
  const reset = db.prepare('UPDATE collection SET count = 0');
  const run = db.transaction(() => {
    reset.run();
    return bulkSet(db, map);
  });
  return run();
}
