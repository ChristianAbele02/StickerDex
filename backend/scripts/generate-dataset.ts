/**
 * Generates the canonical Stickerdex catalog (`src/data/stickers.json`).
 *
 * The album structure is well-documented and reproduced faithfully here:
 *   - 48 national teams x 20 stickers (badge foil at 1, team photo at 13, rest players)
 *   - FWC1..FWC8  : intro / emblems / mascots
 *   - FWC9..FWC19 : FIFA Museum past champions
 *   - CC1..CC12   : Coca-Cola special edition
 *
 * HONESTY NOTE: the *structure and codes* are accurate. Individual squad
 * member names and the official group draw cannot be verified by this script,
 * so unknown values ship as clearly-flagged placeholders (`verified: false`).
 * Confirmed values (badges, team photos, a few researched stars, host nations)
 * are marked `verified: true`. See CONTRIBUTING.md for completing the data.
 *
 * Re-run with: `npm run generate-dataset`
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Sticker, Team } from '../src/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SquadPlayer {
  no: number | null;
  pos: string;
  name: string;
  club: string;
  caps: number | null;
  goals: number | null;
}

function loadJson<T>(file: string, what: string, hint: string): T | null {
  const path = resolve(__dirname, '../src/data', file);
  if (!existsSync(path)) {
    console.warn(`${file} not found — ${what}. Run \`${hint}\`.`);
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/**
 * The authoritative Panini checklist (code → depicted player/title), fetched by
 * `npm run generate-checklist`. This is what aligns names to the correct sticker
 * numbers — Panini's slot order is not shirt order.
 */
const CHECKLIST = loadJson<Record<string, string>>(
  'checklist.json',
  'sticker names/numbers will fall back to placeholders',
  'npm run generate-checklist',
) ?? {};

/**
 * Live squad data (Wikipedia) — used only to enrich each checklisted player with
 * a position and club, matched by name. Optional.
 */
const SQUADS =
  loadJson<Record<string, SquadPlayer[]>>(
    'players.json',
    'positions/clubs will be omitted',
    'npm run generate-players',
  ) ?? {};

/** Normalize a name for matching across sources (accents, case, punctuation). */
function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build name lookups for a squad so checklisted names can pull pos/club. */
function squadMatcher(squad: SquadPlayer[]) {
  const byFull = new Map<string, SquadPlayer>();
  const bySurname = new Map<string, SquadPlayer[]>();
  for (const p of squad) {
    const norm = normalizeName(p.name);
    byFull.set(norm, p);
    const surname = norm.split(' ').slice(-1)[0];
    (bySurname.get(surname) ?? bySurname.set(surname, []).get(surname)!).push(p);
  }
  return (name: string): SquadPlayer | null => {
    const norm = normalizeName(name);
    if (byFull.has(norm)) return byFull.get(norm)!;
    const surname = norm.split(' ').slice(-1)[0];
    const matches = bySurname.get(surname);
    return matches && matches.length === 1 ? matches[0] : null; // only if unambiguous
  };
}

const STICKERS_PER_TEAM = 20;
const BADGE_SLOT = 1;
const TEAM_PHOTO_SLOT = 13;

interface TeamDef {
  code: string;
  name: string;
  /** Real group letter A–L from the official draw. */
  group: string;
  primary: string;
  secondary: string;
  /** True only for the host nations (confirmed participants). */
  confirmed?: boolean;
}

/**
 * The 48 qualified nations, in their **real** group-draw order (A–L), with FIFA
 * codes and colors kept identical to the tournament/companion dataset
 * (`match-teams.json`) so the album and the schedule/standings/bracket line up
 * and favorite-team highlighting works across both. Hosts USA/Canada/Mexico are
 * confirmed; the draw is sourced from the same openfootball schedule (CC0).
 */
