/**
 * Server bootstrap: open the database, seed reference data, start Fastify.
 */
import { buildApp } from './app.ts';
import { getDb } from './db/index.ts';
import { seed } from './db/seed.ts';
import { seedTournament } from './db/seed-matches.ts';
import { createBackup } from './services/backups.ts';

const PORT = Number(process.env.API_PORT ?? 3001);

async function main(): Promise<void> {
  const db = getDb();

  // Safety net: snapshot the collection BEFORE touching reference data, so a
  // reseed/migration can never wipe what you've collected. Best-effort — a
  // failed backup must never block startup.
  try {
    const backup = createBackup(db, 'auto');
    if (backup) console.log(`Auto-backup saved: ${backup.name} (${backup.ownedStickers} owned).`);
  } catch (err) {
    console.warn('Auto-backup skipped:', (err as Error).message);
  }

  // Seed/refresh reference data on startup (idempotent).
  const count = seed(db);
  const matchCount = seedTournament(db);
  console.log(`Catalog ready: ${count} stickers, ${matchCount} matches.`);

  const app = await buildApp({ db, logger: true });
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`StickerDex API listening on http://0.0.0.0:${PORT}`);
}

main().catch((err) => {
  console.error('Failed to start StickerDex API:', err);
  process.exit(1);
});
