/**
 * Monte Carlo World Cup forecaster.
 *
 * In the spirit of academic tournament forecasters (Klement, Zeileis, the
 * FiveThirtyEight SPI model, Groll et al.): take a **team-strength rating**,
 * turn each fixture into a **probabilistic match outcome**, then **simulate the
 * whole tournament** many thousands of times and count how often each team
 * advances / reaches each round / lifts the trophy.
 *
 *   • Strength      → Elo ratings (see predictions.ts), which already update
 *                     from real results, so the forecast is live.
 *   • Match model   → independent Poisson goals whose means come from the Elo
 *                     gap + home advantage (realistic scorelines + tiebreakers).
 *   • Tournament    → the real bracket: group tiebreakers, the eight best
 *                     third-placed teams assigned to their official R32 slots,
 *                     then knockout progression to the final.
 *   • Conditioning  → already-played matches use their real result, so as the
 *                     tournament unfolds the probabilities sharpen.
 *
 * This is a statistical simulation, not a black-box trained model — every step
 * is explainable.
 */
import type { Match, MatchTeam, SimRoundProbs, SimMatch, SingleSimResult } from '../types.ts';
import { buildRatings } from './predictions.ts';

const HOME_ADVANTAGE = 60; // Elo points
const GOAL_BASE = 2.75; // ~average total goals in a World Cup match
const SUPREMACY_PER_100 = 0.36; // goal-difference per 100 Elo of edge

// --- seeded RNG (mulberry32) so single sims + tests are reproducible ----------
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Poisson sample (Knuth) — fine for the small means used here. */
function poisson(lambda: number, rand: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
}

const expectedScore = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 400));

interface SimContext {
  teams: MatchTeam[];
  byCode: Map<string, MatchTeam>;
  ratings: Map<string, number>;
  groupMatches: Map<string, Match[]>;
  knockout: Match[]; // sorted by num
  /** R32 match num → { home/away that are best-third slots, allowed groups }. */
  thirdSlots: { num: number; side: 'home' | 'away'; allowed: string[] }[];
}

/** Sample a scoreline for a fixture given the two teams' ratings. */
function sampleScore(
  homeElo: number,
  awayElo: number,
  neutralWeight: number,
  rand: () => number,
): [number, number] {
  const eff = homeElo + HOME_ADVANTAGE * neutralWeight - awayElo;
  const supremacy = (eff / 100) * SUPREMACY_PER_100;
  const lh = Math.max(0.2, GOAL_BASE / 2 + supremacy / 2);
  const la = Math.max(0.2, GOAL_BASE / 2 - supremacy / 2);
  return [poisson(lh, rand), poisson(la, rand)];
}

interface GroupRow {
  code: string;
  group: string;
  points: number;
  gd: number;
  gf: number;
}

/** Simulate one group; return rows ranked 1..4 (random tiebreak last). */
function simulateGroup(matches: Match[], ctx: SimContext, rand: () => number): GroupRow[] {
  const table = new Map<string, GroupRow>();
  const ensure = (code: string, group: string) => {
    let r = table.get(code);
    if (!r) {
      r = { code, group, points: 0, gd: 0, gf: 0 };
      table.set(code, r);
    }
    return r;
  };

  for (const m of matches) {
    if (!m.homeCode || !m.awayCode) continue;
    const home = ensure(m.homeCode, m.group ?? '');
    const away = ensure(m.awayCode, m.group ?? '');
    let hg: number;
    let ag: number;
    if (m.homeScore !== null && m.awayScore !== null) {
      hg = m.homeScore;
      ag = m.awayScore; // played → real result
    } else {
      [hg, ag] = sampleScore(ctx.ratings.get(m.homeCode)!, ctx.ratings.get(m.awayCode)!, 1, rand);
    }
    home.gf += hg;
    away.gf += ag;
    home.gd += hg - ag;
    away.gd += ag - hg;
    if (hg > ag) home.points += 3;
    else if (ag > hg) away.points += 3;
    else {
      home.points++;
      away.points++;
    }
  }

  return [...table.values()].sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || rand() - 0.5,
  );
}

