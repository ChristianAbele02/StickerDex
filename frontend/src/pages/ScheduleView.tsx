import { useMemo, useState } from 'react';
import type { TournamentState } from '../hooks/useTournament.ts';
import { MatchCard } from '../components/MatchCard.tsx';
import {
  STAGE_LABELS,
  STAGE_ORDER,
  isPlayed,
  localDateKey,
  formatDateHeading,
  teamIndex,
} from '../lib/tournament.ts';
import type { MatchStage } from '../types.ts';

interface ScheduleViewProps {
  tournament: TournamentState;
  favorite: string;
}

export function ScheduleView({ tournament, favorite }: ScheduleViewProps) {
  const { matches, teams, standings, predictions, setResult, clearResult } = tournament;
  const [stage, setStage] = useState<MatchStage | 'all'>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [hideFinished, setHideFinished] = useState(false);

  const teamMap = useMemo(() => teamIndex(teams), [teams]);
  const matchByNum = useMemo(() => new Map(matches.map((m) => [m.num, m])), [matches]);

  const visible = useMemo(() => {
    return matches.filter((m) => {
      if (stage !== 'all' && m.stage !== stage) return false;
      if (hideFinished && isPlayed(m)) return false;
      if (favOnly && favorite && m.homeCode !== favorite && m.awayCode !== favorite) return false;
      return true;
    });
  }, [matches, stage, hideFinished, favOnly, favorite]);

  // Group by local calendar day (in kickoff order, which matches num order).
  const byDay = useMemo(() => {
    const groups: { key: string; iso: string; items: typeof visible }[] = [];
    for (const m of visible) {
      const key = localDateKey(m.kickoff);
      let g = groups.find((x) => x.key === key);
      if (!g) {
        g = { key, iso: m.kickoff, items: [] };
        groups.push(g);
      }
      g.items.push(m);
    }
    return groups;
  }, [visible]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as MatchStage | 'all')}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="all">All stages</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-slate-500">
          <input
            type="checkbox"
            checked={hideFinished}
            onChange={(e) => setHideFinished(e.target.checked)}
          />
          Upcoming only
        </label>
        {favorite && (
          <label className="flex items-center gap-1.5 text-slate-500">
            <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} />
            Only my team ★
          </label>
        )}
        <span className="ml-auto text-xs text-slate-400">{visible.length} matches</span>
      </div>

      {byDay.map((day) => (
        <section key={day.key} className="mb-6">
          <h3 className="mb-2 text-sm font-bold text-slate-500">{formatDateHeading(day.iso)}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {day.items.map((m) => (
              <MatchCard
                key={m.num}
                match={m}
                teams={teamMap}
                matchByNum={matchByNum}
                standings={standings}
                prediction={predictions[m.num]}
                favorite={favorite}
                onSetResult={setResult}
                onClearResult={clearResult}
              />
            ))}
          </div>
        </section>
      ))}

      {visible.length === 0 && (
        <p className="p-6 text-center text-sm text-slate-500">No matches match these filters.</p>
      )}
    </div>
  );
}
