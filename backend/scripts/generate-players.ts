/**
 * Fetches the real WC2026 squads from Wikipedia and writes src/data/players.json.
 *
 * Source: the "2026 FIFA World Cup squads" article, whose squad lists are stored
 * as structured `{{nat fs g player|no=|pos=|name=|caps=|goals=|club=}}` templates.
 * We pull each team's section as raw wikitext via the MediaWiki API (no API key,
 * no scraping of rendered HTML, no AI summarization) and parse the templates —
 * the most reliable freely-available, machine-readable squad source.
 *
 * Output shape:  { "ARG": [ { no, pos, name, club, caps, goals }, ... ], ... }
 *
 * Re-run with: `npm run generate-players`  (then `npm run generate-dataset`).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE = '2026 FIFA World Cup squads';
const API = 'https://en.wikipedia.org/w/api.php';

/** Wikipedia section title -> our FIFA team code. */
const TITLE_TO_CODE: Record<string, string> = {
  Mexico: 'MEX', 'South Africa': 'RSA', 'South Korea': 'KOR', 'Czech Republic': 'CZE',
  Canada: 'CAN', 'Bosnia and Herzegovina': 'BIH', Qatar: 'QAT', Switzerland: 'SUI',
  Brazil: 'BRA', Morocco: 'MAR', Haiti: 'HAI', Scotland: 'SCO',
  'United States': 'USA', Paraguay: 'PAR', Australia: 'AUS', Turkey: 'TUR',
  Germany: 'GER', 'Curaçao': 'CUW', 'Ivory Coast': 'CIV', Ecuador: 'ECU',
  Netherlands: 'NED', Japan: 'JPN', Sweden: 'SWE', Tunisia: 'TUN',
  Belgium: 'BEL', Egypt: 'EGY', Iran: 'IRN', 'New Zealand': 'NZL',
  Spain: 'ESP', 'Cape Verde': 'CPV', 'Saudi Arabia': 'KSA', Uruguay: 'URU',
  France: 'FRA', Senegal: 'SEN', Iraq: 'IRQ', Norway: 'NOR',
  Argentina: 'ARG', Algeria: 'ALG', Austria: 'AUT', Jordan: 'JOR',
  Portugal: 'POR', 'DR Congo': 'COD', Uzbekistan: 'UZB', Colombia: 'COL',
  England: 'ENG', Croatia: 'CRO', Ghana: 'GHA', Panama: 'PAN',
};

const POSITIONS: Record<string, string> = {
  GK: 'Goalkeeper',
  DF: 'Defender',
  MF: 'Midfielder',
  FW: 'Forward',
};

export interface Player {
  no: number | null;
  pos: string;
  name: string;
  club: string;
  caps: number | null;
  goals: number | null;
}

