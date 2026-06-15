import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { createMemoryDb } from '../src/db/index.ts';
import { seed } from '../src/db/seed.ts';
import { seedTournament } from '../src/db/seed-matches.ts';
import type { Sticker } from '../src/types.ts';

const fixture: Sticker[] = [
  {
    code: 'ARG1',
    section: 'team',
    groupName: 'A',
    teamCode: 'ARG',
    teamName: 'Argentina',
    number: 1,
    type: 'badge',
    playerName: 'Argentina (Team Badge)',
    position: null,
    club: null,
    jersey: null,
    caps: null,
    goals: null,
    isFoil: true,
    verified: true,
  },
  {
    code: 'ARG17',
    section: 'team',
    groupName: 'A',
    teamCode: 'ARG',
    teamName: 'Argentina',
    number: 17,
    type: 'player',
    playerName: 'Lionel Messi',
    position: 'Forward',
    club: 'Inter Miami',
    jersey: 10,
    caps: 199,
    goals: 117,
    isFoil: false,
    verified: true,
  },
];

describe('API routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const db = createMemoryDb();
    seed(db, fixture);
    seedTournament(db);
    app = await buildApp({ db });
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the catalog', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/stickers' });
    expect(res.statusCode).toBe(200);
    expect(res.json().stickers).toHaveLength(2);
  });

  it('starts with an empty (all-zero) collection', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/collection' });
    expect(res.json().collection).toEqual({ ARG1: 0, ARG17: 0 });
  });

  it('increments a sticker count', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/collection/ARG17' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ code: 'ARG17', count: 1 });
  });

  it('rejects an unknown sticker code', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/collection/ZZZ9' });
    expect(res.statusCode).toBe(404);
  });

  it('reflects ownership in stats', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/stats' });
    const stats = res.json();
    expect(stats.overall.total).toBe(2);
    expect(stats.overall.owned).toBe(1);
    expect(stats.overall.completionPct).toBe(50);
  });

  it('exports a missing-list CSV', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/export?format=csv&filter=missing' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).toContain('ARG1'); // badge still missing
    expect(res.body).not.toContain('Lionel Messi'); // ARG17 owned -> excluded
  });

  it('exports duplicates with a spare-count column', async () => {
    // Bump ARG17 to 3 copies (2 spare) so it qualifies as a duplicate.
    await app.inject({
      method: 'PATCH',
      url: '/api/collection/ARG17',
      payload: { op: 'set', count: 3 },
    });

    const res = await app.inject({ method: 'GET', url: '/api/export?format=json&filter=dupes' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({ code: 'ARG17', count: 3, spare: 2 });

    const csv = await app.inject({ method: 'GET', url: '/api/export?format=csv&filter=dupes' });
    expect(csv.body.split('\n')[0]).toContain('spare');
  });

  it('serves the 104-match schedule with venues and teams', async () => {
    const matches = (await app.inject({ method: 'GET', url: '/api/matches' })).json().matches;
    expect(matches).toHaveLength(104);
    const venues = (await app.inject({ method: 'GET', url: '/api/venues' })).json().venues;
    expect(venues).toHaveLength(16);
    const teams = (await app.inject({ method: 'GET', url: '/api/match-teams' })).json().teams;
    expect(teams).toHaveLength(48);
  });

  it('records a match result and reflects it in standings', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/matches/1/result',
      payload: { homeScore: 2, awayScore: 0 },
    });
    expect(put.statusCode).toBe(200);

    const standings = (await app.inject({ method: 'GET', url: '/api/standings' })).json().standings;
    const groupA = standings.filter((r: { group: string }) => r.group === 'A');
    const leader = groupA.find((r: { rank: number }) => r.rank === 1);
    expect(leader.points).toBe(3);
  });

  it('rejects an invalid score and an unknown match', async () => {
    const bad = await app.inject({
      method: 'PUT',
      url: '/api/matches/1/result',
      payload: { homeScore: -1, awayScore: 0 },
    });
    expect(bad.statusCode).toBe(400);
    const missing = await app.inject({
      method: 'PUT',
      url: '/api/matches/9999/result',
      payload: { homeScore: 1, awayScore: 0 },
    });
    expect(missing.statusCode).toBe(404);
  });
});
