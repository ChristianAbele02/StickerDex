import { useCallback, useEffect, useState } from 'react';

/** Client-side preferences (persisted in localStorage). */
export interface Settings {
  /** Stickers per pack, used by the "packs needed" estimate. */
  stickersPerPack: number;
  /** Default number of Monte Carlo runs in the Predict tab. */
  defaultSimRuns: number;
}

const KEY = 'stickerdex-settings';
const DEFAULTS: Settings = { stickersPerPack: 7, defaultSimRuns: 10000 };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  return [settings, update];
}
