import type { FastifyInstance } from 'fastify';
import { getAllStickers, getTeams } from '../services/catalog.ts';

export async function stickerRoutes(app: FastifyInstance): Promise<void> {
  // Full catalog in booklet order.
  app.get('/api/stickers', async () => {
    return { stickers: getAllStickers(app.db) };
  });

  // Team metadata (names, group, colors).
  app.get('/api/teams', async () => {
    return { teams: getTeams() };
  });
}
