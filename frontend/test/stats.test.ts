import { describe, expect, it } from 'vitest';
import { packEstimate, progressFor } from '../src/lib/stats.ts';
import type { Sticker } from '../src/types.ts';

const s = (code: string): Sticker => ({
  code,
  section: 'team',
  groupName: 'A',
  teamCode: 'ARG',
  teamName: 'Argentina',
  number: 1,
  type: 'player',
  playerName: code,
  position: null,
  club: null,
  jersey: null,
  caps: null,
  goals: null,
  isFoil: false,
  verified: false,
});

describe('progressFor', () => {
  it('computes owned, missing, duplicates and percentage', () => {
    const catalog = [s('A'), s('B'), s('C'), s('D')];
    const p = progressFor(catalog, { A: 1, B: 2, C: 0 });
    expect(p.owned).toBe(2);
    expect(p.missing).toBe(2);
    expect(p.duplicates).toBe(1);
    expect(p.completionPct).toBe(50);
  });
});

describe('packEstimate (coupon collector)', () => {
  it('is all-zero for a complete album', () => {
    expect(packEstimate(100, 0, 5)).toEqual({
      bestCasePacks: 0,
      expectedStickers: 0,
      expectedPacks: 0,
      p90Packs: 0,
    });
  });

  it('matches the classic E = N·H_N for a full collect-from-scratch', () => {
    // N = 4, H_4 = 1 + 1/2 + 1/3 + 1/4 = 25/12 ≈ 2.0833 ⇒ E ≈ 8.33 stickers.
    const e = packEstimate(4, 4, 1);
    expect(e.expectedStickers).toBe(8);
    expect(e.expectedPacks).toBe(9); // ceil(8.33)
    expect(e.bestCasePacks).toBe(4); // ceil(4/1)
    expect(e.p90Packs).toBeGreaterThanOrEqual(e.expectedPacks);
  });

  it('expected always meets or exceeds the best case, scaled by pack size', () => {
    const e = packEstimate(700, 200, 7);
    expect(e.bestCasePacks).toBe(Math.ceil(200 / 7));
    expect(e.expectedPacks).toBeGreaterThan(e.bestCasePacks);
    expect(e.p90Packs).toBeGreaterThanOrEqual(e.expectedPacks);
  });
});
