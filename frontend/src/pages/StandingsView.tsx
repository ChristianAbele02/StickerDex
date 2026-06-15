import { useMemo } from 'react';
import type { MatchTeam, StandingRow } from '../types.ts';
import { teamIndex } from '../lib/tournament.ts';

interface StandingsViewProps {
  standings: StandingRow[];
  teams: MatchTeam[];
  favorite: string;
}

function GroupTable({
  group,
  rows,
  teamMap,
  favorite,
}: {
  group: string;
  rows: StandingRow[];
  teamMap: Map<string, MatchTeam>;
  favorite: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
      <div className="bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800">
        Group {group}
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] uppercase text-slate-400">
          <tr>
            <th className="px-2 py-1.5 font-medium">#</th>
            <th className="px-2 py-1.5 font-medium">Team</th>
            <th className="px-1 py-1.5 text-center font-medium" title="Played">P</th>
            <th className="px-1 py-1.5 text-center font-medium" title="Won">W</th>
            <th className="px-1 py-1.5 text-center font-medium" title="Drawn">D</th>
            <th className="px-1 py-1.5 text-center font-medium" title="Lost">L</th>
            <th className="px-1 py-1.5 text-center font-medium" title="Goal difference">GD</th>
            <th className="px-2 py-1.5 text-center font-semibold" title="Points">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const colors = teamMap.get(r.code)?.colors;
            const fav = favorite === r.code;
            return (
              <tr
                key={r.code}
                className={`border-t border-slate-100 dark:border-slate-800 ${
                  r.rank <= 2 ? 'bg-emerald-50/60 dark:bg-emerald-950/30' : ''
                } ${fav ? 'font-semibold text-emerald-700 dark:text-emerald-400' : ''}`}
              >
                <td className="px-2 py-1.5 text-slate-400">{r.rank}</td>
                <td className="px-2 py-1.5">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{
                        background: colors
                          ? `linear-gradient(135deg, ${colors.primary} 50%, ${colors.secondary} 50%)`
                          : '#cbd5e1',
                      }}
                    />
                    {r.name}
                    {fav && ' ★'}
                  </span>
                </td>
                <td className="px-1 py-1.5 text-center text-slate-500">{r.played}</td>
                <td className="px-1 py-1.5 text-center text-slate-500">{r.won}</td>
                <td className="px-1 py-1.5 text-center text-slate-500">{r.drawn}</td>
                <td className="px-1 py-1.5 text-center text-slate-500">{r.lost}</td>
                <td className="px-1 py-1.5 text-center text-slate-500">
                  {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                </td>
                <td className="px-2 py-1.5 text-center font-bold">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StandingsView({ standings, teams, favorite }: StandingsViewProps) {
  const teamMap = useMemo(() => teamIndex(teams), [teams]);
  const groups = useMemo(() => {
    const map = new Map<string, StandingRow[]>();
    for (const r of standings) {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [standings]);

  return (
    <div>
      <p className="mb-4 text-xs text-slate-400">
        Top two of each group (shaded) advance, plus the eight best third-placed teams. Standings
        update live as you enter results.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(([group, rows]) => (
          <GroupTable
            key={group}
            group={group}
            rows={rows}
            teamMap={teamMap}
            favorite={favorite}
          />
        ))}
      </div>
    </div>
  );
}