const TEAMS: TeamDef[] = [
  // Group A
  { code: 'MEX', name: 'Mexico', group: 'A', primary: '#006847', secondary: '#ce1126', confirmed: true },
  { code: 'RSA', name: 'South Africa', group: 'A', primary: '#007749', secondary: '#ffb81c' },
  { code: 'KOR', name: 'South Korea', group: 'A', primary: '#cd2e3a', secondary: '#0047a0' },
  { code: 'CZE', name: 'Czechia', group: 'A', primary: '#11457e', secondary: '#d7141a' },
  // Group B
  { code: 'CAN', name: 'Canada', group: 'B', primary: '#d52b1e', secondary: '#ffffff', confirmed: true },
  { code: 'BIH', name: 'Bosnia & Herzegovina', group: 'B', primary: '#002395', secondary: '#ffec00' },
  { code: 'QAT', name: 'Qatar', group: 'B', primary: '#8a1538', secondary: '#ffffff' },
  { code: 'SUI', name: 'Switzerland', group: 'B', primary: '#d52b1e', secondary: '#ffffff' },
  // Group C
  { code: 'BRA', name: 'Brazil', group: 'C', primary: '#ffdf00', secondary: '#009b3a' },
  { code: 'MAR', name: 'Morocco', group: 'C', primary: '#c1272d', secondary: '#006233' },
  { code: 'HAI', name: 'Haiti', group: 'C', primary: '#00209f', secondary: '#d21034' },
  { code: 'SCO', name: 'Scotland', group: 'C', primary: '#0065bf', secondary: '#ffffff' },
  // Group D
  { code: 'USA', name: 'United States', group: 'D', primary: '#0a3161', secondary: '#b31942', confirmed: true },
  { code: 'PAR', name: 'Paraguay', group: 'D', primary: '#d52b1e', secondary: '#0038a8' },
  { code: 'AUS', name: 'Australia', group: 'D', primary: '#00843d', secondary: '#ffcd00' },
  { code: 'TUR', name: 'Türkiye', group: 'D', primary: '#e30a17', secondary: '#ffffff' },
  // Group E
  { code: 'GER', name: 'Germany', group: 'E', primary: '#000000', secondary: '#dd0000' },
  { code: 'CUW', name: 'Curaçao', group: 'E', primary: '#002b7f', secondary: '#f9d616' },
  { code: 'CIV', name: "Côte d'Ivoire", group: 'E', primary: '#f77f00', secondary: '#009e60' },
  { code: 'ECU', name: 'Ecuador', group: 'E', primary: '#ffd100', secondary: '#0072ce' },
  // Group F
  { code: 'NED', name: 'Netherlands', group: 'F', primary: '#ae1c28', secondary: '#21468b' },
  { code: 'JPN', name: 'Japan', group: 'F', primary: '#000091', secondary: '#bc002d' },
  { code: 'SWE', name: 'Sweden', group: 'F', primary: '#006aa7', secondary: '#fecc00' },
  { code: 'TUN', name: 'Tunisia', group: 'F', primary: '#e70013', secondary: '#ffffff' },
  // Group G
  { code: 'BEL', name: 'Belgium', group: 'G', primary: '#000000', secondary: '#fdda24' },
  { code: 'EGY', name: 'Egypt', group: 'G', primary: '#ce1126', secondary: '#000000' },
  { code: 'IRN', name: 'Iran', group: 'G', primary: '#239f40', secondary: '#da0000' },
  { code: 'NZL', name: 'New Zealand', group: 'G', primary: '#000000', secondary: '#ffffff' },
  // Group H
  { code: 'ESP', name: 'Spain', group: 'H', primary: '#aa151b', secondary: '#f1bf00' },
  { code: 'CPV', name: 'Cape Verde', group: 'H', primary: '#003893', secondary: '#cf2027' },
  { code: 'KSA', name: 'Saudi Arabia', group: 'H', primary: '#006c35', secondary: '#ffffff' },
  { code: 'URU', name: 'Uruguay', group: 'H', primary: '#5cbfeb', secondary: '#001489' },
  // Group I
  { code: 'FRA', name: 'France', group: 'I', primary: '#0055a4', secondary: '#ef4135' },
  { code: 'SEN', name: 'Senegal', group: 'I', primary: '#00853f', secondary: '#fdef42' },
  { code: 'IRQ', name: 'Iraq', group: 'I', primary: '#007a3d', secondary: '#ce1126' },
  { code: 'NOR', name: 'Norway', group: 'I', primary: '#ba0c2f', secondary: '#00205b' },
  // Group J
  { code: 'ARG', name: 'Argentina', group: 'J', primary: '#75aadb', secondary: '#ffffff' },
  { code: 'ALG', name: 'Algeria', group: 'J', primary: '#006233', secondary: '#ffffff' },
  { code: 'AUT', name: 'Austria', group: 'J', primary: '#ed2939', secondary: '#ffffff' },
  { code: 'JOR', name: 'Jordan', group: 'J', primary: '#007a3d', secondary: '#ce1126' },
  // Group K
  { code: 'POR', name: 'Portugal', group: 'K', primary: '#006600', secondary: '#ff0000' },
  { code: 'COD', name: 'DR Congo', group: 'K', primary: '#007fff', secondary: '#f7d618' },
  { code: 'UZB', name: 'Uzbekistan', group: 'K', primary: '#1eb53a', secondary: '#0099b5' },
  { code: 'COL', name: 'Colombia', group: 'K', primary: '#fcd116', secondary: '#003893' },
  // Group L
  { code: 'ENG', name: 'England', group: 'L', primary: '#ffffff', secondary: '#ce1124' },
  { code: 'CRO', name: 'Croatia', group: 'L', primary: '#ff0000', secondary: '#171796' },
  { code: 'GHA', name: 'Ghana', group: 'L', primary: '#006b3f', secondary: '#fcd116' },
  { code: 'PAN', name: 'Panama', group: 'L', primary: '#005293', secondary: '#d21034' },
];

