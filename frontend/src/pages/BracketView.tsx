import { useMemo } from 'react';
import type { Match, MatchStage, MatchTeam, StandingRow } from '../types.ts';
import { STAGE_LABELS, isPlayed, resolveSlot, teamIndex } from '../lib/tournament.ts';

interface BracketViewProps {
  matches: Match[];
  teams: MatchTeam[];
  standings: StandingRow[];
  favorite: string;
}

const KNOCKOUT: MatchStage[] = ['round32', 'round16', 'quarter', 'semi', 'final'];

function BracketMatch({
  match,
  teamMap,
  matchByNum,
  standings,
  favorite,
}: {
  match: Match;
  teamMap: Map<string, MatchTeam>;
  matchByNum: Map<number, Match>;
  standings: StandingRow[];
  favorite: string;
}) {
  const home = resolveSlot(match.homeLabel, matchByNum, standings, teamMap);
  const away = resolveSlot(match.awayLabel, matchByNum, standings, teamMap);
  const played = isPlayed(match);
  const homeWin = played && (match.homeScore as number) > (match.awayScore as number);
  const awayWin = played && (match.awayScore as number) > (match.homeScore as number);
  const favHere = Boolean(favorite) && (home.code === favorite || away.code === favorite);

  const side = (s: typeof home, score: number | null, win: boolean) => (
    <div className="flex items-center justify-between gap-2">
      <span
        className={`truncate ${win ? 'font-bold' : ''} ${
          s.pending ? 'italic text-slate-400' : ''
        } ${favorite && s.code === favorite ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
      >
        {s.label}
      </span>
      {score !== null && <span className="tabular-nums">{score}</span>}
    </div>
  );

  return (
    <div
      className={`w-44 rounded-lg border bg-white p-2 text-xs shadow-sm dark:bg-slate-900 ${
        favHere
          ? 'border-emerald-400 ring-1 ring-emerald-300 dark:border-emerald-600'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="mb-1 font-mono text-[10px] text-slate-400">#{match.num}</div>
      <div className="space-y-0.5">
        {side(home, match.homeScore, homeWin)}
        {side(away, match.awayScore, awayWin)}
      </div>
    </div>
  );
}

export function BracketView({ matches, teams, standings, favorite }: BracketViewProps) {
  const teamMap = useMemo(() => teamIndex(teams), [teams]);
  const matchByNum = useMemo(() => new Map(matches.map((m) => [m.num, m])), [matches]);
  const third = useMemo(() => matches.find((m) => m.stage === 'third'), [matches]);

  return (
    <div>
      <p className="mb-4 text-xs text-slate-400">
        Slots resolve automatically as group standings settle and knockout results are entered.
        Italic entries are still to be decided.
      </p>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KNOCKOUT.map((stage) => {
          const stageMatches = matches.filter((m) => m.stage === stage).sort((a, b) => a.num - b.num);
          return (
            <div key={stage} className="flex shrink-0 flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {STAGE_LABELS[stage]}
              </h3>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {stageMatches.map((m) => (
                  <BracketMatch
                    key={m.num}
                    match={m}
                    teamMap={teamMap}
                    matchByNum={matchByNum}
                    standings={standings}
                    favorite={favorite}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {third && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            {STAGE_LABELS.third}
          </h3>
          <BracketMatch
            match={third}
            teamMap={teamMap}
            matchByNum={matchByNum}
            standings={standings}
            favorite={favorite}
          />
        </div>
      )}
    </div>
  );
}
