/**
 * A small, fully self-hosted match predictor based on the Elo rating system.
 *
 * Each team starts from an approximate seed rating (rough strength tiers — an
 * estimate, not an official ranking). Played matches with both teams known are
 * replayed in kickoff order to update ratings, so predictions sharpen as you
 * enter real results. For any upcoming fixture we convert the rating gap into
 * win / draw / win probabilities. No external API, no network — runs offline.
 */
import type { Match, MatchPrediction } from '../types.ts';

/** Home-field advantage in Elo points (added to the nominal home side). */
const HOME_ADVANTAGE = 60;
/** Update strength. World Cup matches are high-importance, so K is large. */
const K = 40;

/**
 * Approximate seed ratings by FIFA code (strength tiers, ~June 2026). These are
 * deliberately coarse estimates; results you enter move them from here.
 */
const SEED: Record<string, number> = {
  ARG: 1950, FRA: 1940, ESP: 1930, ENG: 1920, BRA: 1910, POR: 1890, NED: 1870,
  GER: 1860, BEL: 1840, CRO: 1820, URU: 1810, COL: 1800, MAR: 1800, SUI: 1780,
  USA: 1770, MEX: 1760, JPN: 1760, SEN: 1750, KOR: 1730, ECU: 1720, AUS: 1700,
  NOR: 1700, SWE: 1690, AUT: 1690, EGY: 1680, IRN: 1680, TUR: 1680, CIV: 1670,
  QAT: 1650, KSA: 1640, PAR: 1640, GHA: 1640, SCO: 1660, TUN: 1650, ALG: 1660,
  COD: 1630, UZB: 1600, PAN: 1600, NZL: 1560, RSA: 1620, BIH: 1640, HAI: 1540,
  CUW: 1520, CPV: 1580, IRQ: 1580, JOR: 1560,
};

const DEFAULT_RATING = 1600;

function seedRatings(): Map<string, number> {
  const m = new Map<string, number>();
  for (const [code, elo] of Object.entries(SEED)) m.set(code, elo);
  return m;
}

/** Goal-difference multiplier so blowouts move ratings more (FIFA-style). */
function marginMultiplier(margin: number): number {
  if (margin <= 1) return 1;
  if (margin === 2) return 1.5;
  return (11 + margin) / 8;
}

/** Replay all played matches (both teams known) to get current ratings. */
export function buildRatings(matches: Match[]): Map<string, number> {
  const ratings = seedRatings();
  const get = (c: string) => ratings.get(c) ?? DEFAULT_RATING;

  const played = matches
    .filter((m) => m.homeCode && m.awayCode && m.homeScore !== null && m.awayScore !== null)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  for (const m of played) {
    const home = m.homeCode as string;
    const away = m.awayCode as string;
    const rh = get(home);
    const ra = get(away);
    const expHome = expectedScore(rh + HOME_ADVANTAGE, ra);
    const actualHome = m.homeScore! > m.awayScore! ? 1 : m.homeScore! === m.awayScore! ? 0.5 : 0;
    const mult = marginMultiplier(Math.abs(m.homeScore! - m.awayScore!));
    const delta = K * mult * (actualHome - expHome);
    ratings.set(home, rh + delta);
    ratings.set(away, ra - delta);
  }
  return ratings;
}

/** Elo expected score (probability-of-points) for A vs B. */
function expectedScore(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/**
 * Convert two ratings into win / draw / win probabilities. The expected score
 * splits home vs away; draw mass peaks when the sides are evenly matched.
 */
export function predict(homeElo: number, awayElo: number, neutralWeight = 1): {
  homeWin: number;
  draw: number;
  awayWin: number;
} {
  const e = expectedScore(homeElo + HOME_ADVANTAGE * neutralWeight, awayElo);
  const drawPeak = 0.28;
  const draw = drawPeak * (1 - 2 * Math.abs(e - 0.5));
  const homeWin = e * (1 - draw);
  const awayWin = (1 - e) * (1 - draw);
  return { homeWin, draw, awayWin };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Predictions for every fixture that has two known teams and no result yet. */
export function getPredictions(matches: Match[]): MatchPrediction[] {
  const ratings = buildRatings(matches);
  const out: MatchPrediction[] = [];
  for (const m of matches) {
    if (!m.homeCode || !m.awayCode) continue;
    if (m.homeScore !== null && m.awayScore !== null) continue; // already played
    const homeElo = ratings.get(m.homeCode) ?? DEFAULT_RATING;
    const awayElo = ratings.get(m.awayCode) ?? DEFAULT_RATING;
    // Knockout matches are at neutral-ish venues — soften home advantage.
    const neutralWeight = m.stage === 'group' ? 1 : 0.4;
    const p = predict(homeElo, awayElo, neutralWeight);
    out.push({
      num: m.num,
      homeWin: round(p.homeWin),
      draw: round(p.draw),
      awayWin: round(p.awayWin),
      homeElo: Math.round(homeElo),
      awayElo: Math.round(awayElo),
    });
  }
  return out;
}
