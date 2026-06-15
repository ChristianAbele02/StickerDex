import type { FastifyInstance } from 'fastify';
import {
  adjustCount,
  bulkSet,
  getCollectionMap,
  replaceCollection,
  setCount,
} from '../services/collection.ts';

interface PatchBody {
  op?: 'increment' | 'decrement' | 'set';
  count?: number;
}

export async function collectionRoutes(app: FastifyInstance): Promise<void> {
  // Current ownership map: { code: count }.
  app.get('/api/collection', async () => {
    return { collection: getCollectionMap(app.db) };
  });

  // Update a single code: increment / decrement / set absolute count.
  app.patch<{ Params: { code: string }; Body: PatchBody }>(
    '/api/collection/:code',
    async (req, reply) => {
      const { code } = req.params;
      const { op = 'increment', count } = req.body ?? {};

      let result: number | null;
      if (op === 'set') {
        result = setCount(app.db, code, count ?? 0);
      } else {
        result = adjustCount(app.db, code, op === 'decrement' ? -1 : 1);
      }

      if (result === null) {
        return reply.code(404).send({ error: `Unknown sticker code: ${code}` });
      }
      return { code, count: result };
    },
  );

  // Bulk absolute-set: { updates: { code: count } }.
  app.post<{ Body: { updates?: Record<string, number> } }>(
    '/api/collection/bulk',
    async (req) => {
      const updates = req.body?.updates ?? {};
      const applied = bulkSet(app.db, updates);
      return { applied };
    },
  );

  // Replace the whole collection (restore from a backup/export).
  app.post<{ Body: { collection?: Record<string, number> } }>(
    '/api/collection/import',
    async (req) => {
      const applied = replaceCollection(app.db, req.body?.collection ?? {});
      return { applied };
    },
  );
}