/** Assign the 8 qualifying thirds to the 8 official R32 slots (constraint match). */
function assignThirds(
  thirds: GroupRow[], // 8 best, each from a distinct group
  slots: { num: number; side: 'home' | 'away'; allowed: string[] }[],
): Map<string, string> {
  // Map "num:side" → team code.
  const result = new Map<string, string>();
  const used = new Array(thirds.length).fill(false);
  // Order slots by fewest feasible options first (helps backtracking).
  const order = [...slots.keys()].sort((i, j) => {
    const fi = thirds.filter((t) => slots[i].allowed.includes(t.group)).length;
    const fj = thirds.filter((t) => slots[j].allowed.includes(t.group)).length;
    return fi - fj;
  });

  const backtrack = (k: number): boolean => {
    if (k === order.length) return true;
    const slot = slots[order[k]];
    for (let i = 0; i < thirds.length; i++) {
      if (used[i] || !slot.allowed.includes(thirds[i].group)) continue;
      used[i] = true;
      result.set(`${slot.num}:${slot.side}`, thirds[i].code);
      if (backtrack(k + 1)) return true;
      used[i] = false;
      result.delete(`${slot.num}:${slot.side}`);
    }
    return false;
  };

  if (!backtrack(0)) {
    // Fallback: assign remaining arbitrarily (keeps the sim running).
    let i = 0;
    for (const slot of slots) {
      const key = `${slot.num}:${slot.side}`;
      if (result.has(key)) continue;
      while (i < thirds.length && used[i]) i++;
      if (i < thirds.length) {
        used[i] = true;
        result.set(key, thirds[i].code);
      }
    }
  }
  return result;
}

/** Furthest stage a team reaches: 1 group · 2 R32 · 3 R16 · 4 QF · 5 SF · 6 Final · 7 Champion. */
const STAGE_AFTER_WIN: Record<string, number> = {
  round32: 3,
  round16: 4,
  quarter: 5,
  semi: 6,
  final: 7,
};

interface OneSim {
  furthest: Map<string, number>;
  groupRank: Map<string, number>; // 1..4
  bracket?: SimMatch[];
  groups?: GroupRow[];
  champion?: string;
}

/** Play a single full tournament. `detail` also records the filled bracket. */
function simulateTournament(ctx: SimContext, rand: () => number, detail = false): OneSim {
  const furthest = new Map<string, number>();
  const groupRank = new Map<string, number>();
  const allGroupRows: GroupRow[] = [];

  const firsts: GroupRow[] = [];
  const seconds: GroupRow[] = [];
  const thirds: GroupRow[] = [];

  for (const [, matches] of ctx.groupMatches) {
    const rows = simulateGroup(matches, ctx, rand);
    rows.forEach((r, i) => {
      groupRank.set(r.code, i + 1);
      if (detail) allGroupRows.push(r);
    });
    if (rows[0]) {
      firsts.push(rows[0]);
      furthest.set(rows[0].code, 2);
    }
    if (rows[1]) {
      seconds.push(rows[1]);
      furthest.set(rows[1].code, 2);
    }
    if (rows[2]) thirds.push(rows[2]);
  }

  // 8 best third-placed teams advance.
  const bestThirds = thirds
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || rand() - 0.5)
    .slice(0, 8);
  for (const t of bestThirds) furthest.set(t.code, 2);

  const thirdAssign = assignThirds(bestThirds, ctx.thirdSlots);
  const rank1 = new Map(firsts.map((r) => [r.group, r.code]));
  const rank2 = new Map(seconds.map((r) => [r.group, r.code]));

  const winners = new Map<number, string>();
  const losers = new Map<number, string>();
  const bracket: SimMatch[] = [];

  const resolve = (label: string, num: number, side: 'home' | 'away'): string | null => {
    const gr = label.match(/^([12])([A-L])$/);
    if (gr) return (gr[1] === '1' ? rank1 : rank2).get(gr[2]) ?? null;
    if (label.startsWith('3')) return thirdAssign.get(`${num}:${side}`) ?? null;
    const wl = label.match(/^([WL])(\d+)$/);
    if (wl) return (wl[1] === 'W' ? winners : losers).get(Number(wl[2])) ?? null;
    return null;
  };

  for (const m of ctx.knockout) {
    const home = resolve(m.homeLabel, m.num, 'home');
    const away = resolve(m.awayLabel, m.num, 'away');
    if (!home || !away) continue; // unresolved (shouldn't happen)

    let hg: number;
    let ag: number;
    const played =
      m.homeScore !== null &&
      m.awayScore !== null &&
      ((m.homeCode === home && m.awayCode === away) ||
        (m.homeCode === away && m.awayCode === home));
    if (played) {
      // Use the real result, oriented to our resolved home/away.
      [hg, ag] = m.homeCode === home ? [m.homeScore!, m.awayScore!] : [m.awayScore!, m.homeScore!];
    } else {
      [hg, ag] = sampleScore(ctx.ratings.get(home)!, ctx.ratings.get(away)!, 0.35, rand);
    }

    let winner = hg > ag ? home : ag > hg ? away : null;
    if (!winner) {
      // Knockout draw → penalties, weighted by Elo (≈50/50 for equal sides).
      const pHome = expectedScore(ctx.ratings.get(home)!, ctx.ratings.get(away)!);
      winner = rand() < pHome ? home : away;
    }
    const loser = winner === home ? away : home;
    winners.set(m.num, winner);
    losers.set(m.num, loser);

    const bump = STAGE_AFTER_WIN[m.stage];
    if (bump && (furthest.get(winner) ?? 0) < bump) furthest.set(winner, bump);

    if (detail) {
      bracket.push({
        num: m.num,
        stage: m.stage,
        homeCode: home,
        homeName: ctx.byCode.get(home)?.name ?? home,
        awayCode: away,
        awayName: ctx.byCode.get(away)?.name ?? away,
        homeGoals: hg,
        awayGoals: ag,
        winnerCode: winner,
        decidedOnPens: hg === ag,
      });
    }
  }

  const champion = winners.get(104);
  return detail
    ? { furthest, groupRank, bracket, groups: allGroupRows, champion }
    : { furthest, groupRank, champion };
}

