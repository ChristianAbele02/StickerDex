/**
 * Generates the canonical WC2026 match dataset from the vendored openfootball
 * schedule files (CC0 / public domain — see scripts/raw/).
 *
 *   scripts/raw/cup.txt           group stage (matches 1–72)
 *   scripts/raw/cup_finals.txt    knockout stage (matches 73–104)
 *   scripts/raw/cup_stadiums.csv  16 host venues
 *
 * Outputs (committed reference data):
 *   src/data/matches.json     104 fixtures (with any already-played scores)
 *   src/data/venues.json      16 host venues
 *   src/data/match-teams.json 48 tournament teams (code, colors, group)
 *
 * The real draw, venues, kickoff times and results all come straight from the
 * source files; nothing is invented. Knockout slots that depend on results
 * (e.g. "1A", "W74") are kept as labels and resolved at runtime. Everything is
 * editable in-app, so corrections never require a regenerate.
 *
 * Re-run with: `npm run generate-matches`
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Match, MatchStage, MatchTeam, MatchVenue } from '../src/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawDir = resolve(__dirname, 'raw');
const outDir = resolve(__dirname, '../src/data');

/** openfootball team name -> FIFA code + flag colors for the 48 qualified teams. */
const TEAMS: Record<string, { code: string; primary: string; secondary: string }> = {
  Mexico: { code: 'MEX', primary: '#006847', secondary: '#ce1126' },
  'South Africa': { code: 'RSA', primary: '#007749', secondary: '#ffb81c' },
  'South Korea': { code: 'KOR', primary: '#cd2e3a', secondary: '#0047a0' },
  'Czech Republic': { code: 'CZE', primary: '#11457e', secondary: '#d7141a' },
  Canada: { code: 'CAN', primary: '#d52b1e', secondary: '#ffffff' },
  'Bosnia & Herzegovina': { code: 'BIH', primary: '#002395', secondary: '#ffec00' },
  Qatar: { code: 'QAT', primary: '#8a1538', secondary: '#ffffff' },
  Switzerland: { code: 'SUI', primary: '#d52b1e', secondary: '#ffffff' },
  Brazil: { code: 'BRA', primary: '#ffdf00', secondary: '#009b3a' },
  Morocco: { code: 'MAR', primary: '#c1272d', secondary: '#006233' },
  Haiti: { code: 'HAI', primary: '#00209f', secondary: '#d21034' },
  Scotland: { code: 'SCO', primary: '#0065bf', secondary: '#ffffff' },
  USA: { code: 'USA', primary: '#0a3161', secondary: '#b31942' },
  Paraguay: { code: 'PAR', primary: '#d52b1e', secondary: '#0038a8' },
  Australia: { code: 'AUS', primary: '#00843d', secondary: '#ffcd00' },
  Turkey: { code: 'TUR', primary: '#e30a17', secondary: '#ffffff' },
  Germany: { code: 'GER', primary: '#000000', secondary: '#dd0000' },
  'Curaçao': { code: 'CUW', primary: '#002b7f', secondary: '#f9d616' },
  'Ivory Coast': { code: 'CIV', primary: '#f77f00', secondary: '#009e60' },
  Ecuador: { code: 'ECU', primary: '#ffd100', secondary: '#0072ce' },
  Netherlands: { code: 'NED', primary: '#ae1c28', secondary: '#21468b' },
  Japan: { code: 'JPN', primary: '#000091', secondary: '#bc002d' },
  Sweden: { code: 'SWE', primary: '#006aa7', secondary: '#fecc00' },
  Tunisia: { code: 'TUN', primary: '#e70013', secondary: '#ffffff' },
  Belgium: { code: 'BEL', primary: '#000000', secondary: '#fdda24' },
  Egypt: { code: 'EGY', primary: '#ce1126', secondary: '#000000' },
  Iran: { code: 'IRN', primary: '#239f40', secondary: '#da0000' },
  'New Zealand': { code: 'NZL', primary: '#000000', secondary: '#ffffff' },
  Spain: { code: 'ESP', primary: '#aa151b', secondary: '#f1bf00' },
  'Cape Verde': { code: 'CPV', primary: '#003893', secondary: '#cf2027' },
  'Saudi Arabia': { code: 'KSA', primary: '#006c35', secondary: '#ffffff' },
  Uruguay: { code: 'URU', primary: '#5cbfeb', secondary: '#001489' },
  France: { code: 'FRA', primary: '#0055a4', secondary: '#ef4135' },
  Senegal: { code: 'SEN', primary: '#00853f', secondary: '#fdef42' },
  Iraq: { code: 'IRQ', primary: '#007a3d', secondary: '#ce1126' },
  Norway: { code: 'NOR', primary: '#ba0c2f', secondary: '#00205b' },
  Argentina: { code: 'ARG', primary: '#75aadb', secondary: '#ffffff' },
  Algeria: { code: 'ALG', primary: '#006233', secondary: '#ffffff' },
  Austria: { code: 'AUT', primary: '#ed2939', secondary: '#ffffff' },
  Jordan: { code: 'JOR', primary: '#007a3d', secondary: '#ce1126' },
  Portugal: { code: 'POR', primary: '#006600', secondary: '#ff0000' },
  'DR Congo': { code: 'COD', primary: '#007fff', secondary: '#f7d618' },
  Uzbekistan: { code: 'UZB', primary: '#1eb53a', secondary: '#0099b5' },
  Colombia: { code: 'COL', primary: '#fcd116', secondary: '#003893' },
  England: { code: 'ENG', primary: '#ffffff', secondary: '#ce1124' },
  Croatia: { code: 'CRO', primary: '#ff0000', secondary: '#171796' },
  Ghana: { code: 'GHA', primary: '#006b3f', secondary: '#fcd116' },
  Panama: { code: 'PAN', primary: '#005293', secondary: '#d21034' },
};

