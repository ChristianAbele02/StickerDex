import { describe, expect, it } from 'vitest';
import { progressFor } from '../src/lib/stats.ts';
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
