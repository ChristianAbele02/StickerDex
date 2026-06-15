/**
 * Loads the tournament data (matches, teams, venues) and derives standings +
 * Elo predictions from the backend. Entering a result optimistically updates
 * the local match list, then refetches standings + predictions so the table
 * and probabilities stay in sync with the new score.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.ts';
import type { Match, MatchPrediction, MatchTeam, MatchVenue, StandingRow } from '../types.ts';

export interface TournamentState {
  loading: boolean;
  error: string | null;
  matches: Match[];
  teams: MatchTeam[];
  venues: MatchVenue[];
  standings: StandingRow[];
  predictions: Record<number, MatchPrediction>;
  setResult: (num: number, home: number, away: number) => void;
  clearResult: (num: number) => void;
}

function indexPredictions(list: MatchPrediction[]): Record<number, MatchPrediction> {
  const map: Record<number, MatchPrediction> = {};
  for (const p of list) map[p.num] = p;
  return map;
}

export function useTournament(): TournamentState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<MatchTeam[]>([]);
  const [venues, setVenues] = useState<MatchVenue[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [predictions, setPredictions] = useState<Record<number, MatchPrediction>>({});

  const matchesRef = useRef<Match[]>([]);
  matchesRef.current = matches;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getMatches(),
      api.getMatchTeams(),
      api.getVenues(),
      api.getStandings(),
      api.getPredictions(),
    ])
      .then(([m, t, v, s, p]) => {
        if (cancelled) return;
        setMatches(m);
        setTeams(t);
        setVenues(v);
        setStandings(s);
        setPredictions(indexPredictions(p));
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  /** Refresh the derived data (standings + predictions) after a score change. */
  const refreshDerived = useCallback(() => {
    Promise.all([api.getStandings(), api.getPredictions()])
      .then(([s, p]) => {
        setStandings(s);
        setPredictions(indexPredictions(p));
      })
      .catch(() => {
        /* derived data is best-effort; ignore transient errors */
      });
  }, []);

  const applyScore = useCallback((num: number, home: number | null, away: number | null) => {
    setMatches((prev) =>
      prev.map((m) => (m.num === num ? { ...m, homeScore: home, awayScore: away } : m)),
    );
  }, []);

  const setResult = useCallback(
    (num: number, home: number, away: number) => {
      const prev = matchesRef.current.find((m) => m.num === num);
      applyScore(num, home, away);
      api
        .setResult(num, home, away)
        .then(refreshDerived)
        .catch(() => prev && applyScore(num, prev.homeScore, prev.awayScore));
    },
    [applyScore, refreshDerived],
  );

  const clearResult = useCallback(
    (num: number) => {
      const prev = matchesRef.current.find((m) => m.num === num);
      applyScore(num, null, null);
      api
        .clearResult(num)
        .then(refreshDerived)
        .catch(() => prev && applyScore(num, prev.homeScore, prev.awayScore));
    },
    [applyScore, refreshDerived],
  );

  return {
    loading,
    error,
    matches,
    teams,
    venues,
    standings,
    predictions,
    setResult,
    clearResult,
  };
}
