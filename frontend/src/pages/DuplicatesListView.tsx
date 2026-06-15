import { useMemo } from 'react';
import type { CollectionMap, Sticker } from '../types.ts';
import { ExportButtons } from '../components/ExportButtons.tsx';

interface DuplicatesListViewProps {
  stickers: Sticker[];
  collection: CollectionMap;
}

/**
 * The swap list: every sticker you own more than one of, with the number of
 * spare copies available to trade away. Exportable as CSV / JSON.
 */
export function DuplicatesListView({ stickers, collection }: DuplicatesListViewProps) {
  const dupes = useMemo(
    () =>
      stickers
        .map((s) => ({ s, count: collection[s.code] ?? 0 }))
        .filter(({ count }) => count > 1)
        .map(({ s, count }) => ({ s, count, spare: count - 1 }))
        .sort((a, b) => b.spare - a.spare),
    [stickers, collection],
  );

  const totalSpares = useMemo(() => dupes.reduce((sum, d) => sum + d.spare, 0), [dupes]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          <span className="font-bold text-slate-800 dark:text-slate-200">{totalSpares}</span> spare
          {totalSpares === 1 ? ' copy' : ' copies'} across{' '}
          <span className="font-bold text-slate-800 dark:text-slate-200">{dupes.length}</span>{' '}
          different stickers
        </p>
        <ExportButtons filter="dupes" />
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Player / Subject</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2 text-right">Owned</th>
              <th className="px-3 py-2 text-right">Spare</th>
            </tr>
          </thead>
          <tbody>
            {dupes.map(({ s, count, spare }) => (
              <tr key={s.code} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 font-mono text-xs">{s.code}</td>
                <td className="px-3 py-2">{s.playerName}</td>
                <td className="px-3 py-2 text-slate-500">{s.teamName}</td>
                <td className="px-3 py-2 text-slate-500">{s.groupName ?? '—'}</td>
                <td className="px-3 py-2 text-right text-slate-500">×{count}</td>
                <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                  ×{spare}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dupes.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">
            No duplicates yet — add extra copies from the album with the ＋ button on a sticker.
          </p>
        )}
      </div>
    </div>
  );
}
