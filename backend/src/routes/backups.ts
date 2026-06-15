import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import type { FastifyInstance } from 'fastify';
import {
  backupFilePath,
  createBackup,
  deleteBackup,
  listBackups,
  restoreBackup,
} from '../services/backups.ts';

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  // List all snapshots (newest first), with how much each one holds.
  app.get('/api/backups', async () => ({ backups: listBackups() }));

  // Make a manual backup right now.
  app.post('/api/backups', async () => {
    const backup = createBackup(app.db, 'manual');
    return { backup };
  });

  // Restore a snapshot into the live collection (and match results).
  app.post<{ Params: { name: string } }>('/api/backups/:name/restore', async (req, reply) => {
    try {
      const restored = restoreBackup(app.db, req.params.name);
      return { restored };
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // Download a snapshot file (so you can keep an off-machine copy).
  app.get<{ Params: { name: string } }>('/api/backups/:name/download', async (req, reply) => {
    try {
      const path = backupFilePath(req.params.name);
      return reply
        .header('Content-Type', 'application/octet-stream')
        .header('Content-Disposition', `attachment; filename="${basename(path)}"`)
        .send(createReadStream(path));
    } catch (err) {
      return reply.code(404).send({ error: (err as Error).message });
    }
  });

  // Delete a snapshot — only ever via this explicit user action.
  app.delete<{ Params: { name: string } }>('/api/backups/:name', async (req, reply) => {
    try {
      deleteBackup(req.params.name);
      return { deleted: true };
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });
}
