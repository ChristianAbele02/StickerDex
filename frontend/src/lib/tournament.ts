/** Display helpers for the tournament views (matches, standings, bracket). */
import type { Match, MatchStage, MatchTeam, StandingRow } from '../types.ts';

export const STAGE_LABELS: Record<MatchStage, string> = {
  group: 'Group stage',
  round32: 'Round of 32',
  round16: 'Round of 16',
  quarter: 'Quarter-finals',
  semi: 'Semi-finals',
  third: 'Third-place play-off',
  final: 'Final',
};

export const STAGE_ORDER: MatchStage[] = [
  'group',
  'round32',
  'round16',
  'quarter',
  'semi',
  'third',
  'final',
];

/** Build a quick code -> team lookup. */
export function teamIndex(teams: MatchTeam[]): Map<string, MatchTeam> {
  return new Map(teams.map((t) => [t.code, t]));
}

export function isPlayed(m: Match): boolean {
  return m.homeScore !== null && m.awayScore !== null;
}

/** The user's local date key (YYYY-MM-DD) for grouping fixtures by day. */
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** A friendly local date heading, e.g. "Sat, Jun 13". */
export function formatDateHeading(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** The user's local kickoff time, e.g. "8:00 PM". */
export function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export interface ResolvedSlot {
  code: string | null;
  /** Display name — a real team once known, else the placeholder (e.g. "1A"). */
  label: string;
  /** True when this is still an unresolved placeholder. */
  pending: boolean;
}

/**
 * Resolve a knockout slot label ("1A", "2B", "W74", "L101", "3A/B/C/D/F") to a
 * concrete team where possible, using results + standings. Best-third slots and
 * not-yet-decided matches stay as readable placeholders.
 */
export function resolveSlot(
  label: string,
  matchByNum: Map<number, Match>,
  standings: StandingRow[],
  teams: Map<string, MatchTeam>,
): ResolvedSlot {
  // Winner / loser of a specific match.
  const wl = label.match(/^([WL])(\d+)$/);
  if (wl) {
    const m = matchByNum.get(Number(wl[2]));
    if (m && isPlayed(m) && m.homeScore !== m.awayScore) {
      const homeWon = (m.homeScore as number) > (m.awayScore as number);
      const winSide = homeWon ? 'home' : 'away';
      const side = wl[1] === 'W' ? winSide : homeWon ? 'away' : 'home';
      const code = side === 'home' ? m.homeCode : m.awayCode;
      const name = side === 'home' ? m.homeLabel : m.awayLabel;
      return { code, label: code ? teams.get(code)?.name ?? name : name, pending: false };
    }
    return { code: null, label, pending: true };
  }

  // Group winner / runner-up, e.g. "1A" or "2B".
  const pos = label.match(/^([12])([A-L])$/);
  if (pos) {
    const rank = Number(pos[1]);
    const group = pos[2];
    const groupRows = standings.filter((r) => r.group === group);
    const complete = groupRows.length > 0 && groupRows.every((r) => r.played >= 3);
    const row = groupRows.find((r) => r.rank === rank);
    if (complete && row) {
      return { code: row.code, label: row.name, pending: false };
    }
    return { code: row?.code ?? null, label, pending: true };
  }

  // Best-third-place slots and anything else: leave as a placeholder.
  return { code: null, label, pending: true };
}

/** Win/draw/win bar segments as percentages (rounded, summing to ~100). */
export function predictionPercents(p: { homeWin: number; draw: number; awayWin: number }): {
  home: number;
  draw: number;
  away: number;
} {
  return {
    home: Math.round(p.homeWin * 100),
    draw: Math.round(p.draw * 100),
    away: Math.round(p.awayWin * 100),
  };
}