/**
 * Ordered flag color bands per team (FIFA code -> hex stops), used to paint each
 * team's album page as a gradient of its national flag. 2–4 dominant bands,
 * roughly in flag order. Kept simple/legible rather than heraldically exact.
 */
const FLAGS: Record<string, string[]> = {
  MEX: ['#006847', '#ffffff', '#ce1126'],
  RSA: ['#007749', '#ffb81c', '#de3831', '#002395', '#000000'],
  KOR: ['#ffffff', '#cd2e3a', '#0047a0'],
  CZE: ['#11457e', '#ffffff', '#d7141a'],
  CAN: ['#d52b1e', '#ffffff', '#d52b1e'],
  BIH: ['#002395', '#ffec00', '#ffffff'],
  QAT: ['#8a1538', '#ffffff'],
  SUI: ['#d52b1e', '#ffffff'],
  BRA: ['#009b3a', '#ffdf00', '#002776'],
  MAR: ['#c1272d', '#006233'],
  HAI: ['#00209f', '#d21034'],
  SCO: ['#0065bf', '#ffffff'],
  // Stars & Stripes: red/white-dominant with a navy canton (distinct from the
  // even blue-white-red of France).
  USA: ['#b22234', '#ffffff', '#b22234', '#3c3b6e'],
  PAR: ['#d52b1e', '#ffffff', '#0038a8'],
  // Navy-DOMINANT field + Union Jack: weighted heavily to deep navy with a white
  // (Southern Cross) and red accent, so it doesn't read as a French tricolor.
  AUS: ['#0a1f5e', '#0a1f5e', '#ffffff', '#e4002b'],
  TUR: ['#e30a17', '#ffffff'],
  GER: ['#000000', '#dd0000', '#ffce00'],
  CUW: ['#002b7f', '#f9d616', '#ffffff'],
  CIV: ['#f77f00', '#ffffff', '#009e60'],
  ECU: ['#ffd100', '#0072ce', '#ef3340'],
  NED: ['#ae1c28', '#ffffff', '#21468b'],
  JPN: ['#ffffff', '#bc002d'],
  SWE: ['#006aa7', '#fecc00'],
  TUN: ['#e70013', '#ffffff'],
  BEL: ['#000000', '#fdda24', '#ef3340'],
  EGY: ['#ce1126', '#ffffff', '#000000'],
  IRN: ['#239f40', '#ffffff', '#da0000'],
  // Navy-DOMINANT with red (Southern Cross) stars — weighted to navy + red so it
  // is distinct from both Australia (navy + white) and France (even tricolor).
  NZL: ['#00247d', '#00247d', '#00247d', '#c8102e'],
  ESP: ['#aa151b', '#f1bf00', '#aa151b'],
  CPV: ['#003893', '#ffffff', '#cf2027'],
  KSA: ['#006c35', '#ffffff'],
  URU: ['#0038a8', '#ffffff', '#5cbfeb'],
  FRA: ['#0055a4', '#ffffff', '#ef4135'],
  SEN: ['#00853f', '#fdef42', '#e31b23'],
  IRQ: ['#ce1126', '#ffffff', '#000000', '#007a3d'],
  NOR: ['#ba0c2f', '#ffffff', '#00205b'],
  ARG: ['#75aadb', '#ffffff', '#f6b40e', '#75aadb'],
  ALG: ['#006233', '#ffffff', '#d21034'],
  AUT: ['#ed2939', '#ffffff', '#ed2939'],
  JOR: ['#000000', '#ffffff', '#007a3d', '#ce1126'],
  POR: ['#006600', '#ffcc00', '#ff0000'],
  COD: ['#007fff', '#f7d618', '#ce1021'],
  UZB: ['#1eb53a', '#ffffff', '#0099b5'],
  COL: ['#fcd116', '#003893', '#ce1126'],
  ENG: ['#ffffff', '#ce1124'],
  CRO: ['#ff0000', '#ffffff', '#171796'],
  GHA: ['#ce1126', '#fcd116', '#006b3f', '#000000'],
  PAN: ['#d21034', '#ffffff', '#005293'],
};

