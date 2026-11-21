import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import ControlsDialog from './ControlsDialog';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { ControlItem } from '../clientGames.ts';

// The Controls dialog and what opens it, so the game menu can hold the button while the dialog lives outside the menu
// eslint-disable-next-line react-refresh/only-export-components -- the hook belongs with its button; fast refresh reloads this file in full
export function useControlsDialog(game: GameInfo, controls: ControlItem[]): { open: () => void; dialog: ReactNode } {
  const [isOpen, setOpen] = useState(false);
  // The menu closed itself before this opened, so focus goes back to its button
  const close = useCallback(() => {
    setOpen(false);
    document.querySelector<HTMLElement>('.game-menu-button')?.focus();
  }, []);
  const dialog = isOpen && (
    <div data-game={game.id}>
      <ControlsDialog game={game} controls={controls} onClose={close} />
    </div>
  );
  return { open: () => setOpen(true), dialog };
}

export function ControlsTrigger({ onOpen }: { onOpen: () => void }) {
  return <button type="button" className="controls-button" onClick={onOpen}>Controls</button>;
}
