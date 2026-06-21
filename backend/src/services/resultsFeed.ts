/**
 * Live results feed: at startup (and on demand) pull the latest played scores
 * from the public openfootball dataset (CC0) and fold them into `match_results`,
 * so the schedule, **Elo ratings, predictions, standings and the Monte Carlo
 * simulator all reflect real games as they're played** — those are derived from
 * `match_results` on every request, so updating it is all that's needed.
 *
 * SAFETY: the feed only ever writes/overwrites rows it owns (`source = 'feed'`).
 * Any score you edited in-app (`source = 'user'`) is left untouched. Network
 * failures are swallowed by callers — a missed refresh never blocks startup.
 */
import type { DB } from '../db/index.ts';
import { parseResults, type ParsedResult } from '../lib/openfootball.ts';

const DEFAULT_CUP_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup/master/2026--usa/cup.txt';
const DEFAULT_FINALS_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup/master/2026--usa/cup_finals.txt';

export interface RefreshSummary {
  /** New results inserted. */
  added: number;
  /** Existing feed results whose score changed upstream. */
  updated: number;
  /** Already up to date or protected user edits. */
  unchanged: number;
  /** Parsed results with no matching fixture (e.g. knockout slots unresolved). */
  unmatched: number;
  /** Total played results parsed from the feed. */
  total: number;
}

/** Whether the live feed is enabled (set LIVE_RESULTS=off to disable). */
export function liveResultsEnabled(): boolean {
  const v = (process.env.LIVE_RESULTS ?? 'on').toLowerCase();
  return v !== 'off' && v !== '0' && v !== 'false' && v !== 'no';
}

/**
 * Fold parsed results into match_results. Matches each result to a fixture by
 * (home_code, away_code). Never overwrites a row marked `source = 'user'`.
 */
export function applyResults(db: DB, results: ParsedResult[]): RefreshSummary {
  const findNum = db.prepare('SELECT num FROM matches WHERE home_code = ? AND away_code = ?');
  const existing = db.prepare(
    'SELECT home_score AS h, away_score AS a, source FROM match_results WHERE num = ?',
  );
  const upsert = db.prepare(/* sql */ `
    INSERT INTO match_results (num, home_score, away_score, source, updated_at)
    VALUES (@num, @h, @a, 'feed', datetime('now'))
    ON CONFLICT(num) DO UPDATE SET
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      updated_at = excluded.updated_at
    WHERE match_results.source != 'user'
  `);

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let unmatched = 0;

  const run = db.transaction(() => {
    for (const r of results) {
      const fixture = findNum.get(r.homeCode, r.awayCode) as { num: number } | undefined;
      if (!fixture) {
        unmatched++;
        continue;
      }
      const cur = existing.get(fixture.num) as { h: number; a: number; source: string } | undefined;
      if (!cur) {
        upsert.run({ num: fixture.num, h: r.homeScore, a: r.awayScore });
        added++;
      } else if (cur.source === 'user' || (cur.h === r.homeScore && cur.a === r.awayScore)) {
        unchanged++; // protected edit, or already current
      } else {
        upsert.run({ num: fixture.num, h: r.homeScore, a: r.awayScore });
        updated++;
      }
    }
  });
  run();

  return { added, updated, unchanged, unmatched, total: results.length };
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export interface RefreshOptions {
  cupUrl?: string;
  finalsUrl?: string;
  timeoutMs?: number;
  /** Injected fetcher for tests (bypasses the network). */
  fetchImpl?: (url: string) => Promise<string>;
}

/**
 * Fetch the latest openfootball files and apply their results. The group-stage
 * file is required; the knockout file is optional (tolerated if it fails).
 */
export async function refreshResults(db: DB, opts: RefreshOptions = {}): Promise<RefreshSummary> {
  const cupUrl = opts.cupUrl ?? process.env.RESULTS_FEED_CUP_URL ?? DEFAULT_CUP_URL;
  const finalsUrl = opts.finalsUrl ?? process.env.RESULTS_FEED_FINALS_URL ?? DEFAULT_FINALS_URL;
  const timeoutMs = opts.timeoutMs ?? Number(process.env.RESULTS_FEED_TIMEOUT_MS ?? 8000);
  const getText = opts.fetchImpl ?? ((u: string) => fetchText(u, timeoutMs));

  const cupText = await getText(cupUrl);
  let finalsText = '';
  try {
    finalsText = await getText(finalsUrl);
  } catch {
    /* knockout file is optional — group stage is enough */
  }

  const results = [...parseResults(cupText), ...parseResults(finalsText)];
  return applyResults(db, results);
}
