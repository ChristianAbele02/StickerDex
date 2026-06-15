import type { CollectionMap, Sticker } from '../types.ts';
import { progressFor } from '../lib/stats.ts';
import { flagGradient, readableText } from '../lib/sections.ts';
import { ProgressBar } from './ProgressBar.tsx';
import { StickerTile } from './StickerTile.tsx';

interface AlbumPageProps {
  title: string;
  subtitle?: string;
  colors: { primary: string; secondary: string; flag?: string[] };
  stickers: Sticker[];
  collection: CollectionMap;
  highlight?: boolean;
  onToggle: (code: string) => void;
  onAdjust: (code: string, delta: number) => void;
}

/** A single album "page": colored header band + a grid of numbered slots. */
export function AlbumPage({
  title,
  subtitle,
  colors,
  stickers,
  collection,
  highlight,
  onToggle,
  onAdjust,
}: AlbumPageProps) {
  const progress = progressFor(stickers, collection);
  // Team pages get a national-flag gradient (with a subtle dark scrim so the
  // header text stays legible across white/yellow flag bands). Non-team
  // sections keep their simple two-color blend.
  const useFlag = Boolean(colors.flag && colors.flag.length > 1);
  const headerBg = useFlag
    ? `linear-gradient(rgba(0,0,0,0.30), rgba(0,0,0,0.30)), ${flagGradient(colors.flag as string[])}`
    : `linear-gradient(110deg, ${colors.primary}, ${colors.secondary})`;
  const text = useFlag ? '#ffffff' : readableText(colors.primary);
  const textShadow = useFlag ? '0 1px 2px rgba(0,0,0,0.55)' : undefined;

  if (stickers.length === 0) return null;

  return (
    <section
      className={`mb-8 overflow-hidden rounded-2xl bg-white shadow-md dark:bg-slate-900 ${
        highlight ? 'ring-2 ring-emerald-400 dark:ring-emerald-500' : ''
      }`}
    >
      <header
        className="flex items-center justify-between gap-4 px-5 py-4"
        style={{ background: headerBg, color: text, textShadow }}
      >
        <div>
          <h2 className="text-xl font-bold leading-tight">{title}</h2>
          {subtitle && <p className="text-xs uppercase tracking-wide opacity-80">{subtitle}</p>}
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold">
            {progress.owned}
            <span className="text-sm font-medium opacity-75">/{progress.total}</span>
          </div>
          <div className="text-xs opacity-80">{progress.completionPct}% complete</div>
        </div>
      </header>

      <div className="px-5 pb-3 pt-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {stickers.map((s) => (
            <StickerTile
              key={s.code}
              sticker={s}
              count={collection[s.code] ?? 0}
              colors={colors}
              onToggle={onToggle}
              onAdjust={onAdjust}
            />
          ))}
        </div>
      </div>

      <div className="px-5 pb-4">
        <ProgressBar pct={progress.completionPct} />
      </div>
    </section>
  );
}
