import { useMemo } from 'react';
import type { CollectionMap, Sticker, Team } from '../types.ts';
import { progressFor } from '../lib/stats.ts';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { ExportButtons } from '../components/ExportButtons.tsx';

interface StatsViewProps {
  stickers: Sticker[];
  teams: Team[];
  collection: CollectionMap;
}

const PER_PACK = 7;

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}

export function StatsView({ stickers, teams, collection }: StatsViewProps) {
  const overall = useMemo(() => progressFor(stickers, collection), [stickers, collection]);

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
        <p className="text-sm">
          Estimated packs still needed:{' '}
          <span className="font-bold">{Math.ceil(overall.missing / PER_PACK)}</span>{' '}
          <span className="text-xs text-slate-400">
            (best case, {PER_PACK} stickers/pack, no duplicates)
          </span>
        </p>
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
