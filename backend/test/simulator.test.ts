import { describe, expect, it } from 'vitest';
import { loadTournament } from '../src/db/seed-matches.ts';
import { runSimulation, simulateOnce } from '../src/services/simulator.ts';

const { matches, teams } = loadTournament();

describe('simulateOnce', () => {
  it('produces a champion and a fully resolved 32-match knockout bracket', () => {
    const sim = simulateOnce(matches, teams, 42);
    expect(sim.championCode).toBeTruthy();
    expect(teams.some((t) => t.code === sim.championCode)).toBe(true);
    expect(sim.bracket).toHaveLength(32); // R32 16 + R16 8 + QF 4 + SF 2 + 3rd 1 + final 1
    expect(sim.bracket.every((m) => m.homeCode && m.awayCode && m.winnerCode)).toBe(true);
    // The final (match 104) winner is the champion.
    expect(sim.bracket.find((m) => m.num === 104)?.winnerCode).toBe(sim.championCode);
    expect(sim.groups).toHaveLength(48);
  });

  it('is deterministic for a given seed', () => {
    expect(simulateOnce(matches, teams, 7).championCode).toBe(
      simulateOnce(matches, teams, 7).championCode,
    );
  });
});

describe('runSimulation', () => {
  it('returns calibrated per-team probabilities', () => {
    const probs = runSimulation(matches, teams, 3000);
    expect(probs).toHaveLength(48);

    // Exactly one champion per run → champion probs sum to ~1.
    const sumChampion = probs.reduce((s, t) => s + t.champion, 0);
    expect(sumChampion).toBeGreaterThan(0.98);
    expect(sumChampion).toBeLessThan(1.02);

    for (const t of probs) {
      for (const p of [t.advance, t.r16, t.quarter, t.semi, t.final, t.champion]) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
      // Monotonic: reaching a later round implies reaching the earlier ones.
      expect(t.advance).toBeGreaterThanOrEqual(t.r16);
      expect(t.r16).toBeGreaterThanOrEqual(t.quarter);
      expect(t.quarter).toBeGreaterThanOrEqual(t.semi);
      expect(t.semi).toBeGreaterThanOrEqual(t.final);
      expect(t.final).toBeGreaterThanOrEqual(t.champion);
    }

    // Sorted by champion probability (descending).
    for (let i = 1; i < probs.length; i++) {
      expect(probs[i - 1].champion).toBeGreaterThanOrEqual(probs[i].champion);
    }
  });
});