/**
 * A handful of researched star mappings (code -> name/position). Used only as a
 * fallback when live squad data (players.json) isn't available for a slot.
 */
const KNOWN_PLAYERS: Record<string, { name: string; position: string }> = {
  ARG17: { name: 'Lionel Messi', position: 'Forward' },
  BRA14: { name: 'Vinícius Júnior', position: 'Forward' },
};

const POSITION_BY_SLOT = (slot: number): string => {
  // Rough Panini ordering: GK/defenders early, forwards later. Placeholder only.
  if (slot <= 4) return 'Goalkeeper / Defender';
  if (slot <= 12) return 'Midfielder';
  return 'Forward';
};

function buildTeamStickers(team: TeamDef): Sticker[] {
  const group = team.group;
  const out: Sticker[] = [];
  const matchSquad = squadMatcher(SQUADS[team.code] ?? []);

  for (let number = 1; number <= STICKERS_PER_TEAM; number++) {
    const code = `${team.code}${number}`;
    const base = {
      code,
      section: 'team' as const,
      groupName: group,
      teamCode: team.code,
      teamName: team.name,
      number,
    };

    // The real Panini checklist title for this exact code is authoritative.
    const title = CHECKLIST[code];

    if (title && /team logo|badge|emblem/i.test(title)) {
      out.push({
        ...base,
        type: 'badge',
        playerName: `${team.name} (${title})`,
        position: null,
        club: null,
        jersey: null,
        caps: null,
        goals: null,
        isFoil: true, // crest/emblem stickers are the shiny foils
        verified: true,
      });
      continue;
    }

    if (title && /team photo|line[- ]?up|squad/i.test(title)) {
      out.push({
        ...base,
        type: 'team_photo',
        playerName: `${team.name} (${title})`,
        position: null,
        club: null,
        jersey: null,
        caps: null,
        goals: null,
        isFoil: false,
        verified: true,
      });
      continue;
    }

    if (title) {
      // A real player on the correct numbered sticker; enrich from the squad.
      const sq = matchSquad(title);
      out.push({
        ...base,
        type: 'player',
        playerName: title,
        position: sq?.pos ?? null,
        club: sq?.club || null,
        jersey: sq?.no ?? null,
        caps: sq?.caps ?? null,
        goals: sq?.goals ?? null,
        isFoil: false,
        verified: true,
      });
      continue;
    }

    // No checklist entry (offline / not generated): structural placeholder.
    const known = KNOWN_PLAYERS[code];
    const isBadge = number === BADGE_SLOT;
    const isPhoto = number === TEAM_PHOTO_SLOT;
    out.push({
      ...base,
      type: isBadge ? 'badge' : isPhoto ? 'team_photo' : 'player',
      playerName: isBadge
        ? `${team.name} (Team Badge)`
        : isPhoto
          ? `${team.name} (Team Photo)`
          : known?.name ?? `${team.name} — Player ${number}`,
      position: isBadge || isPhoto ? null : known?.position ?? POSITION_BY_SLOT(number),
      club: null,
      jersey: null,
      caps: null,
      goals: null,
      isFoil: isBadge,
      verified: Boolean(isBadge || isPhoto || known),
    });
  }

  return out;
}