async function api(params: Record<string, string>): Promise<unknown> {
  const url = new URL(API);
  url.search = new URLSearchParams({ format: 'json', ...params }).toString();
  const res = await fetch(url, { headers: { 'User-Agent': 'StickerDex/0.1 (self-hosted album)' } });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status} for ${params.page ?? params.action}`);
  return res.json();
}

/** Resolve "[[Target|Display]]" / "[[Name]]" / plain text to a display string. */
function cleanLink(value: string): string {
  let v = value.trim();
  const link = v.match(/\[\[([^\]]+)\]\]/);
  if (link) {
    const inner = link[1];
    v = inner.includes('|') ? inner.slice(inner.lastIndexOf('|') + 1) : inner;
  }
  return v.replace(/''+/g, '').replace(/<[^>]+>/g, '').trim();
}

/** Split a template body on top-level "|", ignoring those inside [[ ]] / {{ }}. */
function splitParams(body: string): string[] {
  const out: string[] = [];
  let cur = '';
  let curly = 0;
  let square = 0;
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{') { curly++; cur += two; i++; continue; }
    if (two === '}}') { curly--; cur += two; i++; continue; }
    if (two === '[[') { square++; cur += two; i++; continue; }
    if (two === ']]') { square--; cur += two; i++; continue; }
    const ch = body[i];
    if (ch === '|' && curly === 0 && square === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** Extract all {{nat fs g player ...}} entries from a section's wikitext. */
function parsePlayers(wikitext: string): Player[] {
  const players: Player[] = [];
  const marker = '{{nat fs g player';
  let idx = wikitext.indexOf(marker);
  while (idx !== -1) {
    // Walk to the matching }} for this template.
    let depth = 0;
    let end = idx;
    for (let i = idx; i < wikitext.length - 1; i++) {
      const two = wikitext.slice(i, i + 2);
      if (two === '{{') depth++;
      else if (two === '}}') {
        depth--;
        if (depth === 0) {
          end = i + 2;
          break;
        }
      }
    }
    const body = wikitext.slice(idx + 2, end - 2); // strip outer {{ }}
    const params = splitParams(body);
    const fields: Record<string, string> = {};
    for (const p of params) {
      const eq = p.indexOf('=');
      if (eq === -1) continue;
      fields[p.slice(0, eq).trim()] = p.slice(eq + 1);
    }
    if (fields.name) {
      const num = parseInt(fields.no ?? '', 10);
      const caps = parseInt(fields.caps ?? '', 10);
      const goals = parseInt(fields.goals ?? '', 10);
      players.push({
        no: Number.isNaN(num) ? null : num,
        pos: POSITIONS[(fields.pos ?? '').trim()] ?? (fields.pos ?? '').trim(),
        name: cleanLink(fields.name),
        club: cleanLink(fields.club ?? ''),
        caps: Number.isNaN(caps) ? null : caps,
        goals: Number.isNaN(goals) ? null : goals,
      });
    }
    idx = wikitext.indexOf(marker, end);
  }
  players.sort((a, b) => (a.no ?? 99) - (b.no ?? 99));
  return players;
}

/** Split full wikitext into { level-2 heading title -> block text }. */
function sectionBlocks(wikitext: string): Map<string, string> {
  const blocks = new Map<string, string>();
  // Match any heading level (== .. == through ==== .. ====); team headings on
  // this page are level 3 (===Mexico===) under level-2 group headers.
  const headingRe = /^={2,}\s*(.+?)\s*={2,}\s*$/gm;
  const heads: { title: string; end: number; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(wikitext)) !== null) {
    heads.push({ title: m[1].trim(), start: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i < heads.length; i++) {
    const next = i + 1 < heads.length ? heads[i + 1].start : wikitext.length;
    blocks.set(heads[i].title, wikitext.slice(heads[i].end, next));
  }
  return blocks;
}

async function main(): Promise<void> {
  console.log(`Fetching full wikitext for "${PAGE}" (single request)…`);
  const resp = (await api({ action: 'parse', page: PAGE, prop: 'wikitext' })) as {
    parse: { wikitext: { '*': string } };
  };
  const blocks = sectionBlocks(resp.parse.wikitext['*']);

  const squads: Record<string, Player[]> = {};
  for (const [title, code] of Object.entries(TITLE_TO_CODE)) {
    const block = blocks.get(title);
    if (!block) continue;
    const players = parsePlayers(block);
    if (players.length) {
      squads[code] = players;
      console.log(`  ${code.padEnd(3)} ${title.padEnd(24)} ${players.length} players`);
    }
  }

  const missing = Object.entries(TITLE_TO_CODE).filter(([, c]) => !squads[c]);
  if (missing.length)
    console.warn(`WARNING: no squad parsed for: ${missing.map(([, c]) => c).join(', ')}`);

  const total = Object.values(squads).reduce((n, p) => n + p.length, 0);
  const outDir = resolve(__dirname, '../src/data');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'players.json'), JSON.stringify(squads, null, 2) + '\n');
  console.log(`\nWrote ${Object.keys(squads).length} squads, ${total} players to players.json`);
}

main().catch((err) => {
  console.error('Failed to generate players:', err);
  process.exit(1);
});
