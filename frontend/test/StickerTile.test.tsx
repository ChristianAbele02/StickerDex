import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StickerTile } from '../src/components/StickerTile.tsx';
import type { Sticker } from '../src/types.ts';

const messi: Sticker = {
  code: 'ARG17',
  section: 'team',
  groupName: 'A',
  teamCode: 'ARG',
  teamName: 'Argentina',
  number: 17,
  type: 'player',
  playerName: 'Lionel Messi',
  position: 'Forward',
  club: 'Inter Miami',
  jersey: 10,
  caps: 199,
  goals: 117,
  isFoil: false,
  verified: true,
};

const colors = { primary: '#75aadb', secondary: '#ffffff' };

describe('StickerTile', () => {
  it('shows the player name when owned', () => {
    render(
      <StickerTile sticker={messi} count={1} colors={colors} onToggle={() => {}} onAdjust={() => {}} />,
    );
    expect(screen.getByText('Lionel Messi')).toBeInTheDocument();
    expect(screen.getByText('Forward')).toBeInTheDocument();
  });

  it('still names who belongs in an empty slot, with the code', () => {
    render(
      <StickerTile sticker={messi} count={0} colors={colors} onToggle={() => {}} onAdjust={() => {}} />,
    );
    // Empty slots now show the player name (dimmed) like a real album.
    expect(screen.getByText('Lionel Messi')).toBeInTheDocument();
    expect(screen.getByText('ARG17')).toBeInTheDocument();
    // ...but no duplicate controls until it's owned.
    expect(screen.queryByLabelText('Add one duplicate')).not.toBeInTheDocument();
  });

  it('calls onToggle when the tile is clicked', async () => {
    const onToggle = vi.fn();
    render(
      <StickerTile sticker={messi} count={0} colors={colors} onToggle={onToggle} onAdjust={() => {}} />,
    );
    await userEvent.click(screen.getByTitle('Mark as collected'));
    expect(onToggle).toHaveBeenCalledWith('ARG17');
  });

  it('shows duplicate count and adjusts copies', async () => {
    const onAdjust = vi.fn();
    render(
      <StickerTile sticker={messi} count={3} colors={colors} onToggle={() => {}} onAdjust={onAdjust} />,
    );
    expect(screen.getByText('×3')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Add one duplicate'));
    expect(onAdjust).toHaveBeenCalledWith('ARG17', 1);
  });
});
