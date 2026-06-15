import { useMemo } from 'react';
import type { CollectionMap, Sticker } from '../types.ts';
import { ExportButtons } from '../components/ExportButtons.tsx';

interface MissingListViewProps {
  stickers: Sticker[];
  collection: CollectionMap;
}

export function MissingListView({ stickers, collection }: MissingListViewProps) {
  const missing = useMemo(
    () => stickers.filter((s) => (collection[s.code] ?? 0) === 0),
    [stickers, collection],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          <span className="font-bold text-slate-800 dark:text-slate-200">{missing.length}</span>{' '}
          stickers still missing
        </p>
        <ExportButtons filter="missing" />
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Player / Subject</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Group</th>
            </tr>
          </thead>
          <tbody>
            {missing.map((s) => (
              <tr key={s.code} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 font-mono text-xs">{s.code}</td>
                <td className="px-3 py-2">{s.playerName}</td>
                <td className="px-3 py-2 text-slate-500">{s.teamName}</td>
                <td className="px-3 py-2 text-slate-500">{s.groupName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {missing.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">
            🎉 Album complete — nothing missing!
          </p>
        )}
      </div>
    </div>
  );
}
