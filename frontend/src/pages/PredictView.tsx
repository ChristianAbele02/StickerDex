import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SimRoundProbs, SingleSimResult, Team } from '../types.ts';
import { api } from '../api/client.ts';
import { flagGradient } from '../lib/sections.ts';
import { STAGE_LABELS } from '../lib/tournament.ts';
import type { MatchStage } from '../types.ts';

interface PredictViewProps {
  teams: Team[];
  favorite: string;
  defaultRuns?: number;
}

const RUN_OPTIONS = [1000, 10000, 50000];
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pct0 = (n: number) => `${Math.round(n * 100)}%`;

export function PredictView({ teams, favorite, defaultRuns = 10000 }: PredictViewProps) {
  const flagByCode = useMemo(
    () => new Map(teams.map((t) => [t.teamCode, t.colors.flag])),
    [teams],
  );
  const flagOf = useCallback(
    (code: string) => flagByCode.get(code) ?? ['#334155', '#0f172a'],
    [flagByCode],
  );

  const [runs, setRuns] = useState(defaultRuns);
  const [probs, setProbs] = useState<SimRoundProbs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runSim = useCallback((n: number) => {
    setLoading(true);
    setError(null);
    api
      .simulate(n)
      .then((r) => setProbs(r.teams))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => runSim(defaultRuns), [runSim, defaultRuns]);

  return (
    <div className="space-y-8">
      <IntroCard />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-slate-500">Simulations:</span>
        {RUN_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRuns(n)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              runs === n
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {n.toLocaleString()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => runSim(runs)}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          {loading ? 'Simulating…' : '▶ Run'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">Simulation failed: {error}</p>}

      {probs.length > 0 && (
        <>
          <ChampionBoard probs={probs} flagOf={flagOf} favorite={favorite} />
          <GroupForecast probs={probs} flagOf={flagOf} favorite={favorite} />
          <SingleRun flagOf={flagOf} favorite={favorite} />
        </>
      )}
    </div>
  );
}

function IntroCard() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white dark:from-slate-800 dark:to-slate-950">
      <h2 className="text-xl font-extrabold">🔮 Who will win the World Cup?</h2>
      <p className="mt-1 max-w-3xl text-sm text-white/80">
        A Monte Carlo forecast in the spirit of academic predictors: each team's{' '}
        <strong>Elo strength</strong> feeds a <strong>Poisson goal model</strong>, and the entire
        tournament — group tiebreakers, the eight best third-placed teams, and every knockout
        round — is simulated thousands of times. Results you've already entered are taken as fact,
        so the odds sharpen as the tournament unfolds.
      </p>
    </div>
  );
}

interface BoardProps {
  probs: SimRoundProbs[];
  flagOf: (code: string) => string[];
  favorite: string;
}

function ChampionBoard({ probs, flagOf, favorite }: BoardProps) {
  const max = Math.max(...probs.map((p) => p.champion), 0.01);
  const top = probs[0];

  return (
    <section>
      {/* Headline winner */}
      <div
        className="mb-5 flex items-center justify-between gap-4 rounded-2xl p-5 shadow-md"
        style={{
          background: `linear-gradient(rgba(0,0,0,0.32), rgba(0,0,0,0.32)), ${flagGradient(flagOf(top.code))}`,
          color: '#fff',
          textShadow: '0 1px 2px rgba(0,0,0,0.55)',
        }}
      >
        <div>
          <div className="text-xs font-bold uppercase tracking-wide opacity-80">
            🏆 Predicted champion
          </div>
          <div className="text-3xl font-extrabold">{top.name}</div>
          <div className="text-sm opacity-90">
            reaches the final {pct0(top.final)} of the time
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black">{pct(top.champion)}</div>
          <div className="text-xs opacity-80">to win it all</div>
        </div>
      </div>

      {/* Full ranked board */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
        <div className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 border-b border-slate-100 px-3 py-2 text-[10px] font-bold uppercase text-slate-400 dark:border-slate-800 sm:grid-cols-[1.5rem_1fr_4rem_3rem_3rem_3rem]">
          <span>#</span>
          <span>Team — chance to win</span>
          <span className="text-right">Win</span>
          <span className="hidden text-right sm:block">Final</span>
          <span className="hidden text-right sm:block">Semi</span>
          <span className="hidden text-right sm:block">R16</span>
        </div>
        {probs.map((t, i) => {
          const fav = favorite === t.code;
          return (
            <div
              key={t.code}
              className={`grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 border-b border-slate-50 px-3 py-1.5 text-sm last:border-0 dark:border-slate-800/50 sm:grid-cols-[1.5rem_1fr_4rem_3rem_3rem_3rem] ${
                fav ? 'bg-emerald-50/60 dark:bg-emerald-950/30' : ''
              }`}
            >
              <span className="text-xs text-slate-400">{i + 1}</span>
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                    style={{ background: flagGradient(flagOf(t.code), 90) }}
                  />
                  <span className={`truncate ${fav ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'font-medium'}`}>
                    {t.name}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(t.champion / max) * 100}%`, background: flagGradient(flagOf(t.code), 90) }}
                  />
                </div>
              </div>
              <span className="text-right font-bold tabular-nums">{pct(t.champion)}</span>
              <span className="hidden text-right tabular-nums text-slate-500 sm:block">{pct0(t.final)}</span>
              <span className="hidden text-right tabular-nums text-slate-500 sm:block">{pct0(t.semi)}</span>
              <span className="hidden text-right tabular-nums text-slate-500 sm:block">{pct0(t.r16)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GroupForecast({ probs, flagOf, favorite }: BoardProps) {
  const groups = useMemo(() => {
    const map = new Map<string, SimRoundProbs[]>();
    for (const t of probs) {
      if (!t.group) continue;
      (map.get(t.group) ?? map.set(t.group, []).get(t.group)!).push(t);
    }
    for (const list of map.values()) list.sort((a, b) => b.advance - a.advance);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [probs]);

  return (
    <section>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        Group-stage forecast — chance to advance
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(([group, rows]) => (
          <div key={group} className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
            <div className="bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase text-slate-500 dark:bg-slate-800">
              Group {group}
            </div>
            {rows.map((t) => (
              <div
                key={t.code}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm ${
                  favorite === t.code ? 'font-semibold text-emerald-700 dark:text-emerald-400' : ''
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ background: flagGradient(flagOf(t.code), 90) }}
                />
                <span className="flex-1 truncate">{t.name}</span>
                <span className="text-[10px] text-slate-400" title="chance to win the group">
                  🥇 {pct0(t.winGroup)}
                </span>
                <span className="w-10 text-right font-semibold tabular-nums">{pct0(t.advance)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

const BRACKET_ORDER: MatchStage[] = ['round32', 'round16', 'quarter', 'semi', 'final'];

function SingleRun({ flagOf, favorite }: { flagOf: (code: string) => string[]; favorite: string }) {
  const [sim, setSim] = useState<SingleSimResult | null>(null);
  const [loading, setLoading] = useState(false);

  const roll = useCallback(() => {
    setLoading(true);
    api
      .simulateOnce(Math.floor(Math.random() * 1e9))
      .then(setSim)
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Simulate one tournament
        </h3>
        <button
          type="button"
          onClick={roll}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Rolling…' : sim ? '🎲 Roll again' : '🎲 Play it out'}
        </button>
      </div>

      {!sim && (
        <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-800/50">
          Roll the dice to play one random tournament all the way to a champion — every knockout
          tie decided by the model.
        </p>
      )}

      {sim && (
        <>
          {sim.championName && (
            <div
              className="mb-4 rounded-2xl p-4 text-center shadow-md"
              style={{
                background: `linear-gradient(rgba(0,0,0,0.32), rgba(0,0,0,0.32)), ${flagGradient(flagOf(sim.championCode ?? ''))}`,
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.55)',
              }}
            >
              <div className="text-xs font-bold uppercase tracking-wide opacity-80">Champion</div>
              <div className="text-2xl font-black">🏆 {sim.championName}</div>
            </div>
          )}

          <div className="flex gap-3 overflow-x-auto pb-3">
            {BRACKET_ORDER.map((stage) => {
              const ms = sim.bracket.filter((m) => m.stage === stage).sort((a, b) => a.num - b.num);
              return (
                <div key={stage} className="flex shrink-0 flex-col gap-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {STAGE_LABELS[stage]}
                  </h4>
                  <div className="flex flex-1 flex-col justify-around gap-2">
                    {ms.map((m) => (
                      <SimMatchCard key={m.num} m={m} flagOf={flagOf} favorite={favorite} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function SimMatchCard({
  m,
  flagOf,
  favorite,
}: {
  m: SingleSimResult['bracket'][number];
  flagOf: (code: string) => string[];
  favorite: string;
}) {
  const side = (code: string, name: string, goals: number) => {
    const win = m.winnerCode === code;
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
            style={{ background: flagGradient(flagOf(code), 90) }}
          />
          <span
            className={`truncate ${win ? 'font-bold' : 'text-slate-500'} ${
              favorite === code ? 'text-emerald-600 dark:text-emerald-400' : ''
            }`}
          >
            {name}
          </span>
        </span>
        <span className={`tabular-nums ${win ? 'font-extrabold' : ''}`}>{goals}</span>
      </div>
    );
  };
  return (
    <div className="w-40 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {side(m.homeCode, m.homeName, m.homeGoals)}
      {side(m.awayCode, m.awayName, m.awayGoals)}
      {m.decidedOnPens && <div className="mt-0.5 text-right text-[9px] text-slate-400">on pens</div>}
    </div>
  );
}
