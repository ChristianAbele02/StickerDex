/** Frontend mirror of the backend domain types (see backend/src/types.ts). */

export type Section = 'intro' | 'museum' | 'team' | 'coca_cola';

export type StickerType =
  | 'badge'
  | 'player'
  | 'team_photo'
  | 'legend'
  | 'emblem'
  | 'special';

export interface Sticker {
  code: string;
  section: Section;
  groupName: string | null;
  teamCode: string | null;
  teamName: string;
  number: number;
  type: StickerType;
  playerName: string;
  position: string | null;
  club: string | null;
  jersey: number | null;
  caps: number | null;
  goals: number | null;
  isFoil: boolean;
  verified: boolean;
}

export interface Team {
  teamCode: string;
  teamName: string;
  groupName: string | null;
  section: Section;
  stickerCount: number;
  colors: { primary: string; secondary: string; flag: string[] };
}

export type CollectionMap = Record<string, number>;

export interface ProgressStats {
  total: number;
  owned: number;
  missing: number;
  duplicates: number;
  completionPct: number;
}

// --- Tournament (matches, venues, standings, predictions) ------------------

export type MatchStage = 'group' | 'round32' | 'round16' | 'quarter' | 'semi' | 'third' | 'final';

export interface MatchVenue {
  city: string;
  stadium: string;
  country: string;
  timezone: string;
  capacity: number | null;
}

export interface MatchTeam {
  code: string;
  name: string;
  group: string | null;
  colors: { primary: string; secondary: string };
}

export interface Match {
  num: number;
  stage: MatchStage;
  group: string | null;
  kickoff: string;
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
  rank: number;
}

export interface MatchPrediction {
  num: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  homeElo: number;
  awayElo: number;
}

export interface SimRoundProbs {
  code: string;
  name: string;
  group: string | null;
  winGroup: number;
  advance: number;
  r16: number;
  quarter: number;
  semi: number;
  final: number;
  champion: number;
}

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

export interface SimGroupRow {
  code: string;
  name: string;
  group: string;
  points: number;
  goalDiff: number;
  goalsFor: number;
}

export interface SingleSimResult {
  seed: number | null;
  championCode: string | null;
  championName: string | null;
  bracket: SimMatch[];
  groups: SimGroupRow[];
}
