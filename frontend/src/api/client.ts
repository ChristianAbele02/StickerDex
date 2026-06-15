/** Thin fetch wrapper around the StickerDex REST API. */
import type {
  CollectionMap,
  Match,
  MatchPrediction,
  MatchTeam,
  MatchVenue,
  StandingRow,
  Sticker,
  Team,
} from '../types.ts';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getStickers: () => json<{ stickers: Sticker[] }>('/stickers').then((r) => r.stickers),
  getTeams: () => json<{ teams: Team[] }>('/teams').then((r) => r.teams),
  getCollection: () =>
    json<{ collection: CollectionMap }>('/collection').then((r) => r.collection),

  patchSticker: (code: string, op: 'increment' | 'decrement' | 'set', count?: number) =>
    json<{ code: string; count: number }>(`/collection/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      body: JSON.stringify({ op, count }),
    }),

  authStatus: () => json<{ required: boolean }>('/auth/status'),
  login: (password: string) =>
    json<{ ok: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  exportUrl: (format: 'csv' | 'json', filter: string) =>
    `${BASE}/export?format=${format}&filter=${filter}`,

  // --- Tournament ---
  getMatches: () => json<{ matches: Match[] }>('/matches').then((r) => r.matches),
  getVenues: () => json<{ venues: MatchVenue[] }>('/venues').then((r) => r.venues),
  getMatchTeams: () => json<{ teams: MatchTeam[] }>('/match-teams').then((r) => r.teams),
  getStandings: () => json<{ standings: StandingRow[] }>('/standings').then((r) => r.standings),
  getPredictions: () =>
    json<{ predictions: MatchPrediction[] }>('/predictions').then((r) => r.predictions),

  setResult: (num: number, homeScore: number, awayScore: number) =>
    json<{ num: number; homeScore: number; awayScore: number }>(`/matches/${num}/result`, {
      method: 'PUT',
      body: JSON.stringify({ homeScore, awayScore }),
    }),
  clearResult: (num: number) =>
    json<{ num: number; cleared: boolean }>(`/matches/${num}/result`, { method: 'DELETE' }),
};
