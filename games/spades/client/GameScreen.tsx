import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import PlayingCard from '../../../src/components/PlayingCard';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import RoundSummary from './RoundSummary';
import Table from './Table';
import animateMove, { sortedHand } from './animateMove.ts';
import { handKey } from '../../../src/animation/animKeys.ts';
import { MAX_BID, SEATS, bidName, canPlayCard } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

const BIDS = Array.from({ length: MAX_BID + 1 }, (_, tricks) => tricks);

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [tricks, setTricks] = useState(1);
  const screenRef = useRef<HTMLDivElement>(null);
  const {
    currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, started,
    hand, phase, trick, spadesBroken, roundSummary, gameStatus
  } = gameState;
  const full = activePlayers.length === SEATS.length;
  const isMyTurn = currentPlayer === playerNumber && full && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && full;
  const showSummary = roundSummary !== null && !isGameOver;
  const playing = isMyTurn && phase === 'play';

  useMoveAnimation(screenRef, gameState, animateMove);

  let hint: string | null = null;
  if (isGameOver) hint = null;
  else if (!full) hint = `Spades needs exactly 4 players (${activePlayers.length} seated)`;
  else if (isMyTurn) {
    if (phase === 'bidding') hint = 'Bid the tricks you expect to take, or nil to take none';
    else if (trick.length > 0) hint = 'Follow suit if you can; otherwise any card, a spade trumps';
    else hint = spadesBroken ? 'Lead any card' : 'Lead any card but a spade: spades are not broken yet';
  }

  let turn = '';
  if (isGameOver) turn = 'Game over';
  else if (roundSummary) turn = 'The hand is over';
  else if (full && currentPlayer !== null) {
    turn = currentPlayer === playerNumber ? 'Your turn' : `${playerNames[currentPlayer]}'s turn`;
    if (!started) turn += '. Joining closes after the first move.';
  }

  return (
    <>
      <div className="game-screen" ref={screenRef}>
        <div className="game-info">
          <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="turn-message">{turn}</div>
          <div className="hint">{hint}</div>
          <div className="action-buttons">
            {isMyTurn && phase === 'bidding' && (
              <>
                <label className="bid-amount">
                  Tricks{' '}
                  <select value={tricks} onChange={event => setTricks(Number(event.target.value))}>
                    {BIDS.map(value => <option key={value} value={value}>{value === 0 ? 'Nil' : value}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => gameService.makeMove({ type: 'bid', tricks })}>Bid {bidName(tricks)}</button>
              </>
            )}
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        <Table gameState={gameState} viewer={playerNumber} />
        <section className={isMyTurn ? 'hand' : 'hand hand-waiting'} aria-label="Your hand">
          <header className="hand-header">Your hand ({hand.length})</header>
          <div className="hand-cards">
            {sortedHand(hand).map((card, slot) => (
              <PlayingCard key={slot} card={card} animKey={handKey(slot)}
                disabled={!(playing && canPlayCard(hand, card, trick, spadesBroken))}
                onClick={() => gameService.makeMove({ type: 'play', card })} />
            ))}
          </div>
        </section>
      </div>
      {showSummary && (
        <RoundSummary
          summary={roundSummary}
          gameState={gameState}
          playerNumber={playerNumber}
          onContinue={() => gameService.sendAction({ type: 'acknowledgeRound' })}
        />
      )}
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={approve => gameService.voteUndo(approve)} />
    </>
  );
}
