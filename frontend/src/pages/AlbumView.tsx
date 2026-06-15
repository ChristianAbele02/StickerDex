import { useMemo } from 'react';
import type { CollectionMap, Section, Sticker, Team } from '../types.ts';
import { AlbumPage } from '../components/AlbumPage.tsx';
import type { OwnershipFilter } from '../components/SearchFilterBar.tsx';
import { SECTION_LABELS } from '../lib/sections.ts';

interface AlbumViewProps {
  stickers: Sticker[];
  teams: Team[];
  collection: CollectionMap;
  query: string;
  filter: OwnershipFilter;
  groupFilter: string;
  favorite: string;
  onToggle: (code: string) => void;
  onAdjust: (code: string, delta: number) => void;
}

const SECTION_COLORS: Record<Section, { primary: string; secondary: string }> = {
  intro: { primary: '#0a3161', secondary: '#b31942' },
  museum: { primary: '#b8860b', secondary: '#1f2937' },
  team: { primary: '#334155', secondary: '#0f172a' },
  coca_cola: { primary: '#e61a27', secondary: '#7a0c12' },
};

function matchesFilter(s: Sticker, count: number, filter: OwnershipFilter): boolean {
  switch (filter) {
    case 'missing':
      return count === 0;
    case 'owned':
      return count >= 1;
    case 'dupes':
      return count > 1;
    case 'foils':
      return s.isFoil;
    default:
      return true;
  }
}

export function AlbumView({
  stickers,
  teams,
  collection,
  query,
  filter,
  groupFilter,
  favorite,
  onToggle,
  onAdjust,
}: AlbumViewProps) {
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stickers.filter((s) => {
      const count = collection[s.code] ?? 0;
      if (!matchesFilter(s, count, filter)) return false;
      if (q && !s.code.toLowerCase().includes(q) && !s.playerName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [stickers, collection, query, filter]);

  const byTeam = useMemo(() => {
    const map = new Map<string, Sticker[]>();
    for (const s of visible) {
      if (s.section !== 'team' || !s.teamCode) continue;
      const list = map.get(s.teamCode) ?? [];
      list.push(s);
      map.set(s.teamCode, list);
    }
    return map;
  }, [visible]);

  const sectionStickers = (section: Section) => visible.filter((s) => s.section === section);

  const orderedTeams = teams.filter((t) => !groupFilter || t.groupName === groupFilter);

  return (
    <div>
      <AlbumPage
        title={SECTION_LABELS.intro}
        colors={SECTION_COLORS.intro}
        stickers={sectionStickers('intro')}
        collection={collection}
        onToggle={onToggle}
        onAdjust={onAdjust}
      />
      <AlbumPage
        title={SECTION_LABELS.museum}
        subtitle="Past World Cup Champions"
        colors={SECTION_COLORS.museum}
        stickers={sectionStickers('museum')}
        collection={collection}
        onToggle={onToggle}
        onAdjust={onAdjust}
      />

      {orderedTeams.map((team) => (
        <AlbumPage
          key={team.teamCode}
          title={team.teamName}
          subtitle={team.groupName ? `Group ${team.groupName}` : undefined}
          colors={team.colors}
          stickers={byTeam.get(team.teamCode) ?? []}
          collection={collection}
          highlight={favorite === team.teamCode}
          onToggle={onToggle}
          onAdjust={onAdjust}
        />
      ))}

      {!groupFilter && (
        <AlbumPage
          title={SECTION_LABELS.coca_cola}
          colors={SECTION_COLORS.coca_cola}
          stickers={sectionStickers('coca_cola')}
          collection={collection}
          onToggle={onToggle}
          onAdjust={onAdjust}
        />
      )}
    </div>
  );
}
