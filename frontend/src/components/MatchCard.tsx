import { useState } from 'react';
import type { Match, MatchPrediction, MatchTeam, StandingRow } from '../types.ts';
import {
  formatDateHeading,
  formatLocalTime,
  isPlayed,
  predictionPercents,
  resolveSlot,
  type ResolvedSlot,
} from '../lib/tournament.ts';

interface MatchCardProps {
  match: Match;
  teams: Map<string, MatchTeam>;
  matchByNum: Map<number, Match>;
  standings: StandingRow[];
  prediction?: MatchPrediction;
  favorite: string;
  showDate?: boolean;
  onSetResult: (num: number, home: number, away: number) => void;
  onClearResult: (num: number) => void;
}

function TeamRow({
  slot,
  colors,
  score,
  winner,
  favorite,
}: {
  slot: ResolvedSlot;
  colors?: { primary: string; secondary: string };
  score: number | null;
  winner: boolean;
  favorite: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
          style={{
            background: colors
              ? `linear-gradient(135deg, ${colors.primary} 50%, ${colors.secondary} 50%)`
              : '#cbd5e1',
          }}
        />
        <span
          className={`truncate text-sm ${winner ? 'font-bold' : 'font-medium'} ${
            slot.pending ? 'italic text-slate-400' : ''
          } ${favorite ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
        >
          {slot.label}
          {favorite && ' ★'}
        </span>
      </div>
      {score !== null && (
        <span className={`tabular-nums text-sm ${winner ? 'font-extrabold' : 'font-semibold'}`}>
          {score}
        </span>
      )}
    </div>
  );
}

export function MatchCard({
  match,
  teams,
  matchByNum,
  standings,
  prediction,
  favorite,
  showDate,
  onSetResult,
  onClearResult,
}: MatchCardProps) {
  const home = resolveSlot(match.homeLabel, matchByNum, standings, teams);
  const away = resolveSlot(match.awayLabel, matchByNum, standings, teams);
  const played = isPlayed(match);
  const [editing, setEditing] = useState(false);
  const [h, setH] = useState(String(match.homeScore ?? 0));
  const [a, setA] = useState(String(match.awayScore ?? 0));

  const homeColors = home.code ? teams.get(home.code)?.colors : undefined;
  const awayColors = away.code ? teams.get(away.code)?.colors : undefined;
  const homeWin = played && (match.homeScore as number) > (match.awayScore as number);
  const awayWin = played && (match.awayScore as number) > (match.homeScore as number);
  const favHome = Boolean(favorite) && home.code === favorite;
  const favAway = Boolean(favorite) && away.code === favorite;
  const isFav = favHome || favAway;

  function save() {
    onSetResult(match.num, Math.max(0, Number(h) || 0), Math.max(0, Number(a) || 0));
    setEditing(false);
  }
  function clear() {
    onClearResult(match.num);
    setEditing(false);
  }

  const pct = prediction ? predictionPercents(prediction) : null;

  return (
    <div
      className={`rounded-xl border bg-white p-3 shadow-sm transition dark:bg-slate-900 ${
        isFav
          ? 'border-emerald-400 ring-1 ring-emerald-300 dark:border-emerald-600'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-mono">#{match.num}</span>
        <span className="truncate px-2 text-center">
          {match.venueCity}
          {' · '}
          {match.localTime} {match.timezone}
        </span>
        <span>
          {showDate && `${formatDateHeading(match.kickoff)} · `}
          {formatLocalTime(match.kickoff)}
        </span>
      </div>

      <div className="space-y-1">
        <TeamRow
          slot={home}
          colors={homeColors}
          score={match.homeScore}
          winner={homeWin}
          favorite={favHome}
        />
        <TeamRow
          slot={away}
          colors={awayColors}
          score={match.awayScore}
          winner={awayWin}
          favorite={favAway}
        />
      </div>

      {/* Prediction bar for upcoming fixtures with two known teams. */}
      {!played && pct && (
        <div className="mt-2">
          <div className="flex h-2 overflow-hidden rounded-full">
            <div className="bg-emerald-500" style={{ width: `${pct.home}%` }} title={`${home.label} win`} />
            <div className="bg-slate-300 dark:bg-slate-600" style={{ width: `${pct.draw}%` }} title="Draw" />
            <div className="bg-sky-500" style={{ width: `${pct.away}%` }} title={`${away.label} win`} />
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
            <span>{pct.home}%</span>
            <span>draw {pct.draw}%</span>
            <span>{pct.away}%</span>
          </div>
        </div>
      )}

      {/* Result editor */}
      <div className="mt-2 flex items-center justify-end gap-2 text-xs">
        {editing ? (
          <>
            <input
              type="number"
              min={0}
              value={h}
              onChange={(e) => setH(e.target.value)}
              className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center dark:border-slate-700 dark:bg-slate-800"
              aria-label="Home score"
            />
            <span className="text-slate-400">–</span>
            <input
              type="number"
              min={0}
              value={a}
              onChange={(e) => setA(e.target.value)}
              className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center dark:border-slate-700 dark:bg-slate-800"
              aria-label="Away score"
            />
            <button
              type="button"
              onClick={save}
              className="rounded bg-emerald-600 px-2 py-0.5 font-semibold text-white hover:bg-emerald-700"
            >
              Save
            </button>
            {played && (
              <button type="button" onClick={clear} className="text-slate-400 hover:text-red-500">
                Clear
              </button>
            )}
            <button type="button" onClick={() => setEditing(false)} className="text-slate-400">
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setH(String(match.homeScore ?? 0));
              setA(String(match.awayScore ?? 0));
              setEditing(true);
            }}
            className="rounded border border-slate-300 px-2 py-0.5 font-semibold text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {played ? 'Edit result' : 'Enter result'}
          </button>
        )}
      </div>
    </div>
  );
}
