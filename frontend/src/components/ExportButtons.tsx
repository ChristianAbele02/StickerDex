import { api } from '../api/client.ts';

interface ExportButtonsProps {
  /** Which slice of the catalog to export (missing / dupes / owned / all). */
  filter: 'all' | 'missing' | 'owned' | 'dupes';
}

/** A CSV + JSON download pair that links straight at the export endpoint. */
export function ExportButtons({ filter }: ExportButtonsProps) {
  return (
    <div className="flex gap-2">
      <a
        href={api.exportUrl('csv', filter)}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Export CSV
      </a>
      <a
        href={api.exportUrl('json', filter)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold dark:border-slate-700"
      >
        Export JSON
      </a>
    </div>
  );
}
