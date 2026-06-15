import type { FastifyInstance } from 'fastify';
import {
  clearResult,
  getMatches,
  getMatchTeams,
  getVenues,
  setResult,
} from '../services/matches.ts';
import { computeStandings } from '../services/standings.ts';
import { getPredictions } from '../services/predictions.ts';

interface ResultBody {
  homeScore?: number;
  awayScore?: number;
}

export async function matchRoutes(app: FastifyInstance): Promise<void> {
  // All fixtures (joined with any entered result), in match order.
  app.get('/api/matches', async () => ({ matches: getMatches(app.db) }));

  // The 16 host venues.
  app.get('/api/venues', async () => ({ venues: getVenues(app.db) }));

  // The 48 tournament teams (distinct from album teams).
  app.get('/api/match-teams', async () => ({ teams: getMatchTeams(app.db) }));

  // Live group standings computed from entered results.
  app.get('/api/standings', async () => ({
    standings: computeStandings(getMatchTeams(app.db), getMatches(app.db)),
  }));

  // Elo win/draw/win predictions for upcoming fixtures.
  app.get('/api/predictions', async () => ({ predictions: getPredictions(getMatches(app.db)) }));

  // Enter or overwrite a score.
  app.put<{ Params: { num: string }; Body: ResultBody }>(
    '/api/matches/:num/result',
    async (req, reply) => {
      const num = Number(req.params.num);
      const { homeScore, awayScore } = req.body ?? {};
      if (
        !Number.isInteger(num) ||
        typeof homeScore !== 'number' ||
        typeof awayScore !== 'number' ||
        homeScore < 0 ||
        awayScore < 0
      ) {
        return reply.code(400).send({ error: 'homeScore and awayScore must be non-negative integers' });
      }
      if (!setResult(app.db, num, homeScore, awayScore)) {
        return reply.code(404).send({ error: `Unknown match: ${num}` });
      }
      return { num, homeScore: Math.floor(homeScore), awayScore: Math.floor(awayScore) };
    },
  );

  // Clear a score (mark not played).
  app.delete<{ Params: { num: string } }>('/api/matches/:num/result', async (req, reply) => {
    const num = Number(req.params.num);
    if (!clearResult(app.db, num)) {
      return reply.code(404).send({ error: `Unknown match: ${num}` });
    }
    return { num, cleared: true };
  });
}
