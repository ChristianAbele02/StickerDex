/**
 * Export helpers: turn the catalog + collection into shareable CSV/JSON,
 * optionally filtered to missing / owned / duplicate stickers.
 */
import type { CollectionMap, Sticker } from '../types.ts';

export type ExportFilter = 'all' | 'missing' | 'owned' | 'dupes';

export interface ExportRow {
  code: string;
  team: string;
  group: string | null;
  number: number;
  player: string;
  type: string;
  /** Total copies owned (0 = missing, 1 = owned, >1 = has duplicates). */
  count: number;
  /** Spare copies available to swap (count - 1, never negative). */
  spare: number;
}

export function buildRows(
  catalog: Sticker[],
  collection: CollectionMap,
  filter: ExportFilter,
): ExportRow[] {
  return catalog
    .filter((s) => {
      const count = collection[s.code] ?? 0;
      switch (filter) {
        case 'missing':
          return count === 0;
        case 'owned':
          return count >= 1;
        case 'dupes':
          return count > 1;
        default:
          return true;
      }
    })
    .map((s) => {
      const count = collection[s.code] ?? 0;
      return {
        code: s.code,
        team: s.teamName,
        group: s.groupName,
        number: s.number,
        player: s.playerName,
        type: s.type,
        count,
        spare: Math.max(0, count - 1),
      };
    });
}

function csvEscape(value: string | number | null): string {
  const str = value === null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(rows: ExportRow[]): string {
  const header = ['code', 'team', 'group', 'number', 'player', 'type', 'count', 'spare'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [r.code, r.team, r.group, r.number, r.player, r.type, r.count, r.spare]
        .map(csvEscape)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}
