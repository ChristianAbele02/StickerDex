/** Helpers for the Teams view: position styling and per-team "fun facts". */
import type { CollectionMap, Sticker } from '../types.ts';

export interface PositionMeta {
  abbr: string;
  /** Tailwind classes for the colored position pill. */
  pill: string;
}

export function positionMeta(position: string | null): PositionMeta {
  switch (position) {
    case 'Goalkeeper':
      return { abbr: 'GK', pill: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' };
    case 'Defender':
      return { abbr: 'DEF', pill: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' };
    case 'Midfielder':
      return { abbr: 'MID', pill: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
    case 'Forward':
      return { abbr: 'FWD', pill: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' };
    default:
      return { abbr: '—', pill: 'bg-slate-400/15 text-slate-500' };
  }
}

export interface TeamFacts {
  players: Sticker[];
  squadSize: number;
  owned: number;
  total: number; // all 20 slots
  completionPct: number;
  totalCaps: number;
  totalGoals: number;
  mostCapped: Sticker | null;
  topScorer: Sticker | null;
  clubCount: number;
  /** Position breakdown counts. */
  byPosition: { GK: number; DEF: number; MID: number; FWD: number };
}

/** Compute display facts for a team from its stickers + the collection. */
export function teamFacts(all: Sticker[], collection: CollectionMap): TeamFacts {
  const teamStickers = all;
  const players = all.filter((s) => s.type === 'player');
  const owned = teamStickers.filter((s) => (collection[s.code] ?? 0) > 0).length;
  const total = teamStickers.length;

  let totalCaps = 0;
  let totalGoals = 0;
  let mostCapped: Sticker | null = null;
  let topScorer: Sticker | null = null;
  const clubs = new Set<string>();
  const byPosition = { GK: 0, DEF: 0, MID: 0, FWD: 0 };

  for (const p of players) {
    if (p.caps != null) totalCaps += p.caps;
    if (p.goals != null) totalGoals += p.goals;
    if (p.caps != null && (!mostCapped || p.caps > (mostCapped.caps ?? -1))) mostCapped = p;
    if (p.goals != null && (!topScorer || p.goals > (topScorer.goals ?? -1))) topScorer = p;
    if (p.club) clubs.add(p.club);
    const abbr = positionMeta(p.position).abbr;
    if (abbr === 'GK') byPosition.GK++;
    else if (abbr === 'DEF') byPosition.DEF++;
    else if (abbr === 'MID') byPosition.MID++;
    else if (abbr === 'FWD') byPosition.FWD++;
  }

  return {
    players,
    squadSize: players.length,
    owned,
    total,
    completionPct: total === 0 ? 0 : Math.round((owned / total) * 100),
    totalCaps,
    totalGoals,
    mostCapped,
    topScorer,
    clubCount: clubs.size,
    byPosition,
  };
}
