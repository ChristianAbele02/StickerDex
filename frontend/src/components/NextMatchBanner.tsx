import { useEffect, useMemo, useState } from 'react';
import type { Match, MatchTeam, StandingRow } from '../types.ts';
import { isPlayed, resolveSlot, teamIndex } from '../lib/tournament.ts';

interface NextMatchBannerProps {
  matches: Match[];
  teams: MatchTeam[];
  standings: StandingRow[];
  favorite: string;
}

function countdown(target: number, now: number): string {
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function NextMatchBanner({ matches, teams, standings, favorite }: NextMatchBannerProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const teamMap = useMemo(() => teamIndex(teams), [teams]);
  const matchByNum = useMemo(() => new Map(matches.map((m) => [m.num, m])), [matches]);

  // Next upcoming kickoff (favorite's next match takes priority if set).
  const next = useMemo(() => {
    const upcoming = matches
      .filter((m) => !isPlayed(m) && new Date(m.kickoff).getTime() >= now - 2 * 3600000)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    if (favorite) {
      const fav = upcoming.find((m) => m.homeCode === favorite || m.awayCode === favorite);
      if (fav) return fav;
    }
    return upcoming[0];
  }, [matches, now, favorite]);

  if (!next) return null;

  const home = resolveSlot(next.homeLabel, matchByNum, standings, teamMap);
  const away = resolveSlot(next.awayLabel, matchByNum, standings, teamMap);
  const kickoff = new Date(next.kickoff).getTime();
  const live = now >= kickoff;
  const isFav = favorite && (next.homeCode === favorite || next.awayCode === favorite);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-3 text-white dark:from-slate-800 dark:to-slate-950">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
          {live ? '● Kick-off' : isFav ? 'Your team next' : 'Next match'}
        </span>
        <span className="text-sm font-semibold">
          {home.label} <span className="opacity-60">vs</span> {away.label}
        </span>
        <span className="hidden text-xs opacity-70 sm:inline">
          {next.venueCity} · {next.localTime} {next.timezone}
        </span>
      </div>
      <div className="text-right">
        <div className="font-mono text-lg font-bold tabular-nums">
          {live ? 'LIVE / awaiting result' : countdown(kickoff, now)}
        </div>
        <div className="text-[10px] opacity-70">
          {new Date(next.kickoff).toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}{' '}
          your time
        </div>
      </div>
    </div>
  );
}
