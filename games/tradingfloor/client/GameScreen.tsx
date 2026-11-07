import { useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { agreementPending } from '../../../shared/houseRules.ts';
import { cornerOf, offerError } from '../cards.ts';
import { tradingfloorInfo } from '../info.ts';
import { corneredText } from './describeMove.ts';
import Hand from './Hand';
import { SummaryRows } from './HistoryBoard';
import OfferBoard from './OfferBoard';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

const ALREADY_TAKEN = 'Already taken';
const QUIET_MS = 3000;

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { activePlayers, playerNames, isGameOver, started, phase, summary, hand, offering, gameStatus } = gameState;
  const trading = activePlayers.includes(playerNumber) && activePlayers.length >= tradingfloorInfo.minPlayers && !isGameOver
    && phase === 'trading' && !(!started && agreementPending(tradingfloorInfo, gameState));
  const [picks, setPicks] = useState<number[]>([]);
  // Cards that left the hand in a swap are no longer picked
  const picked = picks.filter(id => hand.some(card => card.id === id));
  const pickError = offerError(hand, picked);
  const corner = cornerOf(hand);

  // A lost race to an offer is a quiet line for a few seconds, kept past the next state, which clears the error
  const [taken, setTaken] = useState(false);
  const takenTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (error !== ALREADY_TAKEN) return;
    setTaken(true);
    clearTimeout(takenTimer.current);
    takenTimer.current = setTimeout(() => setTaken(false), QUIET_MS);
  }, [error]);
  useEffect(() => () => clearTimeout(takenTimer.current), []);
  const loud = error !== null && error !== ALREADY_TAKEN;

  const toggle = (id: number) => setPicks(picked.includes(id) ? picked.filter(each => each !== id) : [...picked, id]);
  const offer = () => {
    gameService.sendAction({ type: 'offer', cards: picked });
    setPicks([]);
  };

  return (
    <div className="tf-layout tf-screen">
      <div className={loud ? 'game-status game-status-error' : 'game-status'} role="status">
        {loud ? error : taken ? ALREADY_TAKEN : gameStatus}
      </div>
      <OfferBoard gameState={gameState} viewer={playerNumber}
        onAccept={trading ? id => gameService.sendAction({ type: 'accept', offer: id }) : undefined} />
      <Hand cards={hand} label={`Your hand (${hand.length})`} offering={offering} picked={picked} onToggle={trading ? toggle : undefined} />
      {trading && <div className="tf-hint">{picked.length === 0 ? 'Pick 1 to 4 cards of one commodity to offer' : pickError ?? `Ready to offer ${picked.length}`}</div>}
      <div className="tf-bar">
        <button type="button" disabled={!trading || pickError !== null} onClick={offer}>{picked.length > 0 ? `Offer ${picked.length}` : 'Offer'}</button>
        <button type="button" disabled={!trading || offering.length === 0} onClick={() => gameService.sendAction({ type: 'withdraw' })}>Withdraw</button>
        <button type="button" className="tf-corner" disabled={!trading || corner === null} onClick={() => gameService.sendAction({ type: 'corner' })}>Corner!</button>
      </div>
      {phase === 'summary' && summary && !isGameOver && (
        <RoundSummaryDialog
          label="Round scoring"
          title={`Round ${summary.round} scoring`}
          gameState={gameState}
          result={corneredText(playerNames[summary.winner], summary.corner)}
          acknowledged={summary.acknowledged}
          playerNumber={playerNumber}
          onContinue={() => gameService.sendAction({ type: 'continue' })}
        >
          <SummaryRows summary={summary} gameState={gameState} viewer={playerNumber} />
        </RoundSummaryDialog>
      )}
    </div>
  );
}
