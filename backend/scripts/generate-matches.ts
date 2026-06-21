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
import { OF_TEAMS as TEAMS } from '../src/lib/openfootball.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawDir = resolve(__dirname, 'raw');
const outDir = resolve(__dirname, '../src/data');

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
