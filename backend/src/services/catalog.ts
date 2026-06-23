/**
 * Read access to the sticker catalog (reference data) and derived team list.
 */
import { readFileSync } from 'node:fs';
import type { DB } from '../db/index.ts';
import { dataFile } from '../lib/dataPath.ts';
import type { Sticker, Team } from '../types.ts';

interface StickerRow {
  code: string;
  section: string;
  group_name: string | null;
  team_code: string | null;
  team_name: string;
  number: number;
  type: string;
  player_name: string;
  position: string | null;
  club: string | null;
  jersey: number | null;
  caps: number | null;
  goals: number | null;
  is_foil: number;
  verified: number;
}

function rowToSticker(r: StickerRow): Sticker {
  return {
    code: r.code,
    section: r.section as Sticker['section'],
    groupName: r.group_name,
    teamCode: r.team_code,
    teamName: r.team_name,
    number: r.number,
    type: r.type as Sticker['type'],
    playerName: r.player_name,
    position: r.position,
    club: r.club,
    jersey: r.jersey,
    caps: r.caps,
    goals: r.goals,
    isFoil: r.is_foil === 1,
    verified: r.verified === 1,
  };
}

export function getAllStickers(db: DB): Sticker[] {
  const rows = db
    .prepare(
      `SELECT * FROM stickers
       ORDER BY
         CASE section
           WHEN 'intro' THEN 0
           WHEN 'museum' THEN 1
           WHEN 'team' THEN 2
           WHEN 'coca_cola' THEN 3
           ELSE 4
         END,
         group_name, team_code, number`,
    )
    .all() as StickerRow[];
  return rows.map(rowToSticker);
}

/** Team metadata with colors, loaded from the generated teams.json. */
export function getTeams(): Team[] {
  return JSON.parse(readFileSync(dataFile('teams.json'), 'utf8')) as Team[];
}
