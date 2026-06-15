import type { Sticker } from '../types.ts';
import { flagGradient, flagSheen, readableText } from '../lib/sections.ts';

interface StickerTileProps {
  sticker: Sticker;
  count: number;
  colors: { primary: string; secondary: string; flag?: string[] };
  onToggle: (code: string) => void;
  onAdjust: (code: string, delta: number) => void;
}

/**
 * One album slot. Owned stickers are "stuck in" — filled with a gradient of the
 * team's national flag (foil ones shimmer in those same colors); missing ones
 * are a dashed ghost, mirroring the empty spaces in a physical album.
 */
export function StickerTile({ sticker, count, colors, onToggle, onAdjust }: StickerTileProps) {
  const owned = count >= 1;
  const dupes = Math.max(0, count - 1);

  // Team stickers get a flag gradient (with a dark scrim so the player name
  // stays legible); non-team sections fall back to their two-color blend.
  const useFlag = Boolean(colors.flag && colors.flag.length > 1);
  const ownedBg = useFlag
    ? `linear-gradient(rgba(0,0,0,0.32), rgba(0,0,0,0.32)), ${flagGradient(colors.flag as string[], 160)}`
    : `linear-gradient(160deg, ${colors.primary}, ${colors.secondary})`;
  const text = useFlag ? '#ffffff' : readableText(colors.primary);
  const textShadow = useFlag ? '0 1px 2px rgba(0,0,0,0.55)' : undefined;

  return (
    <div
      className={`group relative flex aspect-[3/4] select-none flex-col rounded-lg p-2 text-center shadow-sm transition ${
        owned ? 'shadow-md' : 'slot-empty bg-slate-50 dark:bg-slate-900'
      }`}
      style={owned ? { background: ownedBg, color: text, textShadow } : undefined}
    >
      {/* Foil shimmer overlay — tinted with the flag's own colors. */}
      {owned && sticker.isFoil && (
        <div
          className="foil-sheen pointer-events-none absolute inset-0 rounded-lg"
          style={useFlag ? { backgroundImage: flagSheen(colors.flag as string[]) } : undefined}
        />
      )}

      {/* Click target toggles owned/missing */}
      <button
        type="button"
        onClick={() => onToggle(sticker.code)}
        className="flex flex-1 flex-col items-center justify-center gap-1 focus:outline-none"
        title={owned ? 'Mark as missing' : 'Mark as collected'}
      >
        <span
          className={`text-[10px] font-bold tracking-wider ${
            owned ? 'opacity-80' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {sticker.code}
        </span>

        {owned ? (
          <>
            <span className="line-clamp-2 text-xs font-semibold leading-tight">
              {sticker.playerName}
            </span>
            {sticker.position && (
              <span className="text-[9px] uppercase opacity-75">{sticker.position}</span>
            )}
            {sticker.club && (
              <span className="line-clamp-1 text-[9px] opacity-65">{sticker.club}</span>
            )}
          </>
        ) : (
          <>
            {/* Empty slot still names who belongs here, like a real album. */}
            <span className="line-clamp-2 text-xs font-medium leading-tight text-slate-400 dark:text-slate-500">
              {sticker.playerName}
            </span>
            {sticker.position && (
              <span className="text-[9px] uppercase text-slate-300 dark:text-slate-600">
                {sticker.position}
              </span>
            )}
            <span className="mt-0.5 text-lg font-light leading-none text-slate-300 dark:text-slate-700">
              +
            </span>
          </>
        )}
      </button>

      {/* Badges: number + unverified marker */}
      <span
        className={`absolute left-1 top-1 rounded px-1 text-[9px] font-bold ${
          owned ? 'bg-black/20' : 'bg-slate-200 text-slate-500 dark:bg-slate-800'
        }`}
      >
        {sticker.number}
      </span>
      {!sticker.verified && (
        <span
          className="absolute right-1 top-1 text-[9px] opacity-70"
          title="Name not yet verified — help complete the dataset!"
        >
          ?
        </span>
      )}

      {/* Duplicate controls (only when owned) */}
      {owned && (
        <div className="mt-1 flex items-center justify-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => onAdjust(sticker.code, -1)}
            className="h-5 w-5 rounded bg-black/20 leading-none hover:bg-black/30"
            aria-label="Remove one copy"
          >
            −
          </button>
          <span className="min-w-[2.5rem] font-semibold">
            {dupes > 0 ? `×${count}` : 'owned'}
          </span>
          <button
            type="button"
            onClick={() => onAdjust(sticker.code, 1)}
            className="h-5 w-5 rounded bg-black/20 leading-none hover:bg-black/30"
            aria-label="Add one duplicate"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
