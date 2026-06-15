import { describe, expect, it } from 'vitest';
import { computeStats } from '../src/services/stats.ts';
import type { Sticker } from '../src/types.ts';

function sticker(code: string, teamCode: string, number: number): Sticker {
  return {
    code,
    section: 'team',
    groupName: 'A',
    teamCode,
    teamName: teamCode,
    number,
    type: 'player',
    playerName: `${teamCode} ${number}`,
    position: 'Forward',
    club: null,
    jersey: null,
    caps: null,
    goals: null,
    isFoil: false,
    verified: false,
  };
}

const catalog: Sticker[] = [
  sticker('AAA1', 'AAA', 1),
  sticker('AAA2', 'AAA', 2),
  sticker('BBB1', 'BBB', 1),
  sticker('BBB2', 'BBB', 2),
];

describe('computeStats', () => {
  it('reports zero progress for an empty collection', () => {
    const stats = computeStats(catalog, {});
    expect(stats.overall.total).toBe(4);
    expect(stats.overall.owned).toBe(0);
    expect(stats.overall.missing).toBe(4);
    expect(stats.overall.completionPct).toBe(0);
  });

  it('counts owned, missing and duplicates correctly', () => {
    const stats = computeStats(catalog, { AAA1: 1, AAA2: 3, BBB1: 0 });
    expect(stats.overall.owned).toBe(2); // AAA1, AAA2
    expect(stats.overall.missing).toBe(2); // BBB1, BBB2
    expect(stats.overall.duplicates).toBe(2); // AAA2 has 3 -> 2 extra
    expect(stats.overall.completionPct).toBe(50);
  });

  it('estimates packs remaining at 7 stickers per pack', () => {
    const stats = computeStats(catalog, { AAA1: 1 }); // 3 missing
    expect(stats.estimatedPacksRemaining).toBe(1);
  });

  it('breaks down progress per team', () => {
    const stats = computeStats(catalog, { AAA1: 1, AAA2: 1 });
    const aaa = stats.byTeam.find((t) => t.teamCode === 'AAA');
    const bbb = stats.byTeam.find((t) => t.teamCode === 'BBB');
    expect(aaa?.completionPct).toBe(100);
    expect(bbb?.completionPct).toBe(0);
  });
});
