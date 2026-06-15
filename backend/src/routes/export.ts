import type { FastifyInstance } from 'fastify';
import { getAllStickers } from '../services/catalog.ts';
import { getCollectionMap } from '../services/collection.ts';
import { buildRows, toCsv, type ExportFilter } from '../services/exporter.ts';

const FILTERS: ExportFilter[] = ['all', 'missing', 'owned', 'dupes'];

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { format?: string; filter?: string } }>(
    '/api/export',
    async (req, reply) => {
      const format = req.query.format === 'csv' ? 'csv' : 'json';
      const filter = (FILTERS.includes(req.query.filter as ExportFilter)
        ? req.query.filter
        : 'all') as ExportFilter;

      const catalog = getAllStickers(app.db);
      const collection = getCollectionMap(app.db);
      const rows = buildRows(catalog, collection, filter);

      if (format === 'csv') {
        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="StickerDex-${filter}.csv"`)
          .send(toCsv(rows));
      }
      return reply
        .header('Content-Disposition', `attachment; filename="StickerDex-${filter}.json"`)
        .send({ filter, count: rows.length, rows });
    },
  );
}
