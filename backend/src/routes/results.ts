import type { FastifyInstance } from 'fastify';
import { liveResultsEnabled, refreshResults } from '../services/resultsFeed.ts';

export async function resultsRoutes(app: FastifyInstance): Promise<void> {
  // Manually pull the latest played scores from the live feed right now.
  app.post('/api/results/refresh', async (_req, reply) => {
    if (!liveResultsEnabled()) {
      return reply.code(503).send({ error: 'Live results feed is disabled (LIVE_RESULTS=off).' });
    }
    try {
      const summary = await refreshResults(app.db);
      return { summary };
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });
}
