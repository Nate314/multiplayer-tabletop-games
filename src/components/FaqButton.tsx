import { useCallback, useState } from 'react';
import FaqDialog from './FaqDialog';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { FaqItem } from '../clientGames.ts';

type FaqButtonProps = {
  game: GameInfo;
  items: FaqItem[];
};

export default function FaqButton({ game, items }: FaqButtonProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" className="faq-button" onClick={() => setOpen(true)}>
        FAQ
      </button>
      {open && (
        // The game's own styles apply here, even on the landing page
        <div data-game={game.id}>
          <FaqDialog title={`${game.name} FAQ`} items={items} onClose={close} />
        </div>
      )}
    </>
  );
}
