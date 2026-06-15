/** Client-side progress math so the UI updates instantly without a round-trip. */
import type { CollectionMap, ProgressStats, Sticker } from '../types.ts';

export function progressFor(stickers: Sticker[], collection: CollectionMap): ProgressStats {
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

export interface PackEstimate {
  /** Best case: every remaining pack is all-new stickers. */
  bestCasePacks: number;
  /** Expected number of single stickers to buy (coupon-collector mean). */
  expectedStickers: number;
  /** Expected number of packs to buy. */
  expectedPacks: number;
  /** 90%-confidence upper bound on packs (you'll *probably* need no more). */
  p90Packs: number;
}

/**
 * "How many more packs?" modelled as the classic **coupon-collector problem**.
 *
 * With `total` distinct, equally-likely stickers and `missing` still needed, the
 * number of random single stickers you must buy to obtain every missing one has
 *   mean      E = total · Σ_{j=1..missing} 1/j           ( = total · H_missing )
 *   variance  V = total² · Σ_{j=1..missing} 1/j²  −  total · H_missing
 * (a sum of geometric waiting times with success probabilities j/total). Packs of
 * `perPack` stickers ⇒ divide by perPack. The 90% bound uses mean + 1.2816·√V.
 *
 * Assumes stickers are evenly distributed and independent across packs (the
 * standard model); real distributions vary, so treat these as guidance.
 */
export function packEstimate(total: number, missing: number, perPack: number): PackEstimate {
  const k = Math.max(1, perPack);
  if (missing <= 0 || total <= 0) {
    return { bestCasePacks: 0, expectedStickers: 0, expectedPacks: 0, p90Packs: 0 };
  }
  let h = 0;
  let h2 = 0;
  for (let j = 1; j <= missing; j++) {
    h += 1 / j;
    h2 += 1 / (j * j);
  }
  const mean = total * h;
  const variance = total * total * h2 - total * h;
  const p90 = mean + 1.2816 * Math.sqrt(Math.max(0, variance));
  return {
    bestCasePacks: Math.ceil(missing / k),
    expectedStickers: Math.round(mean),
    expectedPacks: Math.ceil(mean / k),
    p90Packs: Math.ceil(p90 / k),
  };
}
