import { useMemo } from 'react';
import type { CollectionMap, Sticker, Team } from '../types.ts';
import { packEstimate, progressFor } from '../lib/stats.ts';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { ExportButtons } from '../components/ExportButtons.tsx';

interface StatsViewProps {
  stickers: Sticker[];
  teams: Team[];
  collection: CollectionMap;
  stickersPerPack?: number;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}

export function StatsView({ stickers, teams, collection, stickersPerPack = 7 }: StatsViewProps) {
  const PER_PACK = Math.max(1, stickersPerPack);
  const overall = useMemo(() => progressFor(stickers, collection), [stickers, collection]);
  const estimate = useMemo(
    () => packEstimate(overall.total, overall.missing, PER_PACK),
    [overall.total, overall.missing, PER_PACK],
  );

  const teamStats = useMemo(() => {
    const byTeam = new Map<string, Sticker[]>();
    for (const s of stickers) {
      if (s.section !== 'team' || !s.teamCode) continue;
      const list = byTeam.get(s.teamCode) ?? [];
      list.push(s);
      byTeam.set(s.teamCode, list);
    }
    return teams.map((t) => ({
      team: t,
      progress: progressFor(byTeam.get(t.teamCode) ?? [], collection),
    }));
  }, [stickers, teams, collection]);

  const swaps = useMemo(
    () =>
      stickers
        .filter((s) => (collection[s.code] ?? 0) > 1)
        .map((s) => ({ s, extra: (collection[s.code] ?? 0) - 1 }))
        .sort((a, b) => b.extra - a.extra),
    [stickers, collection],
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Completion" value={`${overall.completionPct}%`} />
        <StatCard label="Owned" value={`${overall.owned}/${overall.total}`} />
        <StatCard label="Missing" value={`${overall.missing}`} />
        <StatCard
          label="Duplicates"
          value={`${overall.duplicates}`}
          hint={`${swaps.length} different to swap`}
        />
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Packs still needed
          </h3>
          <span className="text-xs text-slate-400">{PER_PACK} stickers/pack</span>
        </div>
        {overall.missing === 0 ? (
          <p className="text-sm font-semibold text-emerald-600">🎉 Album complete — no packs needed!</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <div className="text-2xl font-extrabold">{estimate.bestCasePacks}</div>
                <div className="text-[11px] font-medium text-slate-500">Best case</div>
                <div className="text-[10px] text-slate-400">all new, no dupes</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:ring-emerald-800">
                <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
                  {estimate.expectedPacks}
                </div>
                <div className="text-[11px] font-medium text-slate-500">Expected</div>
                <div className="text-[10px] text-slate-400">≈{estimate.expectedStickers} stickers</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <div className="text-2xl font-extrabold">{estimate.p90Packs}</div>
                <div className="text-[11px] font-medium text-slate-500">Worst case</div>
                <div className="text-[10px] text-slate-400">90% confidence</div>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              The <span className="font-semibold">expected</span> figure is the{' '}
              <a
                href="https://en.wikipedia.org/wiki/Coupon_collector%27s_problem"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted hover:text-slate-500"
              >
                coupon-collector
              </a>{' '}
              mean — random duplicates mean you’ll buy far more than the best case to finish the last
              few stickers. Assumes evenly-distributed packs; trading duplicates lowers it.
            </p>
          </>
        )}
      </div>

      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Completion by team
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {teamStats.map(({ team, progress }) => (
            <div key={team.teamCode} className="rounded-lg bg-white p-3 shadow-sm dark:bg-slate-900">
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold">
                  {team.teamName}
                  {team.groupName && (
                    <span className="ml-1 text-xs text-slate-400">· {team.groupName}</span>
                  )}
                </span>
                <span className="text-xs text-slate-500">
                  {progress.owned}/{progress.total}
                </span>
              </div>
              <ProgressBar
                pct={progress.completionPct}
                color={`linear-gradient(90deg, ${team.colors.primary}, ${team.colors.secondary})`}
              />
            </div>
          ))}
        </div>
      </section>

      {swaps.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Swap list — your duplicates
            </h3>
            <ExportButtons filter="dupes" />
          </div>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2 text-right">Spare</th>
                </tr>
              </thead>
              <tbody>
                {swaps.map(({ s, extra }) => (
                  <tr key={s.code} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 font-mono text-xs">{s.code}</td>
                    <td className="px-3 py-2">{s.playerName}</td>
                    <td className="px-3 py-2 text-slate-500">{s.teamName}</td>
                    <td className="px-3 py-2 text-right font-bold">×{extra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