const MONTHS: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const DATE_RE = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Za-z]+)\s+(\d{1,2})\b/;

/** Convert a local date + "HH:MM" + "UTC-6" offset into an ISO-8601 UTC string. */
function toUtcIso(year: number, month: number, day: number, time: string, tz: string): string {
  const [h, m] = time.split(':').map(Number);
  const offset = Number(tz.replace('UTC', '')); // "UTC-6" -> -6
  // UTC = local - offset  (e.g. 13:00 at UTC-6 -> 19:00 UTC)
  return new Date(Date.UTC(year, month, day, h - offset, m)).toISOString();
}

function venueCity(raw: string): string {
  return raw.trim();
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------
function parseVenues(): MatchVenue[] {
  const text = readFileSync(resolve(rawDir, 'cup_stadiums.csv'), 'utf8');
  const venues: MatchVenue[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('city,')) continue;
    // city may itself contain commas inside parentheses — split on top-level commas.
    const parts = splitCsv(t);
    if (parts.length < 5) continue;
    const [city, timezone, cc, name, capacity] = parts;
    venues.push({
      city: city.trim(),
      stadium: name.trim(),
      country: cc.trim(),
      timezone: timezone.trim(),
      capacity: Number(capacity) || null,
    });
  }
  return venues;
}

/** CSV split that respects parentheses (host cities like "Dallas (Arlington)"). */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of line) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------
const YEAR = 2026;

interface ParsedMatch {
  stage: MatchStage;
  group: string | null;
  num: number | null;
  iso: string;
  localTime: string;
  timezone: string;
  venueCity: string;
  homeLabel: string;
  awayLabel: string;
  homeScore: number | null;
  awayScore: number | null;
}

function resolveTeam(label: string): { code: string | null; name: string } {
  const t = TEAMS[label];
  return t ? { code: t.code, name: label } : { code: null, name: label };
}

/** Parse one fixture line. Returns null for non-match lines (scorers, blanks). */
function parseMatchLine(
  line: string,
): { localTime: string; tz: string; home: string; away: string; hs: number | null; as: number | null; venue: string; num: number | null } | null {
  // Optional leading "(73)" match number, then "HH:MM UTC-6 ... @ Venue"
  const numMatch = line.match(/^\s*\((\d+)\)\s*/);
  const num = numMatch ? Number(numMatch[1]) : null;
  const rest0 = numMatch ? line.slice(numMatch[0].length) : line;

  const head = rest0.match(/^\s*(\d{1,2}:\d{2})\s+(UTC[+-]\d+)\s+(.+)$/);
  if (!head) return null;
  const [, localTime, tz, body] = head;

  const at = body.lastIndexOf('@');
  if (at === -1) return null;
  const venue = venueCity(body.slice(at + 1));
  const left = body.slice(0, at).trim();

  // left = "Mexico  2-0 (1-0)  South Africa"  OR  "Czech Republic    v South Africa"
  const score = left.match(/^(.+?)\s+(\d+)-(\d+)(?:\s+\([\d-]+\))?\s+(.+)$/);
  if (score) {
    return {
      localTime, tz, venue, num,
      home: score[1].trim(),
      hs: Number(score[2]),
      as: Number(score[3]),
      away: score[4].trim(),
    };
  }
  const unplayed = left.match(/^(.+?)\s+v\s+(.+)$/);
  if (unplayed) {
    return { localTime, tz, venue, num, home: unplayed[1].trim(), away: unplayed[2].trim(), hs: null, as: null };
  }
  return null;
}

function parseGroupStage(): ParsedMatch[] {
  const text = readFileSync(resolve(rawDir, 'cup.txt'), 'utf8');
  const out: ParsedMatch[] = [];
  let group: string | null = null;
  let inFixtures = false;
  let curDate: { month: number; day: number } | null = null;

  for (const line of text.split(/\r?\n/)) {
    const grp = line.match(/^▪\s*Group\s+([A-L])\b/);
    if (grp) {
      group = grp[1];
      inFixtures = true;
      curDate = null;
      continue;
    }
    if (!inFixtures) continue;

    const dm = line.match(DATE_RE);
    if (dm && MONTHS[dm[1]] !== undefined) {
      curDate = { month: MONTHS[dm[1]], day: Number(dm[2]) };
      continue;
    }

    const pm = parseMatchLine(line);
    if (pm && curDate && group) {
      out.push({
        stage: 'group',
        group,
        num: null, // assigned after sorting
        iso: toUtcIso(YEAR, curDate.month, curDate.day, pm.localTime, pm.tz),
        localTime: pm.localTime,
        timezone: pm.tz,
        venueCity: pm.venue,
        homeLabel: pm.home,
        awayLabel: pm.away,
        homeScore: pm.hs,
        awayScore: pm.as,
      });
    }
  }
  return out;
}

