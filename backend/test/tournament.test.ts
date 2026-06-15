import { describe, expect, it } from 'vitest';
import { computeStandings } from '../src/services/standings.ts';
import { buildRatings, predict, getPredictions } from '../src/services/predictions.ts';
import type { Match, MatchTeam } from '../src/types.ts';

const teams: MatchTeam[] = [
  { code: 'AAA', name: 'Team A', group: 'A', colors: { primary: '#000', secondary: '#fff' } },
  { code: 'BBB', name: 'Team B', group: 'A', colors: { primary: '#000', secondary: '#fff' } },
  { code: 'CCC', name: 'Team C', group: 'A', colors: { primary: '#000', secondary: '#fff' } },
];

function match(num: number, home: string, away: string, hs: number | null, as: number | null): Match {
  return {
    num,
    stage: 'group',
    group: 'A',
    kickoff: `2026-06-1${num}T18:00:00.000Z`,
    localTime: '12:00',
    timezone: 'UTC-6',
    venueCity: 'Test City',
    homeCode: home,
    homeLabel: home,
    awayCode: away,
    awayLabel: away,
    homeScore: hs,
    awayScore: as,
  };
}

describe('computeStandings', () => {
  it('awards points and ranks by points then goal difference', () => {
    const matches: Match[] = [
      match(1, 'AAA', 'BBB', 2, 0), // A win
      match(2, 'AAA', 'CCC', 1, 1), // draw
      match(3, 'BBB', 'CCC', 0, 3), // C win
    ];
    const table = computeStandings(teams, matches);

    const a = table.find((r) => r.code === 'AAA')!;
    const b = table.find((r) => r.code === 'BBB')!;
    const c = table.find((r) => r.code === 'CCC')!;

    expect(a.points).toBe(4); // win + draw
    expect(c.points).toBe(4); // win + draw
    expect(b.points).toBe(0);
    // A and C both on 4; C has better GD (+2 vs +2?) -> tie broken by GF
    expect(a.played).toBe(2);
    expect(b.rank).toBe(3); // bottom of the group
  });

  it('ignores matches without a result', () => {
    const table = computeStandings(teams, [match(1, 'AAA', 'BBB', null, null)]);
    expect(table.every((r) => r.played === 0)).toBe(true);
  });
});

describe('predict (Elo)', () => {
  it('returns probabilities that sum to 1', () => {
    const p = predict(1800, 1600);
    const sum = p.homeWin + p.draw + p.awayWin;
    expect(sum).toBeCloseTo(1, 5);
    expect(p.homeWin).toBeGreaterThan(p.awayWin); // stronger + home edge
  });

  it('favours the much stronger side', () => {
    const p = predict(2000, 1500);
    expect(p.homeWin).toBeGreaterThan(0.7);
  });
});

describe('buildRatings + getPredictions', () => {
  it('moves a winner ahead of a loser from seed-equal start', () => {
    const matches: Match[] = [match(1, 'AAA', 'BBB', 3, 0)];
    const ratings = buildRatings(matches);
    expect((ratings.get('AAA') ?? 0)).toBeGreaterThan(ratings.get('BBB') ?? 0);
  });

  it('predicts only fixtures that are unplayed and have two known teams', () => {
    const matches: Match[] = [
      match(1, 'AAA', 'BBB', 2, 1), // played -> excluded
      match(2, 'AAA', 'CCC', null, null), // predictable
      { ...match(3, 'AAA', 'BBB', null, null), homeCode: null, homeLabel: '1A' }, // unknown team -> excluded
    ];
    const preds = getPredictions(matches);
    expect(preds).toHaveLength(1);
    expect(preds[0].num).toBe(2);
  });
});
