import { describe, expect, it } from 'vitest';
import { createMemoryDb } from '../src/db/index.ts';
import { seedTournament } from '../src/db/seed-matches.ts';
import { setResult } from '../src/services/matches.ts';
import { applyResults, refreshResults } from '../src/services/resultsFeed.ts';
import { parseResults } from '../src/lib/openfootball.ts';

const CUP_SAMPLE = `
▪ Matchday 1 | Thu Jun 11
  13:00 UTC-6     Mexico  2-0 (1-0)  South Africa        @ Mexico City
  20:00 UTC-6     South Korea  2-1 (0-0)  Czech Republic     @ Guadalajara (Zapopan)
                  Ladislav Krejcí 59')
▪ Matchday 5 | Mon Jun 15
  19:00 UTC-6     Mexico            v South Korea    @ Guadalajara (Zapopan)
  12:00 UTC-4     Atlantis  3-3 (1-1) Mythica   @ Nowhere
`;

function score(db: ReturnType<typeof createMemoryDb>, num: number) {
  return db.prepare('SELECT home_score AS h, away_score AS a, source FROM match_results WHERE num = ?').get(num) as
    | { h: number; a: number; source: string }
    | undefined;
}

describe('parseResults', () => {
  it('parses only played fixtures and maps known teams to codes', () => {
    const r = parseResults(CUP_SAMPLE);
    // Mexico 2-0 RSA and KOR 2-1 CZE are played & known; the "v" line and the
    // unknown "Atlantis/Mythica" line are skipped.
    expect(r).toEqual([
      { homeCode: 'MEX', awayCode: 'RSA', homeScore: 2, awayScore: 0 },
      { homeCode: 'KOR', awayCode: 'CZE', homeScore: 2, awayScore: 1 },
    ]);
  });
});

describe('applyResults', () => {
  it('inserts new feed results and is idempotent', () => {
    const db = createMemoryDb();
    seedTournament(db);
    db.exec('DELETE FROM match_results');

    const fx = db
      .prepare('SELECT num, home_code AS home, away_code AS away FROM matches WHERE home_code IS NOT NULL LIMIT 1')
      .get() as { num: number; home: string; away: string };

    const first = applyResults(db, [
      { homeCode: fx.home, awayCode: fx.away, homeScore: 3, awayScore: 1 },
    ]);
    expect(first.added).toBe(1);
    expect(score(db, fx.num)).toMatchObject({ h: 3, a: 1, source: 'feed' });

    // Same score again → unchanged.
    expect(applyResults(db, [{ homeCode: fx.home, awayCode: fx.away, homeScore: 3, awayScore: 1 }]).unchanged).toBe(1);

    // Upstream correction → updated.
    expect(applyResults(db, [{ homeCode: fx.home, awayCode: fx.away, homeScore: 4, awayScore: 1 }]).updated).toBe(1);
    expect(score(db, fx.num)).toMatchObject({ h: 4, a: 1 });
  });

  it('never overwrites a user-entered result', () => {
    const db = createMemoryDb();
    seedTournament(db);
    db.exec('DELETE FROM match_results');

    const fx = db
      .prepare('SELECT num, home_code AS home, away_code AS away FROM matches WHERE home_code IS NOT NULL LIMIT 1')
      .get() as { num: number; home: string; away: string };

    setResult(db, fx.num, 9, 9); // user edit
    expect(score(db, fx.num)).toMatchObject({ source: 'user' });

    const summary = applyResults(db, [{ homeCode: fx.home, awayCode: fx.away, homeScore: 1, awayScore: 0 }]);
    expect(summary.unchanged).toBe(1);
    expect(summary.updated).toBe(0);
    expect(score(db, fx.num)).toMatchObject({ h: 9, a: 9, source: 'user' }); // untouched
  });

  it('counts results with no matching fixture as unmatched', () => {
    const db = createMemoryDb();
    seedTournament(db);
    const summary = applyResults(db, [{ homeCode: 'XXX', awayCode: 'YYY', homeScore: 1, awayScore: 0 }]);
    expect(summary.unmatched).toBe(1);
  });
});

describe('refreshResults (injected fetch, no network)', () => {
  it('fetches, parses and applies, tolerating a missing finals file', async () => {
    const db = createMemoryDb();
    seedTournament(db);
    db.exec('DELETE FROM match_results');

    const fetchImpl = async (url: string) => {
      if (url.includes('finals')) throw new Error('404'); // optional file missing
      return CUP_SAMPLE;
    };
    const summary = await refreshResults(db, {
      cupUrl: 'http://x/cup.txt',
      finalsUrl: 'http://x/cup_finals.txt',
      fetchImpl,
    });
    expect(summary.added).toBe(2); // MEX-RSA and KOR-CZE
    expect(summary.total).toBe(2);
  });
});
