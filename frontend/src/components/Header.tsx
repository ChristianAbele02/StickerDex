import type { MatchTeam, ProgressStats } from '../types.ts';
import { ProgressBar } from './ProgressBar.tsx';

export type View =
  | 'album'
  | 'teams'
  | 'stats'
  | 'missing'
  | 'duplicates'
  | 'schedule'
  | 'standings'
  | 'bracket'
  | 'predict'
  | 'settings';

interface HeaderProps {
  view: View;
  onView: (v: View) => void;
  overall: ProgressStats;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  matchTeams: MatchTeam[];
  favorite: string;
  onFavorite: (code: string) => void;
}

/** Tabs split into the album (collection) group and the tournament group. */
const ALBUM_TABS: { value: View; label: string }[] = [
  { value: 'album', label: 'Album' },
  { value: 'teams', label: 'Teams' },
  { value: 'stats', label: 'Stats' },
  { value: 'missing', label: 'Missing' },
  { value: 'duplicates', label: 'Duplicates' },
];
const TOURNAMENT_TABS: { value: View; label: string }[] = [
  { value: 'schedule', label: 'Schedule' },
  { value: 'standings', label: 'Standings' },
  { value: 'bracket', label: 'Bracket' },
  { value: 'predict', label: '🔮 Predict' },
];

function Tab({ tab, view, onView }: { tab: { value: View; label: string }; view: View; onView: (v: View) => void }) {
  return (
    <button
      type="button"
      onClick={() => onView(tab.value)}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
        view === tab.value
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {tab.label}
    </button>
  );
}

export function Header({
  view,
  onView,
  overall,
  theme,
  onToggleTheme,
  matchTeams,
  favorite,
  onFavorite,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">StickerDex</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                World Cup 2026 Companion
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={favorite}
              onChange={(e) => onFavorite(e.target.value)}
              className="hidden max-w-[10rem] rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 sm:block"
              title="Pick your favorite team to highlight it everywhere"
              aria-label="Favorite team"
            >
              <option value="">★ Favorite team…</option>
              {matchTeams.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="hidden w-40 sm:block">
              <ProgressBar
                pct={overall.completionPct}
                label={`${overall.owned}/${overall.total}`}
              />
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {ALBUM_TABS.map((t) => (
            <Tab key={t.value} tab={t} view={view} onView={onView} />
          ))}
          <span className="mx-1 hidden h-5 w-px bg-slate-300 dark:bg-slate-700 sm:inline-block" />
          {TOURNAMENT_TABS.map((t) => (
            <Tab key={t.value} tab={t} view={view} onView={onView} />
          ))}
          <span className="mx-1 hidden h-5 w-px bg-slate-300 dark:bg-slate-700 sm:inline-block" />
          <Tab tab={{ value: 'settings', label: '⚙️' }} view={view} onView={onView} />
        </nav>
      </div>
    </header>
  );
}
