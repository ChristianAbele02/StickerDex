import { useMemo, useState, type ReactNode } from 'react';
import { Header, type View } from './components/Header.tsx';
import { SearchFilterBar, type OwnershipFilter } from './components/SearchFilterBar.tsx';
import { NextMatchBanner } from './components/NextMatchBanner.tsx';
import { AlbumView } from './pages/AlbumView.tsx';
import { StatsView } from './pages/StatsView.tsx';
import { MissingListView } from './pages/MissingListView.tsx';
import { DuplicatesListView } from './pages/DuplicatesListView.tsx';
import { TeamsView } from './pages/TeamsView.tsx';
import { ScheduleView } from './pages/ScheduleView.tsx';
import { StandingsView } from './pages/StandingsView.tsx';
import { BracketView } from './pages/BracketView.tsx';
import { PredictView } from './pages/PredictView.tsx';
import { SettingsView } from './pages/SettingsView.tsx';
import { useStickerDex } from './hooks/useStickerDex.ts';
import { useTournament } from './hooks/useTournament.ts';
import { useTheme } from './hooks/useTheme.ts';
import { useFavorite } from './hooks/useFavorite.ts';
import { useSettings } from './hooks/useSettings.ts';
import { progressFor } from './lib/stats.ts';

export default function App() {
  const { loading, error, stickers, teams, collection, toggle, adjust } = useStickerDex();
  const tournament = useTournament();
  const [theme, toggleTheme] = useTheme();
  const [favorite, chooseFavorite] = useFavorite();
  const [settings, updateSettings] = useSettings();

  const [view, setView] = useState<View>('album');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<OwnershipFilter>('all');
  const [groupFilter, setGroupFilter] = useState('');

  const overall = useMemo(() => progressFor(stickers, collection), [stickers, collection]);
  const groups = useMemo(
    () => [...new Set(teams.map((t) => t.groupName).filter(Boolean))] as string[],
    [teams],
  );

  const showBanner =
    !tournament.loading &&
    !tournament.error &&
    (view === 'album' || view === 'schedule' || view === 'standings' || view === 'bracket');

  if (loading) {
    return <CenteredMessage>Loading your album…</CenteredMessage>;
  }
  if (error) {
    return (
      <CenteredMessage>
        <span className="text-red-500">Could not reach the API: {error}</span>
      </CenteredMessage>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        view={view}
        onView={setView}
        overall={overall}
        theme={theme}
        onToggleTheme={toggleTheme}
        matchTeams={tournament.teams}
        favorite={favorite}
        onFavorite={chooseFavorite}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        {showBanner && (
          <NextMatchBanner
            matches={tournament.matches}
            teams={tournament.teams}
            standings={tournament.standings}
            favorite={favorite}
          />
        )}

        {view === 'album' && (
          <>
            <SearchFilterBar
              query={query}
              onQuery={setQuery}
              filter={filter}
              onFilter={setFilter}
            />
            <div className="mb-6 flex items-center gap-2 text-sm">
              <label htmlFor="group" className="text-slate-500">
                Jump to group:
              </label>
              <select
                id="group"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">All sections</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    Group {g}
                  </option>
                ))}
              </select>
            </div>
            <AlbumView
              stickers={stickers}
              teams={teams}
              collection={collection}
              query={query}
              filter={filter}
              groupFilter={groupFilter}
              favorite={favorite}
              onToggle={toggle}
              onAdjust={adjust}
            />
          </>
        )}

        {view === 'teams' && (
          <TeamsView
            stickers={stickers}
            teams={teams}
            collection={collection}
            tournament={tournament}
            favorite={favorite}
            onToggle={toggle}
            onFavorite={chooseFavorite}
          />
        )}

        {view === 'stats' && (
          <StatsView
            stickers={stickers}
            teams={teams}
            collection={collection}
            stickersPerPack={settings.stickersPerPack}
          />
        )}

        {view === 'missing' && <MissingListView stickers={stickers} collection={collection} />}

        {view === 'duplicates' && (
          <DuplicatesListView stickers={stickers} collection={collection} />
        )}

        {view === 'schedule' && <TournamentGate t={tournament}>
          <ScheduleView tournament={tournament} favorite={favorite} />
        </TournamentGate>}

        {view === 'standings' && <TournamentGate t={tournament}>
          <StandingsView standings={tournament.standings} teams={tournament.teams} favorite={favorite} />
        </TournamentGate>}

        {view === 'bracket' && <TournamentGate t={tournament}>
          <BracketView
            matches={tournament.matches}
            teams={tournament.teams}
            standings={tournament.standings}
            favorite={favorite}
          />
        </TournamentGate>}

        {view === 'predict' && (
          <PredictView teams={teams} favorite={favorite} defaultRuns={settings.defaultSimRuns} />
        )}

        {view === 'settings' && (
          <SettingsView
            theme={theme}
            onToggleTheme={toggleTheme}
            settings={settings}
            onSettings={updateSettings}
            matchTeams={tournament.teams}
            favorite={favorite}
            onFavorite={chooseFavorite}
          />
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-slate-400">
        StickerDex · self-hosted & open source · not affiliated with Panini or FIFA · schedule data
        from openfootball (CC0)
      </footer>
    </div>
  );
}

function TournamentGate({
  t,
  children,
}: {
  t: { loading: boolean; error: string | null };
  children: ReactNode;
}) {
  if (t.loading) return <p className="p-6 text-center text-sm text-slate-500">Loading fixtures…</p>;
  if (t.error)
    return (
      <p className="p-6 text-center text-sm text-red-500">Could not load fixtures: {t.error}</p>
    );
  return <>{children}</>;
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      {children}
    </div>
  );
}
