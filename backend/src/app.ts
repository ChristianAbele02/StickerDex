/**
 * Builds the Fastify application: plugins, auth, routes. Kept separate from the
 * server bootstrap (index.ts) so tests can build an app against an in-memory DB.
 */
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { DB } from './db/index.ts';
import { registerAuth } from './auth.ts';
import { stickerRoutes } from './routes/stickers.ts';
import { collectionRoutes } from './routes/collection.ts';
import { statsRoutes } from './routes/stats.ts';
import { exportRoutes } from './routes/export.ts';
import { matchRoutes } from './routes/matches.ts';
import { simulateRoutes } from './routes/simulate.ts';
import { backupRoutes } from './routes/backups.ts';

declare module 'fastify' {
  interface FastifyInstance {
    db: DB;
  }
}

export interface BuildOptions {
  db: DB;
  logger?: boolean;
}

export async function buildApp({ db, logger = false }: BuildOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  app.decorate('db', db);

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie, {
    secret: process.env.STICKERDEX_SECRET ?? 'stickerdex-dev-secret',
  });

  registerAuth(app);

  app.get('/api/health', async () => ({ status: 'ok' }));

  await app.register(stickerRoutes);
  await app.register(collectionRoutes);
  await app.register(statsRoutes);
  await app.register(exportRoutes);
  await app.register(matchRoutes);
  await app.register(simulateRoutes);
  await app.register(backupRoutes);

  return app;
}
