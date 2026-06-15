/**
 * Seeds the tournament reference tables (venues, match_teams, matches) from the
 * generated dataset, and pre-fills any already-played scores into the mutable
 * `match_results` table. Idempotent and safe on every startup:
 *   - reference rows are upserted (so dataset corrections propagate),
 *   - results are INSERT OR IGNORE (so the user's edits are never clobbered).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './index.ts';
import type { Match, MatchTeam, MatchVenue } from '../types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function load<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(__dirname, '../data', file), 'utf8')) as T;
}

export interface TournamentData {
  venues: MatchVenue[];
  teams: MatchTeam[];
  matches: Match[];
}

export function loadTournament(): TournamentData {
  return {
    venues: load<MatchVenue[]>('venues.json'),
    teams: load<MatchTeam[]>('match-teams.json'),
    matches: load<Match[]>('matches.json'),
  };
}

export function seedTournament(db: DB, data: TournamentData = loadTournament()): number {
  const upsertVenue = db.prepare(/* sql */ `
    INSERT INTO venues (city, stadium, country, timezone, capacity)
    VALUES (@city, @stadium, @country, @timezone, @capacity)
    ON CONFLICT(city) DO UPDATE SET
      stadium = excluded.stadium, country = excluded.country,
      timezone = excluded.timezone, capacity = excluded.capacity
  `);
  const upsertTeam = db.prepare(/* sql */ `
    INSERT INTO match_teams (code, name, group_name, primary_color, secondary_color)
    VALUES (@code, @name, @group, @primary, @secondary)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name, group_name = excluded.group_name,
      primary_color = excluded.primary_color, secondary_color = excluded.secondary_color
  `);
  const upsertMatch = db.prepare(/* sql */ `
    INSERT INTO matches
      (num, stage, group_name, kickoff, local_time, timezone, venue_city,
       home_code, home_label, away_code, away_label)
    VALUES
      (@num, @stage, @group, @kickoff, @localTime, @timezone, @venueCity,
       @homeCode, @homeLabel, @awayCode, @awayLabel)
    ON CONFLICT(num) DO UPDATE SET
      stage = excluded.stage, group_name = excluded.group_name,
      kickoff = excluded.kickoff, local_time = excluded.local_time,
      timezone = excluded.timezone, venue_city = excluded.venue_city,
      home_code = excluded.home_code, home_label = excluded.home_label,
      away_code = excluded.away_code, away_label = excluded.away_label
  `);
  const seedResult = db.prepare(
    'INSERT OR IGNORE INTO match_results (num, home_score, away_score) VALUES (?, ?, ?)',
  );

  const run = db.transaction((d: TournamentData) => {
    for (const v of d.venues) {
      upsertVenue.run({ ...v, capacity: v.capacity ?? null });
    }
    for (const t of d.teams) {
      upsertTeam.run({
        code: t.code,
        name: t.name,
        group: t.group,
        primary: t.colors.primary,
        secondary: t.colors.secondary,
      });
    }
    for (const m of d.matches) {
      upsertMatch.run({
        num: m.num,
        stage: m.stage,
        group: m.group,
        kickoff: m.kickoff,
        localTime: m.localTime,
        timezone: m.timezone,
        venueCity: m.venueCity,
        homeCode: m.homeCode,
        homeLabel: m.homeLabel,
        awayCode: m.awayCode,
        awayLabel: m.awayLabel,
      });
      if (m.homeScore !== null && m.awayScore !== null) {
        seedResult.run(m.num, m.homeScore, m.awayScore);
      }
    }
  });

  run(data);
  return data.matches.length;
}
