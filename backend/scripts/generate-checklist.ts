/**
 * Fetches the real Panini WC2026 album checklist and writes src/data/checklist.json
 * — the authoritative mapping of each sticker code to exactly what it depicts
 * (e.g. ARG1 → "Emblem", ARG2 → "Emiliano Martinez", ARG17 → "Lionel Messi").
 *
 * This is what fixes player↔number alignment: Panini's slot order is NOT shirt
 * order, so the real checklist is the only reliable source for which player is
 * which numbered sticker. Per team: slot 1 is the emblem, slot 13 the team
 * photo, and the other 18 slots are players.
 *
 * Two independent checklist references are merged for reliability — they agree
 * on slots 1 and 3–20; the primary (cartophilic) additionally has the correct
 * slot-2 player (the other source mislabels it as a second emblem), and the
 * secondary fills a few entries the primary is missing:
 *   primary   — Football Cartophilic Info Exchange (meticulous card reference)
 *   secondary — paniniwm2026sticker.com (fills the primary's gaps)
 * Cross-checked against known facts (Messi ARG17, Ronaldo POR15). Names are
 * factual data; nothing is invented.
 *
 * Re-run with: `npm run generate-checklist`  (then `npm run generate-dataset`).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const PRIMARY_URL =
  'https://cartophilic-info-exch.blogspot.com/2026/03/panini-fifa-world-cup-2026-mexusacan-09_030880692.html';
const SECONDARY_URL = 'https://paniniwm2026sticker.com/world-cup-2026-sticker-checklist';

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${url}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"');
}

/** cartophilic: plain-text lines `ARG-2.  Emiliano Martinez (Argentina)`. */
function parsePrimary(html: string): Record<string, string> {
  const text = decodeEntities(html.replace(/<[^>]+>/g, '\n'));
  const re = /\b([A-Z]{2,4})-(\d{1,2})\.\s*([^\n(]+?)\s*\(/g;
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const code = `${m[1]}${Number(m[2])}`;
    const title = m[3].trim();
    // First occurrence is the main per-team checklist; a later "Team Photo"
    // gallery repeats each code, so keep the first and ignore repeats.
    if (title && !(code in out)) out[code] = title;
  }
  return out;
}

/** paniniwm: HTML list items `<li><strong>ARG2</strong> …Name - Team<span>`. */
function parseSecondary(html: string): Record<string, string> {
  const re = /<li><strong>([A-Z]{2,4}\d{1,2})<\/strong>\s*(?:<!--\s*-->)?\s*(.*?)\s+-\s+[^<]*?<span>/g;
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const title = decodeEntities(m[2].replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, '')).trim();
    if (title) out[m[1]] = title;
  }
  return out;
}

async function main(): Promise<void> {
  console.log('Fetching Panini WC2026 checklist (two sources)…');
  const [primaryHtml, secondaryHtml] = await Promise.all([
    fetchText(PRIMARY_URL),
    fetchText(SECONDARY_URL),
  ]);
  const primary = parsePrimary(primaryHtml);
  const secondary = parseSecondary(secondaryHtml);

  // Secondary fills gaps; primary wins on every shared code (correct slot 2).
  const checklist: Record<string, string> = { ...secondary, ...primary };

  // Sanity: known facts + slot-2 must be a player, not the emblem.
  const fail = (msg: string) => {
    throw new Error(`Checklist sanity check failed: ${msg}`);
  };
  if (checklist.ARG17 !== 'Lionel Messi') fail(`ARG17 = "${checklist.ARG17}"`);
  if (!checklist.ARG2 || /emblem|logo|badge/i.test(checklist.ARG2)) {
    fail(`ARG2 = "${checklist.ARG2}" (expected a player)`);
  }

  const byTeam = new Map<string, number>();
  for (const code of Object.keys(checklist)) {
    const prefix = code.match(/^[A-Z]+/)?.[0] ?? '';
    byTeam.set(prefix, (byTeam.get(prefix) ?? 0) + 1);
  }
  const teams20 = [...byTeam.values()].filter((n) => n === 20).length;

  const outDir = resolve(__dirname, '../src/data');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'checklist.json'), JSON.stringify(checklist, null, 2) + '\n');
  console.log(
    `Wrote ${Object.keys(checklist).length} sticker titles (${teams20} teams ×20) to checklist.json`,
  );
}

main().catch((err) => {
  console.error('Failed to generate checklist:', err);
  process.exit(1);
});
