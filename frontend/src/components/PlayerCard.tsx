import type { Sticker } from '../types.ts';
import { positionMeta } from '../lib/team.ts';
import { flagGradient } from '../lib/sections.ts';
import { FlagSvg, hasFlagSvg } from '../lib/flagSvg.tsx';

interface PlayerCardProps {
  sticker: Sticker;
  owned: boolean;
  flag: string[];
  onToggle: (code: string) => void;
}

/** A FUT-style player card: number, position, club and caps/goals facts. */
export function PlayerCard({ sticker, owned, flag, onToggle }: PlayerCardProps) {
  const pos = positionMeta(sticker.position);

  return (
    <button
      type="button"
      onClick={() => onToggle(sticker.code)}
      title={owned ? 'Collected — tap to remove' : 'Tap to mark collected'}
      className={`group relative overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${
        owned
          ? 'border-emerald-300 ring-1 ring-emerald-200 dark:border-emerald-700 dark:ring-emerald-900'
          : 'border-slate-200 opacity-75 grayscale-[35%] hover:opacity-100 hover:grayscale-0 dark:border-slate-800'
      }`}
    >
      {/* Flag accent strip — the real national flag where available. */}
      {sticker.teamCode && hasFlagSvg(sticker.teamCode) ? (
        <FlagSvg code={sticker.teamCode} cover className="h-3.5 w-full" />
      ) : (
        <div className="h-1.5 w-full" style={{ background: flagGradient(flag, 90) }} />
      )}

      <div className="p-3">
        <div className="flex items-start justify-between">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${pos.pill}`}>
            {pos.abbr}
          </span>
          <span className="font-mono text-2xl font-extrabold leading-none text-slate-200 dark:text-slate-700">
            {sticker.jersey ?? sticker.code.replace(/^[A-Z]+/, '')}
          </span>
        </div>

        <div className="mt-1.5 line-clamp-2 text-sm font-bold leading-tight">
          {sticker.playerName}
        </div>
        <div className="line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
          {sticker.club ?? '—'}
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold dark:bg-slate-800">
            {sticker.caps ?? '–'} caps
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold dark:bg-slate-800">
            {sticker.goals ?? '–'} ⚽
          </span>
        </div>
      </div>

      {/* Owned check / code badge */}
      <span className="absolute right-1.5 top-2 font-mono text-[9px] font-bold text-white/80 drop-shadow">
        {sticker.code}
      </span>
      {owned && (
        <span className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white shadow">
          ✓
        </span>
      )}
    </button>
  );
}
