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
