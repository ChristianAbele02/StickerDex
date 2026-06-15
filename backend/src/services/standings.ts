/**
 * Computes group standings from entered results. Only group-stage matches with
 * both teams known and a result are counted. Ranking uses the standard order:
 * points, then goal difference, then goals for, then name (a documented
 * simplification of FIFA's full head-to-head tiebreakers).
 */
import type { Match, MatchTeam, StandingRow } from '../types.ts';

type Mutable = Omit<StandingRow, 'goalDiff' | 'rank'>;

export function computeStandings(teams: MatchTeam[], matches: Match[]): StandingRow[] {
  const table = new Map<string, Mutable>();
  for (const t of teams) {
    if (!t.group) continue;
    table.set(t.code, {
      code: t.code,
      name: t.name,
      group: t.group,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    if (m.stage !== 'group' || m.homeScore === null || m.awayScore === null) continue;
    if (!m.homeCode || !m.awayCode) continue;
    const home = table.get(m.homeCode);
    const away = table.get(m.awayCode);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (m.homeScore < m.awayScore) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }

  const rows: StandingRow[] = [...table.values()].map((r) => ({
    ...r,
    goalDiff: r.goalsFor - r.goalsAgainst,
    rank: 0,
  }));

  // Sort within each group and assign 1-based ranks.
  rows.sort(
    (a, b) =>
      a.group.localeCompare(b.group) ||
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.name.localeCompare(b.name),
  );

  let lastGroup = '';
  let rank = 0;
  for (const row of rows) {
    if (row.group !== lastGroup) {
      lastGroup = row.group;
      rank = 0;
    }
    row.rank = ++rank;
  }
  return rows;
}
