import { useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import useNewlyDrawn from '../../../src/hooks/useNewlyDrawn.ts';
import { drawnStep } from './drawn.ts';
import Board from './Board';
import Hand from './Hand';
import PlayerArea from './PlayerArea';
import { seatOrder } from './seatOrder.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Card, PileIndex, PublicGameState, Source } from '../types.ts';

// The card a pick stands for, as this player sees the table
function pickedCard(state: PublicGameState, seat: number, source: Source | null): Card | null {
  if (source === null) return null;
  if (source.kind === 'hand') return state.myHand[source.index] ?? null;
  if (source.kind === 'stock') return state.stockTops[seat] ?? null;
  return state.discards[seat]?.[source.pile]?.at(-1) ?? null;
}

function turnMessage(state: PublicGameState, isMe: boolean): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver } = state;
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  const name = currentPlayer === null ? '' : playerNames[currentPlayer];
  if (!started) return `${name} goes first. Joining closes after the first move.`;
  return isMe ? 'Your turn' : `${name}'s turn`;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [picked, setPicked] = useState<Source | null>(null);
  // The discard pile chosen for the picked hand card, waiting for Discard here
  const [discardTarget, setDiscardTarget] = useState<PileIndex | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, myHand, moveCount, gameStatus } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const card = isMyTurn ? pickedCard(gameState, playerNumber, picked) : null;

  useMoveAnimation(screenRef, gameState, animateMove);
  const newlyDrawn = useNewlyDrawn(gameState, (previous, next) => drawnStep(previous, next, playerNumber));

  useEffect(() => {
    // Nothing stays picked across moves or undos
    setPicked(null);
    setDiscardTarget(null);
  }, [moveCount]);

  // A new pick starts the discard choice again
  const toggle = (source: Source) => {
    setDiscardTarget(null);
    setPicked(current => (JSON.stringify(current) === JSON.stringify(source) ? null : source));
  };
  const play = (to: PileIndex) => {
    if (picked) gameService.makeMove({ type: 'play', from: picked, to });
  };
  const discard = (pile: PileIndex) => {
    if (picked?.kind === 'hand') gameService.makeMove({ type: 'discard', handIndex: picked.index, pile });
  };

  let hint = '';
  if (isMyTurn && myHand.length === 0) hint = 'No cards to draw: play from your stock or discard piles, then End turn';
  else if (isMyTurn && picked?.kind === 'hand' && discardTarget !== null) hint = `Click Discard here to put it on discard pile ${discardTarget + 1} and end your turn`;
  else if (isMyTurn && picked?.kind === 'hand') hint = 'Click a highlighted building pile to play it, or choose a discard pile to end your turn';
  else if (isMyTurn && card) hint = 'Click a highlighted building pile to play it';
  else if (isMyTurn) hint = 'Pick a card from your stock, hand or discard piles';

  const others = seatOrder(activePlayers, playerNumber).filter(seat => seat !== playerNumber);
  const seated = activePlayers.includes(playerNumber);

  return (
    <div ref={screenRef} className="skipbo-screen">
      <div className="game-screen">
        <div className="game-info">
          <div className="player-info">You are {gameState.playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="turn-message">{turnMessage(gameState, isMyTurn)}</div>
          <div className="hint">{hint}</div>
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
            {isMyTurn && myHand.length === 0 && (
              <button type="button" onClick={() => gameService.makeMove({ type: 'endTurn' })}>End turn</button>
            )}
            {picked && isMyTurn && <button type="button" onClick={() => { setPicked(null); setDiscardTarget(null); }}>Put back</button>}
          </div>
        </div>

        <Board gameState={gameState} picked={card} onPlay={play} />

        {seated && (
          <div className={isMyTurn ? 'my-area' : 'my-area my-area-waiting'}>
            <Hand
              cards={myHand}
              label={`Your hand (${myHand.length})`}
              picked={picked?.kind === 'hand' ? picked.index : null}
              onPick={isMyTurn ? index => toggle({ kind: 'hand', index }) : undefined}
              drawnIds={newlyDrawn}
            />
            <PlayerArea
              gameState={gameState}
              seat={playerNumber}
              interactive={isMyTurn}
              picked={picked}
              onPick={toggle}
              discardTarget={discardTarget}
              onChooseDiscard={setDiscardTarget}
              onDiscard={discard}
            />
          </div>
        )}

        <div className="other-seats hand-only-hide">
          {others.map(seat => <PlayerArea key={seat} gameState={gameState} seat={seat} />)}
        </div>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={approve => gameService.voteUndo(approve)} />
    </div>
  );
}
