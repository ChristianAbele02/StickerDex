/**
 * SQLite schema. Kept as an inline string so it works identically whether the
 * server runs from `src` (tsx) or compiled `dist` — no file-path juggling.
 *
 * `stickers` is reference data seeded from the generated catalog.
 * `collection` is the only mutable table: one row per code, `count` owned.
 */
export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS stickers (
  code        TEXT PRIMARY KEY,
  section     TEXT NOT NULL,
  group_name  TEXT,
  team_code   TEXT,
  team_name   TEXT NOT NULL,
  number      INTEGER NOT NULL,
  type        TEXT NOT NULL,
  player_name TEXT NOT NULL,
  position    TEXT,
  club        TEXT,
  jersey      INTEGER,
  caps        INTEGER,
  goals       INTEGER,
  is_foil     INTEGER NOT NULL DEFAULT 0,
  verified    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stickers_team ON stickers (team_code);
CREATE INDEX IF NOT EXISTS idx_stickers_section ON stickers (section);

CREATE TABLE IF NOT EXISTS collection (
  code       TEXT PRIMARY KEY REFERENCES stickers (code) ON DELETE CASCADE,
  count      INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tournament reference data (seeded from the generated schedule).
CREATE TABLE IF NOT EXISTS venues (
  city      TEXT PRIMARY KEY,
  stadium   TEXT NOT NULL,
  country   TEXT NOT NULL,
  timezone  TEXT NOT NULL,
  capacity  INTEGER
);

CREATE TABLE IF NOT EXISTS match_teams (
  code      TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  group_name TEXT,
  primary_color   TEXT NOT NULL,
  secondary_color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  num         INTEGER PRIMARY KEY,
  stage       TEXT NOT NULL,
  group_name  TEXT,
  kickoff     TEXT NOT NULL,
  local_time  TEXT NOT NULL,
  timezone    TEXT NOT NULL,
  venue_city  TEXT NOT NULL,
  home_code   TEXT,
  home_label  TEXT NOT NULL,
  away_code   TEXT,
  away_label  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matches_stage ON matches (stage);
CREATE INDEX IF NOT EXISTS idx_matches_group ON matches (group_name);

-- The only mutable tournament table: entered/known scores, one row per match.
-- The "source" column records who set the score: feed (auto from the live
-- results feed / seeded dataset) or user (you, in-app). The live feed only ever
-- overwrites feed rows, so your manual edits are never clobbered.
CREATE TABLE IF NOT EXISTS match_results (
  num         INTEGER PRIMARY KEY REFERENCES matches (num) ON DELETE CASCADE,
  home_score  INTEGER NOT NULL CHECK (home_score >= 0),
  away_score  INTEGER NOT NULL CHECK (away_score >= 0),
  source      TEXT NOT NULL DEFAULT 'feed',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
