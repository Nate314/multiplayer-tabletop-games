import { useCallback, useId, useState } from 'react';
import type { ReactNode } from 'react';
import RulesDialog from './RulesDialog';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { FaqItem } from '../clientGames.ts';

type RulesButtonProps = {
  game: GameInfo;
  faq: FaqItem[];
  houseRules?: ReactNode; // the House rules tab, on the game page only
  agreeNeeded?: boolean; // this device still has to agree, so the button is marked and opens on House rules
};

export default function RulesButton({ game, faq, houseRules, agreeNeeded = false }: RulesButtonProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const noteId = useId();

  return (
    <>
      <button type="button" className="rules-button" data-attention={agreeNeeded ? '' : undefined}
        aria-describedby={agreeNeeded ? noteId : undefined} onClick={() => setOpen(true)}>
        Rules
      </button>
      {/* Beside the button, not in it, so the button is still named just Rules; it is out of the header's flow */}
      {agreeNeeded && <span id={noteId} className="rules-attention">House rules need your agreement</span>}
      {open && (
        // The game's own styles apply here, even on the landing page
        <div data-game={game.id}>
          <RulesDialog game={game} faq={faq} houseRules={houseRules} initialView={agreeNeeded ? 'houseRules' : 'rules'} onClose={close} />
        </div>
      )}
    </>
  );
}