// --- public API ---------------------------------------------------------------

function buildContext(matches: Match[], teams: MatchTeam[]): SimContext {
  const byCode = new Map(teams.map((t) => [t.code, t]));
  const groupMatches = new Map<string, Match[]>();
  const knockout: Match[] = [];
  for (const m of matches) {
    if (m.stage === 'group' && m.group) {
      (groupMatches.get(m.group) ?? groupMatches.set(m.group, []).get(m.group)!).push(m);
    } else if (m.stage !== 'group') {
      knockout.push(m);
    }
  }
  knockout.sort((a, b) => a.num - b.num);

  // Discover best-third slots (R32 labels that start with "3").
  const thirdSlots: SimContext['thirdSlots'] = [];
  for (const m of knockout) {
    if (m.stage !== 'round32') continue;
    const add = (label: string, side: 'home' | 'away') => {
      if (label.startsWith('3')) {
        thirdSlots.push({ num: m.num, side, allowed: label.slice(1).split('/') });
      }
    };
    add(m.homeLabel, 'home');
    add(m.awayLabel, 'away');
  }

  return { teams, byCode, ratings: buildRatings(matches), groupMatches, knockout, thirdSlots };
}

/** Aggregated forecast: each team's probability of reaching each stage. */
export function runSimulation(matches: Match[], teams: MatchTeam[], runs: number): SimRoundProbs[] {
  const ctx = buildContext(matches, teams);
  const rand = rng((Date.now() & 0xffffffff) ^ (runs * 2654435761));

  const tally = new Map<
    string,
    { advance: number; r16: number; qf: number; sf: number; final: number; champion: number; winGroup: number }
  >();
  for (const t of teams) {
    tally.set(t.code, { advance: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0, winGroup: 0 });
  }

  for (let i = 0; i < runs; i++) {
    const { furthest, groupRank } = simulateTournament(ctx, rand);
    for (const [code, stage] of furthest) {
      const c = tally.get(code);
      if (!c) continue;
      if (stage >= 2) c.advance++;
      if (stage >= 3) c.r16++;
      if (stage >= 4) c.qf++;
      if (stage >= 5) c.sf++;
      if (stage >= 6) c.final++;
      if (stage >= 7) c.champion++;
    }
    for (const [code, rk] of groupRank) {
      if (rk === 1) tally.get(code)!.winGroup++;
    }
  }

  const out: SimRoundProbs[] = teams.map((t) => {
    const c = tally.get(t.code)!;
    const p = (n: number) => Math.round((n / runs) * 1000) / 1000;
    return {
      code: t.code,
      name: t.name,
      group: t.group,
      winGroup: p(c.winGroup),
      advance: p(c.advance),
      r16: p(c.r16),
      quarter: p(c.qf),
      semi: p(c.sf),
      final: p(c.final),
      champion: p(c.champion),
    };
  });
  out.sort((a, b) => b.champion - a.champion || b.final - a.final);
  return out;
}

/** A single random tournament with the fully filled-in bracket and champion. */
export function simulateOnce(matches: Match[], teams: MatchTeam[], seed?: number): SingleSimResult {
  const ctx = buildContext(matches, teams);
  const rand = rng(seed ?? (Date.now() & 0xffffffff));
  const sim = simulateTournament(ctx, rand, true);
  const championName = sim.champion ? ctx.byCode.get(sim.champion)?.name ?? sim.champion : null;
  return {
    seed: seed ?? null,
    championCode: sim.champion ?? null,
    championName,
    bracket: sim.bracket ?? [],
    groups: (sim.groups ?? []).map((r) => ({
      code: r.code,
      name: ctx.byCode.get(r.code)?.name ?? r.code,
      group: r.group,
      points: r.points,
      goalDiff: r.gd,
      goalsFor: r.gf,
    })),
  };
}