function buildIntroAndMuseum(): Sticker[] {
  const out: Sticker[] = [];

  // FWC1..FWC8 — intro / emblems / mascots
  const introTitles = [
    'Official Tournament Emblem',
    'Host Cities Map',
    'Official Mascots',
    'Official Match Ball',
    'World Cup Trophy',
    'Tournament Poster',
    'Opening Ceremony',
    'FIFA Fan Festival',
  ];
  introTitles.forEach((title, i) => {
    out.push({
      code: `FWC${i + 1}`,
      section: 'intro',
      groupName: null,
      teamCode: null,
      teamName: 'Introduction',
      number: i + 1,
      type: 'emblem',
      playerName: title,
      position: null,
      club: null,
      jersey: null,
      caps: null,
      goals: null,
      isFoil: true,
      verified: false,
    });
  });

  // FWC9..FWC19 — FIFA Museum past champions (11 stickers)
  for (let i = 0; i < 11; i++) {
    const number = 9 + i;
    out.push({
      code: `FWC${number}`,
      section: 'museum',
      groupName: null,
      teamCode: null,
      teamName: 'FIFA Museum',
      number,
      type: 'legend',
      playerName: `Past World Cup Champion #${i + 1}`,
      position: null,
      club: null,
      jersey: null,
      caps: null,
      goals: null,
      isFoil: true,
      verified: false,
    });
  }

  return out;
}

function buildCocaCola(): Sticker[] {
  const out: Sticker[] = [];
  for (let i = 1; i <= 12; i++) {
    out.push({
      code: `CC${i}`,
      section: 'coca_cola',
      groupName: null,
      teamCode: null,
      teamName: 'Coca-Cola Special',
      number: i,
      type: 'special',
      playerName: `Coca-Cola Special #${i}`,
      position: null,
      club: null,
      jersey: null,
      caps: null,
      goals: null,
      isFoil: true,
      verified: false,
    });
  }
  return out;
}

function generate(): Sticker[] {
  const stickers: Sticker[] = [];
  stickers.push(...buildIntroAndMuseum());
  TEAMS.forEach((team) => stickers.push(...buildTeamStickers(team)));
  stickers.push(...buildCocaCola());
  return stickers;
}

function buildTeams(): Team[] {
  return TEAMS.map((team) => ({
    teamCode: team.code,
    teamName: team.name,
    groupName: team.group,
    section: 'team' as const,
    stickerCount: STICKERS_PER_TEAM,
    colors: {
      primary: team.primary,
      secondary: team.secondary,
      flag: FLAGS[team.code] ?? [team.primary, team.secondary],
    },
  }));
}

function main(): void {
  const stickers = generate();
  const teams = buildTeams();

  // Sanity checks — fail loudly if structure drifts.
  const codes = new Set(stickers.map((s) => s.code));
  if (codes.size !== stickers.length) {
    throw new Error('Duplicate sticker codes detected!');
  }
  const teamCount = new Set(stickers.filter((s) => s.section === 'team').map((s) => s.teamCode))
    .size;
  if (teamCount !== TEAMS.length) {
    throw new Error(`Expected ${TEAMS.length} teams, got ${teamCount}`);
  }

  const outDir = resolve(__dirname, '../src/data');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'stickers.json');
  const teamsPath = resolve(outDir, 'teams.json');
  writeFileSync(outPath, JSON.stringify(stickers, null, 2) + '\n', 'utf8');
  writeFileSync(teamsPath, JSON.stringify(teams, null, 2) + '\n', 'utf8');

  const verified = stickers.filter((s) => s.verified).length;
  console.log(`Wrote ${stickers.length} stickers to ${outPath}`);
  console.log(`Wrote ${teams.length} teams to ${teamsPath}`);
  console.log(`  Teams: ${TEAMS.length} x ${STICKERS_PER_TEAM} = ${TEAMS.length * STICKERS_PER_TEAM}`);
  console.log(`  Intro+Museum: 19, Coca-Cola: 12`);
  console.log(`  Verified entries: ${verified} (${stickers.length - verified} placeholders to complete)`);
}

main();
