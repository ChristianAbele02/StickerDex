import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMemoryDb } from '../src/db/index.ts';
import { seed } from '../src/db/seed.ts';
import {
  createBackup,
  deleteBackup,
  listBackups,
  restoreBackup,
} from '../src/services/backups.ts';
import type { Sticker } from '../src/types.ts';

const fixture: Sticker[] = [
  {
    code: 'ARG17',
    section: 'team',
    groupName: 'A',
    teamCode: 'ARG',
    teamName: 'Argentina',
    number: 17,
    type: 'player',
    playerName: 'Lionel Messi',
    position: 'Forward',
    club: 'Inter Miami',
    jersey: 10,
    caps: 199,
    goals: 117,
    isFoil: false,
    verified: true,
  },
];

describe('backups', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'sdtest-'));
    process.env.DATABASE_PATH = join(dir, 'live.db'); // backups land in <dir>/backups
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('snapshots and restores the collection (and match results)', () => {
    const db = createMemoryDb();
    seed(db, fixture);
    db.prepare('UPDATE collection SET count = 3 WHERE code = ?').run('ARG17');

    const backup = createBackup(db, 'manual');
    expect(backup).not.toBeNull();
    expect(backup!.ownedStickers).toBe(1);
    expect(backup!.spareCopies).toBe(2);

    // Simulate data loss, then restore.
    db.prepare('UPDATE collection SET count = 0').run();
    expect((db.prepare('SELECT count FROM collection WHERE code = ?').get('ARG17') as { count: number }).count).toBe(0);

    const restored = restoreBackup(db, backup!.name);
    expect(restored.collection).toBe(1);
    expect((db.prepare('SELECT count FROM collection WHERE code = ?').get('ARG17') as { count: number }).count).toBe(3);
  });

  it('skips an automatic backup when nothing is owned', () => {
    const db = createMemoryDb();
    seed(db, fixture); // all counts 0
    expect(createBackup(db, 'auto')).toBeNull();
  });

  it('lists and deletes backups, and rejects unsafe names', () => {
    const before = listBackups().length;
    expect(before).toBeGreaterThan(0);

    expect(() => restoreBackup(createMemoryDb(), '../../etc/passwd')).toThrow();

    for (const b of listBackups()) deleteBackup(b.name);
    expect(listBackups()).toHaveLength(0);
  });
});
