/**
 * Pure aggregation of collection progress. Kept dependency-free so it is trivial
 * to unit test and reuse on the frontend if desired.
 */
import type {
  CollectionMap,
  ProgressStats,
  StatsResponse,
  Sticker,
  TeamStats,
} from '../types.ts';

const STICKERS_PER_PACK = 7;

function progressFor(stickers: Sticker[], collection: CollectionMap): ProgressStats {
  let owned = 0;
  let duplicates = 0;
  for (const s of stickers) {
    const count = collection[s.code] ?? 0;
    if (count >= 1) owned++;
    if (count > 1) duplicates += count - 1;
  }
  const total = stickers.length;
  const missing = total - owned;
  const completionPct = total === 0 ? 0 : Math.round((owned / total) * 1000) / 10;
  return { total, owned, missing, duplicates, completionPct };
}

/**
 * Naive coupon-collector-ish estimate of packs still required, assuming fresh
 * packs and no duplicates from what you still need. This is a lower bound, the
 * same simplification the popular spreadsheet trackers use.
 */
function estimatePacksRemaining(missing: number): number {
  return Math.ceil(missing / STICKERS_PER_PACK);
}

export function computeStats(catalog: Sticker[], collection: CollectionMap): StatsResponse {
  const overall = progressFor(catalog, collection);

  const teamMap = new Map<string, Sticker[]>();
  for (const s of catalog) {
    if (s.section !== 'team' || !s.teamCode) continue;
    const list = teamMap.get(s.teamCode) ?? [];
    list.push(s);
    teamMap.set(s.teamCode, list);
  }

  const byTeam: TeamStats[] = [...teamMap.entries()].map(([teamCode, stickers]) => {
    const p = progressFor(stickers, collection);
    return {
      ...p,
      teamCode,
      teamName: stickers[0].teamName,
      groupName: stickers[0].groupName,
    };
  });
  byTeam.sort((a, b) => (a.groupName ?? '').localeCompare(b.groupName ?? '') || a.teamCode.localeCompare(b.teamCode));

  return {
    overall,
    estimatedPacksRemaining: estimatePacksRemaining(overall.missing),
    byTeam,
  };
}
