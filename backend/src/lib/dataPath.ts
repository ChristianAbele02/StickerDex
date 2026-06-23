/**
 * Resolves the directory holding the generated JSON datasets
 * (`stickers.json`, `matches.json`, `teams.json`, …).
 *
 * Overridable via `STICKERDEX_DATA_DIR` so the bundled desktop build can point
 * at its copied `resources/data` folder (the source-relative path no longer
 * exists once the backend is bundled by esbuild). When the env var is unset the
 * resolver falls back to the in-repo `src/data` directory, so `npm run dev` and
 * the Docker image behave exactly as before.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedFallback: string | null = null;

/** The in-repo dataset directory, computed lazily (never used by the desktop
 * build, which always sets STICKERDEX_DATA_DIR). `import.meta.url` is a real URL
 * under ESM/tsx (dev & Docker) but empty in the CJS desktop bundle — guard so
 * this can never throw even if it were somehow reached there. */
function fallbackDir(): string {
  if (cachedFallback === null) {
    const metaUrl = import.meta.url as string | undefined;
    const base = metaUrl ? dirname(fileURLToPath(metaUrl)) : process.cwd();
    cachedFallback = resolve(base, '../data');
  }
  return cachedFallback;
}

/** Absolute path to the dataset directory. */
export function dataDir(): string {
  return process.env.STICKERDEX_DATA_DIR ?? fallbackDir();
}

/** Absolute path to a single dataset file inside {@link dataDir}. */
export function dataFile(name: string): string {
  return join(dataDir(), name);
}
