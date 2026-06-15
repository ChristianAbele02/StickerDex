export type OwnershipFilter = 'all' | 'missing' | 'owned' | 'dupes' | 'foils';

interface SearchFilterBarProps {
  query: string;
  onQuery: (q: string) => void;
  filter: OwnershipFilter;
  onFilter: (f: OwnershipFilter) => void;
}

const FILTERS: { value: OwnershipFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'missing', label: 'Missing' },
  { value: 'owned', label: 'Owned' },
  { value: 'dupes', label: 'Duplicates' },
  { value: 'foils', label: 'Foils' },
];

export function SearchFilterBar({ query, onQuery, filter, onFilter }: SearchFilterBarProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search by code (ARG17) or player name…"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 sm:max-w-sm"
      />
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filter === f.value
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
