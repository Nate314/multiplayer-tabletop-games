import { useCallback, useState } from 'react';
import HouseRulesDialog from './HouseRulesDialog';
import { houseRulesOf, needsAgreement } from '../../shared/houseRules.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState } from '../../shared/types.ts';

type HouseRulesButtonProps = {
  game: GameInfo;
  gameState: BasePublicState;
};

export default function HouseRulesButton({ game, gameState }: HouseRulesButtonProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!needsAgreement(game)) return null;

  return (
    <>
      <button type="button" className="house-rules-button" onClick={() => setOpen(true)}>House rules</button>
      {open && <HouseRulesDialog game={game} rules={houseRulesOf(game, gameState)} onClose={close} />}
    </>
  );
}
