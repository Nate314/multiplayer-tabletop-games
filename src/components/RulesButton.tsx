import { useCallback, useState } from 'react';
import RulesDialog from './RulesDialog';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { FaqItem } from '../clientGames.ts';

type RulesButtonProps = {
  game: GameInfo;
  faq: FaqItem[];
};

export default function RulesButton({ game, faq }: RulesButtonProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" className="rules-button" onClick={() => setOpen(true)}>
        Rules
      </button>
      {open && (
        // The game's own styles apply here, even on the landing page
        <div data-game={game.id}>
          <RulesDialog game={game} faq={faq} onClose={close} />
        </div>
      )}
    </>
  );
}
