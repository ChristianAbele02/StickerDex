import { useCallback, useEffect, useState } from 'react';

const KEY = 'stickerdex-favorite';

/**
 * Persists the user's favorite team code (FIFA code, e.g. "ARG") so it can be
 * highlighted across fixtures, standings and the album. Empty string = none.
 */
export function useFavorite(): [string, (code: string) => void] {
  const [favorite, setFavorite] = useState<string>(() => localStorage.getItem(KEY) ?? '');

  useEffect(() => {
    if (favorite) localStorage.setItem(KEY, favorite);
    else localStorage.removeItem(KEY);
  }, [favorite]);

  const choose = useCallback((code: string) => {
    setFavorite((cur) => (cur === code ? '' : code));
  }, []);

  return [favorite, choose];
}