const FINALS_STAGE: Record<string, MatchStage> = {
  'Round of 32': 'round32',
  'Round of 16': 'round16',
  'Quarter-final': 'quarter',
  'Semi-final': 'semi',
  'Match for third place': 'third',
  Final: 'final',
};

function parseKnockout(): ParsedMatch[] {
  const text = readFileSync(resolve(rawDir, 'cup_finals.txt'), 'utf8');
  const out: ParsedMatch[] = [];
  let stage: MatchStage | null = null;
  let curDate: { month: number; day: number } | null = null;

  for (const line of text.split(/\r?\n/)) {
    const sec = line.match(/^▪\s*(.+?)\s*$/);
    if (sec && FINALS_STAGE[sec[1].trim()]) {
      stage = FINALS_STAGE[sec[1].trim()];
      curDate = null;
      continue;
    }
    if (!stage) continue;

    const dm = line.match(DATE_RE);
    if (dm && MONTHS[dm[1]] !== undefined) {
      curDate = { month: MONTHS[dm[1]], day: Number(dm[2]) };
      continue;
    }

    const pm = parseMatchLine(line);
    if (pm && curDate) {
      out.push({
        stage,
        group: null,
        num: pm.num,
        iso: toUtcIso(YEAR, curDate.month, curDate.day, pm.localTime, pm.tz),
        localTime: pm.localTime,
        timezone: pm.tz,
        venueCity: pm.venue,
        homeLabel: pm.home,
        awayLabel: pm.away,
        homeScore: pm.hs,
        awayScore: pm.as,
      });
    }
  }
  return out;
}

function toMatch(p: ParsedMatch, num: number): Match {
  const home = resolveTeam(p.homeLabel);
  const away = resolveTeam(p.awayLabel);
  return {
    num,
    stage: p.stage,
    group: p.group,
    kickoff: p.iso,
    localTime: p.localTime,
    timezone: p.timezone,
    venueCity: p.venueCity,
    homeCode: home.code,
    homeLabel: p.homeLabel,
    awayCode: away.code,
    awayLabel: p.awayLabel,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
  };
}

function buildTeams(groupMatches: ParsedMatch[]): MatchTeam[] {
  const byCode = new Map<string, MatchTeam>();
  for (const m of groupMatches) {
    for (const label of [m.homeLabel, m.awayLabel]) {
      const def = TEAMS[label];
      if (!def || byCode.has(def.code)) continue;
      byCode.set(def.code, {
        code: def.code,
        name: label,
        group: m.group,
        colors: { primary: def.primary, secondary: def.secondary },
      });
    }
  }
  return [...byCode.values()].sort((a, b) =>
    (a.group ?? '').localeCompare(b.group ?? '') || a.name.localeCompare(b.name),
  );
}

function main(): void {
  const venues = parseVenues();
  const groupParsed = parseGroupStage();
  const knockoutParsed = parseKnockout();

  // Group matches: number 1–72 in kickoff order.
  groupParsed.sort((a, b) => a.iso.localeCompare(b.iso));
  const matches: Match[] = [];
  groupParsed.forEach((p, i) => matches.push(toMatch(p, i + 1)));
  // Knockout matches carry their own numbers (73–104).
  knockoutParsed.forEach((p) => matches.push(toMatch(p, p.num as number)));
  matches.sort((a, b) => a.num - b.num);

  const teams = buildTeams(groupParsed);

  // Sanity checks — fail loudly if the source format drifts.
  if (matches.length !== 104) throw new Error(`Expected 104 matches, got ${matches.length}`);
  if (teams.length !== 48) throw new Error(`Expected 48 teams, got ${teams.length}`);
  if (venues.length !== 16) throw new Error(`Expected 16 venues, got ${venues.length}`);
  const nums = new Set(matches.map((m) => m.num));
  if (nums.size !== 104) throw new Error('Duplicate / missing match numbers');
  for (const m of matches) {
    if (!venues.some((v) => v.city === m.venueCity)) {
      throw new Error(`Match ${m.num} references unknown venue "${m.venueCity}"`);
    }
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'matches.json'), JSON.stringify(matches, null, 2) + '\n');
  writeFileSync(resolve(outDir, 'venues.json'), JSON.stringify(venues, null, 2) + '\n');
  writeFileSync(resolve(outDir, 'match-teams.json'), JSON.stringify(teams, null, 2) + '\n');

  const played = matches.filter((m) => m.homeScore !== null).length;
  console.log(`Wrote ${matches.length} matches (${played} already played) to ${outDir}`);
  console.log(`  ${teams.length} teams, ${venues.length} venues`);
}

main();
