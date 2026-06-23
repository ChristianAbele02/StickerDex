/**
 * Generates resources/icon.ico for the Windows desktop app. Source of truth is
 * desktop/icon.svg — a richer, app-icon-grade mark (peeled foil sticker + brand
 * star) tuned for the larger sizes a desktop icon renders at. Falls back to the
 * 16px web favicon if the dedicated icon is ever missing. Rasterizes at several
 * sizes with resvg and packs them into a multi-resolution Windows .ico.
 */
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '..');
const resourcesDir = join(desktopDir, 'resources');
mkdirSync(resourcesDir, { recursive: true });

const appIcon = join(desktopDir, 'icon.svg');
const source = existsSync(appIcon) ? appIcon : join(repoRoot, 'frontend/public/favicon.svg');
const svg = readFileSync(source);
const sizes = [256, 128, 64, 48, 32, 16];

const pngs = sizes.map((size) => {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  return Buffer.from(r.render().asPng());
});

const ico = await pngToIco(pngs);
writeFileSync(join(resourcesDir, 'icon.ico'), ico);
console.log(`✓ Wrote resources/icon.ico from ${source} (${sizes.join(', ')} px).`);
