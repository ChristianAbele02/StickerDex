import type { FastifyInstance } from 'fastify';
import { getMatches, getMatchTeams } from '../services/matches.ts';
import { runSimulation, simulateOnce } from '../services/simulator.ts';

const MAX_RUNS = 50000;
const DEFAULT_RUNS = 10000;

export async function simulateRoutes(app: FastifyInstance): Promise<void> {
  // Aggregated forecast: per-team probability of reaching each stage / winning.
  app.get<{ Querystring: { runs?: string } }>('/api/simulate', async (req) => {
    const requested = Number(req.query.runs);
    const runs = Number.isFinite(requested)
      ? Math.min(MAX_RUNS, Math.max(1000, Math.floor(requested)))
      : DEFAULT_RUNS;
    const teams = getMatchTeams(app.db);
    const matches = getMatches(app.db);
    return { runs, teams: runSimulation(matches, teams, runs) };
  });

  // A single random tournament with its fully filled-in bracket and champion.
  app.get<{ Querystring: { seed?: string } }>('/api/simulate/once', async (req) => {
    const seed = Number(req.query.seed);
    const teams = getMatchTeams(app.db);
    const matches = getMatches(app.db);
    return simulateOnce(matches, teams, Number.isFinite(seed) ? seed : undefined);
  });
}
