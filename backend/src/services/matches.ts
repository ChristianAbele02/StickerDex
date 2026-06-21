/**
 * Reads tournament fixtures (joined with any entered result) and mutates the
 * `match_results` table. The `matches` table is reference data; scores live in
 * `match_results` so they can be edited or cleared independently.
 */
import type { DB } from '../db/index.ts';
import type { Match, MatchTeam, MatchVenue } from '../types.ts';

interface MatchRow {
  num: number;
  stage: string;
  group_name: string | null;
  kickoff: string;
  local_time: string;
  timezone: string;
  venue_city: string;
  home_code: string | null;
  home_label: string;
  away_code: string | null;
  away_label: string;
  home_score: number | null;
  away_score: number | null;
}

function toMatch(r: MatchRow): Match {
  return {
    num: r.num,
    stage: r.stage as Match['stage'],
    group: r.group_name,
    kickoff: r.kickoff,
    localTime: r.local_time,
    timezone: r.timezone,
    venueCity: r.venue_city,
    homeCode: r.home_code,
    homeLabel: r.home_label,
    awayCode: r.away_code,
    awayLabel: r.away_label,
    homeScore: r.home_score,
    awayScore: r.away_score,
  };
}

export function getMatches(db: DB): Match[] {
  const rows = db
    .prepare(
      /* sql */ `
      SELECT m.*, r.home_score, r.away_score
      FROM matches m
      LEFT JOIN match_results r ON r.num = m.num
      ORDER BY m.num
    `,
    )
    .all() as MatchRow[];
  return rows.map(toMatch);
}

export function getVenues(db: DB): MatchVenue[] {
  const rows = db
    .prepare('SELECT city, stadium, country, timezone, capacity FROM venues ORDER BY city')
    .all() as MatchVenue[];
  return rows;
}

export function getMatchTeams(db: DB): MatchTeam[] {
  const rows = db
    .prepare(
      'SELECT code, name, group_name, primary_color, secondary_color FROM match_teams ORDER BY group_name, name',
    )
    .all() as {
    code: string;
    name: string;
    group_name: string | null;
    primary_color: string;
    secondary_color: string;
  }[];
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    group: r.group_name,
    colors: { primary: r.primary_color, secondary: r.secondary_color },
  }));
}

function matchExists(db: DB, num: number): boolean {
  return db.prepare('SELECT 1 FROM matches WHERE num = ?').get(num) !== undefined;
}

/**
 * Sets (or overwrites) a match result from a user edit. Marks the row `source =
 * 'user'` so the live results feed will never overwrite it. Returns false if the
 * match is unknown.
 */
export function setResult(db: DB, num: number, homeScore: number, awayScore: number): boolean {
  if (!matchExists(db, num)) return false;
  const h = Math.max(0, Math.floor(homeScore));
  const a = Math.max(0, Math.floor(awayScore));
  db.prepare(
    /* sql */ `
    INSERT INTO match_results (num, home_score, away_score, source, updated_at)
    VALUES (?, ?, ?, 'user', datetime('now'))
    ON CONFLICT(num) DO UPDATE SET
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      source = 'user',
      updated_at = excluded.updated_at
  `,
  ).run(num, h, a);
  return true;
}

/** Removes a result (mark the match as not-yet-played). */
export function clearResult(db: DB, num: number): boolean {
  if (!matchExists(db, num)) return false;
  db.prepare('DELETE FROM match_results WHERE num = ?').run(num);
  return true;
}
