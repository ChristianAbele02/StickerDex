/**
 * Seeds the `stickers` reference table from the generated catalog and ensures a
 * `collection` row exists (count 0) for every sticker. Idempotent: safe to run
 * on every startup. Run directly with `npm run seed`.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './index.ts';
import { getDb } from './index.ts';
import type { Sticker } from '../types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Reads the generated catalog. Looks next to the source/compiled module. */
export function loadCatalog(): Sticker[] {
  const path = resolve(__dirname, '../data/stickers.json');
  return JSON.parse(readFileSync(path, 'utf8')) as Sticker[];
}

export function seed(db: DB, catalog: Sticker[] = loadCatalog()): number {
  const upsertSticker = db.prepare(/* sql */ `
    INSERT INTO stickers
      (code, section, group_name, team_code, team_name, number, type, player_name, position, club, jersey, caps, goals, is_foil, verified)
    VALUES
      (@code, @section, @groupName, @teamCode, @teamName, @number, @type, @playerName, @position, @club, @jersey, @caps, @goals, @isFoil, @verified)
    ON CONFLICT(code) DO UPDATE SET
      section = excluded.section,
      group_name = excluded.group_name,
      team_code = excluded.team_code,
      team_name = excluded.team_name,
      number = excluded.number,
      type = excluded.type,
      player_name = excluded.player_name,
      position = excluded.position,
      club = excluded.club,
      jersey = excluded.jersey,
      caps = excluded.caps,
      goals = excluded.goals,
      is_foil = excluded.is_foil,
      verified = excluded.verified
  `);
  const ensureCollection = db.prepare(
    'INSERT OR IGNORE INTO collection (code, count) VALUES (?, 0)',
  );

  const deleteSticker = db.prepare('DELETE FROM stickers WHERE code = ?');

  const run = db.transaction((stickers: Sticker[]) => {
    for (const s of stickers) {
      upsertSticker.run({
        code: s.code,
        section: s.section,
        groupName: s.groupName,
        teamCode: s.teamCode,
        teamName: s.teamName,
        number: s.number,
        type: s.type,
        playerName: s.playerName,
        position: s.position,
        club: s.club ?? null,
        jersey: s.jersey ?? null,
        caps: s.caps ?? null,
        goals: s.goals ?? null,
        isFoil: s.isFoil ? 1 : 0,
        verified: s.verified ? 1 : 0,
      });
      ensureCollection.run(s.code);
    }

    // Prune stickers that are no longer in the catalog (e.g. teams dropped when
    // the dataset is corrected). Their collection rows cascade-delete.
    const keep = new Set(stickers.map((s) => s.code));
    const existing = db.prepare('SELECT code FROM stickers').all() as { code: string }[];
    for (const { code } of existing) {
      if (!keep.has(code)) deleteSticker.run(code);
    }
  });

  run(catalog);
  return catalog.length;
}

// Allow `npm run seed` / container entrypoint to invoke directly.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.ts')) {
  const count = seed(getDb());
  console.log(`Seeded ${count} stickers.`);
}
