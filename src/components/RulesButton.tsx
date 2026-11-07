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

// The Rules dialog and what opens it, so the game menu can hold the button while the dialog lives outside the menu
// eslint-disable-next-line react-refresh/only-export-components -- the hook belongs with its button; fast refresh reloads this file in full
export function useRulesDialog(game: GameInfo, faq: FaqItem[], houseRules?: ReactNode, agreeNeeded = false): { open: () => void; dialog: ReactNode } {
  const [isOpen, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const dialog = isOpen && (
    // The game's own styles apply here, even on the landing page
    <div data-game={game.id}>
      <RulesDialog game={game} faq={faq} houseRules={houseRules} initialView={agreeNeeded ? 'houseRules' : 'rules'} onClose={close} />
    </div>
  );
  return { open: () => setOpen(true), dialog };
}

export function RulesTrigger({ agreeNeeded = false, onOpen }: { agreeNeeded?: boolean; onOpen: () => void }) {
  const noteId = useId();
  return (
    <>
      <button type="button" className="rules-button" data-attention={agreeNeeded ? '' : undefined}
        aria-describedby={agreeNeeded ? noteId : undefined} onClick={onOpen}>
        Rules
      </button>
      {/* Beside the button, not in it, so the button is still named just Rules; it is out of the header's flow */}
      {agreeNeeded && <span id={noteId} className="rules-attention">House rules need your agreement</span>}
    </>
  );
}

export default function RulesButton({ game, faq, houseRules, agreeNeeded = false }: RulesButtonProps) {
  const rules = useRulesDialog(game, faq, houseRules, agreeNeeded);
  return (
    <>
      <RulesTrigger agreeNeeded={agreeNeeded} onOpen={rules.open} />
      {rules.dialog}
    </>
  );
}
