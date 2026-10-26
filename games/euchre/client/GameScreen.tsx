import { useRef } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import PlayingCard from '../../../src/components/PlayingCard';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import RoundSummary from './RoundSummary';
import Table from './Table';
import animateMove, { sortedHand } from './animateMove.ts';
import { handKey } from '../../../src/animation/animKeys.ts';
import { SEATS, SUITS, SUIT_SYMBOLS, canPlayCard, cardName, partnerOf, sittingOut } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Card, PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const screenRef = useRef<HTMLDivElement>(null);
  const {
    currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, started,
    hand, phase, trick, trump, upcard, dealer, discard, roundSummary, gameStatus
  } = gameState;
  const full = activePlayers.length === SEATS.length;
  const isMyTurn = currentPlayer === playerNumber && full && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && full;
  const showSummary = roundSummary !== null && !isGameOver;
  const isDealer = playerNumber === dealer;

  useMoveAnimation(screenRef, gameState, animateMove);

  const discarding = isMyTurn && phase === 'discard';
  const playing = isMyTurn && phase === 'play';
  const clickable = (card: Card) => discarding || (playing && canPlayCard(hand, card, trick, trump));
  const pick = (card: Card) => gameService.makeMove({ type: discarding ? 'discard' : 'play', card });

  let hint: string | null = null;
  if (isGameOver) hint = null;
  else if (!full) hint = `Euchre needs exactly 4 players (${activePlayers.length} seated)`;
  else if (isMyTurn) {
    const turned = upcard ? cardName(upcard) : '';
    if (phase === 'order') hint = isDealer ? `Pick up the ${turned} to make ${upcard?.suit} trump, or pass` : `Order up the ${turned} to make ${upcard?.suit} trump, or pass`;
    else if (phase === 'name') hint = isDealer ? 'Name a suit for trump, or pass to throw the hand in' : 'Name a suit for trump, or pass';
    else if (phase === 'alone') hint = `Go alone, and ${playerNames[partnerOf(playerNumber)]} sits out this hand, or play with your partner`;
    else if (phase === 'discard') hint = `The ${turned} is in your hand: click a card to discard it`;
    else if (trick.length === 0) hint = 'Lead any card';
    else hint = 'Follow suit if you can; the left bower counts as trump';
  } else if (playerNumber === sittingOut(gameState) && phase === 'play') hint = 'Your partner is going alone: you sit out this hand';

  let turn = '';
  if (isGameOver) turn = 'Game over';
  else if (roundSummary) turn = 'The hand is over';
  else if (full && currentPlayer !== null) {
    turn = currentPlayer === playerNumber ? 'Your turn' : `${playerNames[currentPlayer]}'s turn`;
    if (!started) turn += '. Joining closes after the first move.';
  }

  return (
    <>
      <div className="game-id hand-only-hide">Game ID: {gameState.gameId}</div>
      <div className="game-screen" ref={screenRef}>
        <div className="game-info">
          <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="turn-message">{turn}</div>
          <div className="hint">{hint}</div>
          <div className="action-buttons">
            {isMyTurn && phase === 'order' && (
              <button type="button" onClick={() => gameService.makeMove({ type: 'orderUp' })}>{isDealer ? 'Pick up' : 'Order up'}</button>
            )}
            {isMyTurn && (phase === 'order' || phase === 'name') && (
              <button type="button" onClick={() => gameService.makeMove({ type: 'pass' })}>Pass</button>
            )}
            {isMyTurn && phase === 'alone' && (
              <>
                <button type="button" onClick={() => gameService.makeMove({ type: 'goAlone', alone: true })}>Go alone</button>
                <button type="button" onClick={() => gameService.makeMove({ type: 'goAlone', alone: false })}>Play with partner</button>
              </>
            )}
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
          {isMyTurn && phase === 'name' && (
            <div className="suit-picker" role="group" aria-label="Name trump">
              {SUITS.filter(suit => suit !== upcard?.suit).map(suit => (
                <button key={suit} type="button" className={`suit-choice suit-${suit}`}
                  onClick={() => gameService.makeMove({ type: 'nameTrump', suit })}>
                  {SUIT_SYMBOLS[suit]} {suit}
                </button>
              ))}
            </div>
          )}
        </div>
        <Table gameState={gameState} viewer={playerNumber} />
        <section className={discarding || playing ? 'hand' : 'hand hand-waiting'} aria-label="Your hand">
          <header className="hand-header">Your hand ({hand.length})</header>
          <div className="hand-cards">
            {sortedHand(hand, trump).map((card, slot) => (
              <PlayingCard key={slot} card={card} animKey={handKey(slot)} disabled={!clickable(card)} onClick={() => pick(card)} />
            ))}
          </div>
          {discard && (
            <div className="discards">
              <span className="discards-label">You discarded (only you see it):</span>
              <PlayingCard card={discard} size="small" />
            </div>
          )}
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
