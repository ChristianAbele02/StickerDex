/**
 * Loads the catalog + collection once and exposes optimistic mutation helpers.
 * The collection map is the single source of truth the whole UI renders from.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.ts';
import type { CollectionMap, Sticker, Team } from '../types.ts';

export interface StickerDexState {
  loading: boolean;
  error: string | null;
  stickers: Sticker[];
  teams: Team[];
  collection: CollectionMap;
  setCount: (code: string, count: number) => void;
  toggle: (code: string) => void;
  adjust: (code: string, delta: number) => void;
}

export function useStickerDex(): StickerDexState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [collection, setCollection] = useState<CollectionMap>({});

  // Mirror the latest collection so adjust/toggle can read counts synchronously.
  const collectionRef = useRef<CollectionMap>({});
  collectionRef.current = collection;

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getStickers(), api.getTeams(), api.getCollection()])
      .then(([s, t, c]) => {
        if (cancelled) return;
        setStickers(s);
        setTeams(t);
        setCollection(c);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  /** Optimistically write an absolute count, rolling back on server error. */
  const setCount = useCallback((code: string, count: number) => {
    const safe = Math.max(0, Math.floor(count));
    const previous = collectionRef.current[code] ?? 0;
    if (safe === previous) return;

    setCollection((prev) => ({ ...prev, [code]: safe }));
    api.patchSticker(code, 'set', safe).catch(() => {
      setCollection((prev) => ({ ...prev, [code]: previous }));
    });
  }, []);

  const adjust = useCallback(
    (code: string, delta: number) => {
      setCount(code, (collectionRef.current[code] ?? 0) + delta);
    },
    [setCount],
  );

  const toggle = useCallback(
    (code: string) => {
      setCount(code, (collectionRef.current[code] ?? 0) >= 1 ? 0 : 1);
    },
    [setCount],
  );

  return { loading, error, stickers, teams, collection, setCount, toggle, adjust };
}
