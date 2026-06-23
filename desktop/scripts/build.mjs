/**
 * Desktop build step:
 *   1. Bundle electron/main.ts + preload.ts with esbuild (CJS, Node platform).
 *      `packages: 'external'` bundles only our first-party TypeScript (the
 *      Electron glue + the backend source it imports) and leaves npm packages
 *      (fastify, better-sqlite3, …) as runtime requires resolved from
 *      node_modules — far more robust than bundling Fastify/pino.
 *   2. Copy the generated JSON datasets   -> resources/data
 *   3. Copy the built React SPA           -> resources/web
 */
import esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '..');
const outDir = join(desktopDir, 'build');
const resourcesDir = join(desktopDir, 'resources');

console.log('• Bundling main + preload (esbuild)…');
await esbuild.build({
  entryPoints: [
    join(desktopDir, 'electron/main.ts'),
    join(desktopDir, 'electron/preload.ts'),
  ],
  outdir: outDir,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  packages: 'external',
  logLevel: 'info',
  // The only `import.meta` uses left in the bundled backend are dev-only/dead
  // here: seed.ts's `npm run seed` CLI guard (never matches in-app) and the
  // dataPath fallback (never reached — STICKERDEX_DATA_DIR is always set). Both
  // are safe with an empty import.meta, so silence the expected warning.
  logOverride: { 'empty-import-meta': 'silent' },
});

function mirror(label, from, to) {
  if (!existsSync(from)) {
    throw new Error(`${label} not found at ${from}`);
  }
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`• Copied ${label} -> ${to}`);
}

mirror('backend datasets', join(repoRoot, 'backend/src/data'), join(resourcesDir, 'data'));
mirror(
  'frontend build (run `npm run build --workspace=frontend` first)',
  join(repoRoot, 'frontend/dist'),
  join(resourcesDir, 'web'),
);

console.log('✓ Desktop bundle ready (build/, resources/data, resources/web).');
