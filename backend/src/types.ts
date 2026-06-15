/**
 * Shared domain types for StickerDex.
 *
 * A "sticker" is one slot in the album, identified by its Panini-style code
 * (e.g. `ARG17`). The catalog (all stickers) is static reference data; the
 * collection (how many of each you own) is the mutable per-instance state.
 */

/** Top-level album sections, in booklet order. */
export type Section = 'intro' | 'museum' | 'team' | 'coca_cola';

/** What the sticker actually depicts. */
export type StickerType =
  | 'badge' // team logo (usually foil)
  | 'player' // a single player
  | 'team_photo' // full squad photo
  | 'legend' // FIFA Museum past champion
  | 'emblem' // tournament emblem / mascot / ball
  | 'special'; // Coca-Cola or other special edition

/** One slot in the album. Reference data — does not change per user. */
export interface Sticker {
  /** Unique code, e.g. "ARG17", "FWC3", "CC9". */
  code: string;
  section: Section;
  /** Group letter A–L for team sections, otherwise null. */
  groupName: string | null;
  /** 3-letter team code (e.g. "ARG"); null for non-team sections. */
  teamCode: string | null;
  /** Display team / section name (e.g. "Argentina", "FIFA Museum"). */
  teamName: string;
  /** Sequential number within the team/section. */
  number: number;
  type: StickerType;
  /** Who/what it represents (player name, "Team Photo", legend, …). */
  playerName: string;
  /** Playing position for players, else null. */
  position: string | null;
  /** Club the player plays for (from live squad data), else null. */
  club: string | null;
  /** Shirt number (from squad data), else null. */
  jersey: number | null;
  /** International caps (appearances), else null. */
  caps: number | null;
  /** International goals, else null. */
  goals: number | null;
  /** Foil/shiny finish. */
  isFoil: boolean;
  /**
   * Whether playerName/groupName have been confirmed against an official
   * source. `false` means it is a structurally-correct placeholder that the
   * community can complete — see CONTRIBUTING.md.
   */
  verified: boolean;
}

/** A team's metadata, derived from the catalog. */
export interface Team {
  teamCode: string;
  teamName: string;
  groupName: string | null;
  section: Section;
  stickerCount: number;
  /**
   * Booklet page colors. `primary`/`secondary` drive small accents (dots,
   * progress bars); `flag` is the ordered national-flag palette used to paint
   * the team page as a gradient.
   */
  colors: { primary: string; secondary: string; flag: string[] };
}

/** Mutable ownership state: code -> count owned (0 = missing, >1 = duplicates). */
export type CollectionMap = Record<string, number>;

/** Aggregate progress for the whole album or a single team. */
export interface ProgressStats {
  total: number;
  owned: number;
  missing: number;
  duplicates: number;
  completionPct: number;
}

export interface TeamStats extends ProgressStats {
  teamCode: string;
  teamName: string;
  groupName: string | null;
}

export interface StatsResponse {
  overall: ProgressStats;
  /** Rough estimate of packs still needed to finish (7 stickers/pack). */
  estimatedPacksRemaining: number;
  byTeam: TeamStats[];
}

// ---------------------------------------------------------------------------
// Tournament: venues, teams, matches, standings (the companion side)
// ---------------------------------------------------------------------------

/** A World Cup stage. Group stage plus the knockout rounds. */
export type MatchStage = 'group' | 'round32' | 'round16' | 'quarter' | 'semi' | 'third' | 'final';

/** One of the 16 host venues. */
export interface MatchVenue {
  city: string;
  stadium: string;
  /** ISO country code: 'us' | 'ca' | 'mx'. */
  country: string;
  /** Standard offset, e.g. "UTC-6" (host cities don't observe DST shifts here). */
  timezone: string;
  capacity: number | null;
}

/** A qualified national team in the tournament (distinct from album teams). */
export interface MatchTeam {
  /** FIFA 3-letter code, e.g. "ARG". */
  code: string;
  name: string;
  /** Group letter A–L. */
  group: string | null;
  colors: { primary: string; secondary: string };
}

/**
 * One fixture. `homeCode`/`awayCode` are set for known teams; for knockout
 * slots that depend on results they are null and `homeLabel`/`awayLabel` hold
 * the placeholder (e.g. "1A", "W74"). `homeScore`/`awayScore` are the default
 * (already-played) result from the dataset; live edits live in `match_results`.
 */
export interface Match {
  num: number;
  stage: MatchStage;
  group: string | null;
  /** ISO-8601 UTC kickoff. */
  kickoff: string;
  /** Local kickoff time "HH:MM" and its venue offset, for display. */
  localTime: string;
  timezone: string;
  venueCity: string;
  homeCode: string | null;
  homeLabel: string;
  awayCode: string | null;
  awayLabel: string;
  homeScore: number | null;
  awayScore: number | null;
}

/** A single team's row in a group standings table. */
export interface StandingRow {
  code: string;
  name: string;
  group: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** 1-based rank within the group. */
  rank: number;
}

/** Win / draw / win probabilities for a fixture (Elo model, summing to 1). */
export interface MatchPrediction {
  num: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  homeElo: number;
  awayElo: number;
}

/** Monte Carlo forecast: a team's probability of reaching each stage (0–1). */
export interface SimRoundProbs {
  code: string;
  name: string;
  group: string | null;
  /** P(finish 1st in group). */
  winGroup: number;
  /** P(advance to the Round of 32). */
  advance: number;
  r16: number;
  quarter: number;
  semi: number;
  final: number;
  champion: number;
}

/** One simulated knockout fixture in a single-run bracket. */
export interface SimMatch {
  num: number;
  stage: MatchStage;
  homeCode: string;
  homeName: string;
  awayCode: string;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
  winnerCode: string;
  decidedOnPens: boolean;
}

/** A simple group-standings row from a single simulated run. */
export interface SimGroupRow {
  code: string;
  name: string;
  group: string;
  points: number;
  goalDiff: number;
  goalsFor: number;
}

/** Result of simulating one full tournament (for the interactive bracket). */
export interface SingleSimResult {
  seed: number | null;
  championCode: string | null;
  championName: string | null;
  bracket: SimMatch[];
  groups: SimGroupRow[];
}
