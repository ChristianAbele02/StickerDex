import type { FastifyInstance } from 'fastify';
import { getAllStickers } from '../services/catalog.ts';
import { getCollectionMap } from '../services/collection.ts';
import { computeStats } from '../services/stats.ts';

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/stats', async () => {
    const catalog = getAllStickers(app.db);
    const collection = getCollectionMap(app.db);
    return computeStats(catalog, collection);
  });
}
