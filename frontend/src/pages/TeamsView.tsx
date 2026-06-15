import { useEffect, useMemo, useState } from 'react';
import type { CollectionMap, Sticker, Team } from '../types.ts';
import type { TournamentState } from '../hooks/useTournament.ts';
import { flagGradient } from '../lib/sections.ts';
import { teamFacts, positionMeta } from '../lib/team.ts';
import { PlayerCard } from '../components/PlayerCard.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { resolveSlot, isPlayed, formatDateHeading, teamIndex } from '../lib/tournament.ts';

interface TeamsViewProps {
  stickers: Sticker[];
  teams: Team[];
  collection: CollectionMap;
  tournament: TournamentState;
  favorite: string;
  onToggle: (code: string) => void;
  onFavorite: (code: string) => void;
}

export function TeamsView({
  stickers,
  teams,
  collection,
  tournament,
  favorite,
  onToggle,
  onFavorite,
}: TeamsViewProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [sort, setSort] = useState<'group' | 'name' | 'completion'>('group');

  const byTeam = useMemo(() => {
    const map = new Map<string, Sticker[]>();
    for (const s of stickers) {
      if (s.section !== 'team' || !s.teamCode) continue;
      (map.get(s.teamCode) ?? map.set(s.teamCode, []).get(s.teamCode)!).push(s);
    }
    for (const list of map.values()) list.sort((a, b) => a.number - b.number);
    return map;
  }, [stickers]);

  const factsByTeam = useMemo(() => {
    const m = new Map<string, ReturnType<typeof teamFacts>>();
    for (const t of teams) m.set(t.teamCode, teamFacts(byTeam.get(t.teamCode) ?? [], collection));
    return m;
  }, [teams, byTeam, collection]);

  const groups = useMemo(
    () => [...new Set(teams.map((t) => t.groupName).filter(Boolean) as string[])].sort(),
    [teams],
  );

  const visibleTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = teams.filter(
      (t) =>
        (!groupFilter || t.groupName === groupFilter) &&
        (!q || t.teamName.toLowerCase().includes(q)),
    );
    const f = (c: string) => factsByTeam.get(c)?.completionPct ?? 0;
    list.sort((a, b) => {
      if (sort === 'name') return a.teamName.localeCompare(b.teamName);
      if (sort === 'completion') return f(b.teamCode) - f(a.teamCode);
      return (a.groupName ?? '').localeCompare(b.groupName ?? '') || a.teamName.localeCompare(b.teamName);
    });
    return list;
  }, [teams, query, groupFilter, sort, factsByTeam]);

  const selectedTeam = teams.find((t) => t.teamCode === selected) ?? null;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 sm:max-w-xs"
          />
          <label className="flex items-center gap-1.5 text-sm text-slate-500">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="group">Group</option>
              <option value="name">Name</option>
              <option value="completion">Completion</option>
            </select>
          </label>
          <span className="ml-auto text-xs text-slate-400">{visibleTeams.length} teams</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <GroupChip label="All" active={!groupFilter} onClick={() => setGroupFilter('')} />
          {groups.map((g) => (
            <GroupChip
              key={g}
              label={g}
              active={groupFilter === g}
              onClick={() => setGroupFilter(groupFilter === g ? '' : g)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visibleTeams.map((team) => {
          const facts = factsByTeam.get(team.teamCode)!;
          const fav = favorite === team.teamCode;
          return (
            <button
              key={team.teamCode}
              type="button"
              onClick={() => setSelected(team.teamCode)}
              className={`group overflow-hidden rounded-2xl text-left shadow-md transition hover:-translate-y-1 hover:shadow-xl ${
                fav ? 'ring-2 ring-emerald-400' : ''
              }`}
            >
              <div
                className="relative px-4 py-5"
                style={{
                  background: `linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.28)), ${flagGradient(team.colors.flag)}`,
                  color: '#fff',
                  textShadow: '0 1px 2px rgba(0,0,0,0.55)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    Group {team.groupName}
                  </span>
                  {fav && <span className="text-sm">★</span>}
                </div>
                <h3 className="mt-3 text-lg font-extrabold leading-tight">{team.teamName}</h3>
                <p className="text-[11px] opacity-80">
                  {facts.topScorer ? `★ ${facts.topScorer.playerName}` : `${facts.squadSize} players`}
                </p>
              </div>
              <div className="bg-white px-4 py-2 dark:bg-slate-900">
                <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                  <span>Collected</span>
                  <span className="font-semibold">
                    {facts.owned}/{facts.total}
                  </span>
                </div>
                <ProgressBar
                  pct={facts.completionPct}
                  height={6}
                  color={`linear-gradient(90deg, ${team.colors.primary}, ${team.colors.secondary})`}
                />
              </div>
            </button>
          );
        })}
      </div>

      {visibleTeams.length === 0 && (
        <p className="p-6 text-center text-sm text-slate-500">No teams match your filters.</p>
      )}

      {selectedTeam && (
        <TeamDetailModal
          team={selectedTeam}
          stickers={byTeam.get(selectedTeam.teamCode) ?? []}
          collection={collection}
          tournament={tournament}
          favorite={favorite}
          onToggle={onToggle}
          onFavorite={onFavorite}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function GroupChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? 'bg-emerald-600 text-white'
          : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {label === 'All' ? label : `Group ${label}`}
    </button>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
      <div className="truncate text-lg font-extrabold leading-tight">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      {sub && <div className="truncate text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

interface TeamDetailModalProps {
  team: Team;
  stickers: Sticker[];
  collection: CollectionMap;
  tournament: TournamentState;
  favorite: string;
  onToggle: (code: string) => void;
  onFavorite: (code: string) => void;
  onClose: () => void;
}

function TeamDetailModal({
  team,
  stickers,
  collection,
  tournament,
  favorite,
  onToggle,
  onFavorite,
  onClose,
}: TeamDetailModalProps) {
  const facts = useMemo(() => teamFacts(stickers, collection), [stickers, collection]);
  const [posFilter, setPosFilter] = useState<'All' | 'GK' | 'DEF' | 'MID' | 'FWD'>('All');

  const squad = useMemo(
    () =>
      posFilter === 'All'
        ? facts.players
        : facts.players.filter((p) => positionMeta(p.position).abbr === posFilter),
    [facts.players, posFilter],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Tournament context: current standing + next fixture for this team.
  const standing = tournament.standings.find((r) => r.code === team.teamCode);
  const nextMatch = useMemo(() => {
    const teamMap = teamIndex(tournament.teams);
    const matchByNum = new Map(tournament.matches.map((m) => [m.num, m]));
    const now = Date.now();
    const upcoming = tournament.matches
      .filter((m) => !isPlayed(m) && (m.homeCode === team.teamCode || m.awayCode === team.teamCode))
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
    if (!upcoming) return null;
    const oppLabel =
      upcoming.homeCode === team.teamCode ? upcoming.awayLabel : upcoming.homeLabel;
    const opp = resolveSlot(oppLabel, matchByNum, tournament.standings, teamMap);
    return { match: upcoming, opp: opp.label, now };
  }, [tournament, team.teamCode]);

  const fav = favorite === team.teamCode;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-6 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div
          className="relative px-6 py-6"
          style={{
            background: `linear-gradient(rgba(0,0,0,0.30), rgba(0,0,0,0.30)), ${flagGradient(team.colors.flag)}`,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.55)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm hover:bg-white/30"
            aria-label="Close"
          >
            ✕
          </button>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
            Group {team.groupName}
          </span>
          <h2 className="mt-2 text-3xl font-extrabold">{team.teamName}</h2>
          <div className="mt-1 flex items-center gap-3 text-sm opacity-90">
            <span>
              {facts.owned}/{facts.total} collected · {facts.completionPct}%
            </span>
            <button
              type="button"
              onClick={() => onFavorite(team.teamCode)}
              className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold hover:bg-white/30"
            >
              {fav ? '★ Favorite' : '☆ Set favorite'}
            </button>
          </div>
        </div>

        <div className="p-5">
          {/* Tournament context */}
          {(standing || nextMatch) && (
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-4 py-2 text-sm dark:bg-slate-800/50">
              {standing && (
                <span>
                  <span className="font-bold">#{standing.rank}</span> in group ·{' '}
                  <span className="font-semibold">{standing.points} pts</span>{' '}
                  <span className="text-slate-400">
                    ({standing.won}W {standing.drawn}D {standing.lost}L)
                  </span>
                </span>
              )}
              {nextMatch && (
                <span className="text-slate-500 dark:text-slate-400">
                  Next: <span className="font-semibold">vs {nextMatch.opp}</span> ·{' '}
                  {formatDateHeading(nextMatch.match.kickoff)}
                </span>
              )}
            </div>
          )}

          {/* Fun facts */}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Squad" value={`${facts.squadSize}`} sub={`${facts.clubCount} clubs`} />
            <Stat label="Total caps" value={`${facts.totalCaps}`} sub={`${facts.totalGoals} goals`} />
            <Stat
              label="Most capped"
              value={facts.mostCapped ? `${facts.mostCapped.caps}` : '—'}
              sub={facts.mostCapped?.playerName}
            />
            <Stat
              label="Top scorer"
              value={facts.topScorer ? `${facts.topScorer.goals}` : '—'}
              sub={facts.topScorer?.playerName}
            />
          </div>

          {/* Squad + position filter */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Squad ({squad.length})
            </h3>
            <div className="flex flex-wrap gap-1">
              {(['All', 'GK', 'DEF', 'MID', 'FWD'] as const).map((p) => {
                const count = p === 'All' ? facts.players.length : facts.byPosition[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPosFilter(p)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                      posFilter === p
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {p} {p !== 'All' && <span className="opacity-60">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {squad.map((p) => (
              <PlayerCard
                key={p.code}
                sticker={p}
                owned={(collection[p.code] ?? 0) > 0}
                flag={team.colors.flag}
                onToggle={onToggle}
              />
            ))}
          </div>
          {squad.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-500">No {posFilter} players.</p>
          )}
        </div>
      </div>
    </div>
  );
}
