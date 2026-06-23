/**
 * Builds the Fastify application: plugins, auth, routes. Kept separate from the
 * server bootstrap (index.ts) so tests can build an app against an in-memory DB.
 */
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
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
import { resultsRoutes } from './routes/results.ts';

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
  await app.register(resultsRoutes);

  // Optionally serve the built React SPA from the same origin as the API. Only
  // active when STICKERDEX_PUBLIC_DIR points at a frontend `dist` folder — used
  // by the desktop (Electron) build and any single-process localhost run. When
  // unset, dev (Vite proxy) and Docker (nginx) keep serving the SPA themselves,
  // so this is a no-op for those Plan-B flows.
  const publicDir = process.env.STICKERDEX_PUBLIC_DIR;
  if (publicDir) {
    await app.register(fastifyStatic, { root: publicDir, wildcard: false });
    // SPA fallback: any non-API GET that isn't a real asset returns index.html
    // so client-side views resolve; API/non-GET still get a JSON 404.
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: 'Not found' });
    });
  }

  return app;
}
