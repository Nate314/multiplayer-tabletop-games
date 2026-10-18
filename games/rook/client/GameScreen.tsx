import { useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import Card from './Card';
import RoundSummary from './RoundSummary';
import Table from './Table';
import animateMove, { handKey, sortedHand } from './animateMove.ts';
import { BID_STEP, COLORS, MAX_BID, MIN_BID, NEST_SIZE, SEATS, canPlayCard, sameCard } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Card as CardData, PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [chosen, setChosen] = useState<CardData[]>([]); // cards picked to lay aside
  const [amount, setAmount] = useState(MIN_BID);
  const [finalScoringClosed, setFinalScoringClosed] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const {
    currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, started,
    hand, phase, bidding, trick, trump, discards, roundSummary, gameStatus
  } = gameState;
  const full = activePlayers.length === SEATS.length;
  const isMyTurn = currentPlayer === playerNumber && full && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && full;
  const lowestBid = bidding.high ? bidding.high.amount + BID_STEP : MIN_BID;
  const bids: number[] = [];
  for (let value = lowestBid; value <= MAX_BID; value += BID_STEP) bids.push(value);
  const showSummary = roundSummary !== null && !(isGameOver && finalScoringClosed);

  useMoveAnimation(screenRef, gameState, animateMove);

  useEffect(() => {
    // A new turn or step starts with nothing picked and the lowest bid offered
    setChosen([]);
    setAmount(lowestBid);
  }, [currentPlayer, phase, lowestBid]);

  useEffect(() => {
    if (!isGameOver) setFinalScoringClosed(false);
  }, [isGameOver]);

  const isChosen = (card: CardData) => chosen.some(other => sameCard(other, card));
  function toggle(card: CardData) {
    setChosen(picked => isChosen(card) ? picked.filter(other => !sameCard(other, card))
      : picked.length < NEST_SIZE ? [...picked, card] : picked);
  }

  const discarding = isMyTurn && phase === 'discard';
  const playing = isMyTurn && phase === 'play';
  const clickable = (card: CardData) =>
    discarding ? (isChosen(card) || chosen.length < NEST_SIZE) : playing && canPlayCard(hand, card, trick, trump);
  function pick(card: CardData) {
    if (discarding) toggle(card);
    else gameService.makeMove({ type: 'play', card });
  }

  let hint: string | null = null;
  if (isGameOver) hint = null;
  else if (!full) hint =`Rook needs exactly 4 players (${activePlayers.length} seated)`;
  else if (isMyTurn) {
    if (phase === 'bidding') hint = bidding.high ? `Bid more than ${bidding.high.amount}, or pass for this hand` : `Open the bidding at ${MIN_BID} or more, or pass`;
    else if (phase === 'discard') hint = `The nest is in your hand: pick ${NEST_SIZE} cards to lay aside`;
    else if (phase === 'trump') hint = 'Name trump';
    else if (trick.length === 0) hint = 'Lead any card';
    else hint = 'Follow suit if you can; the Rook may be played at any time';
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
      <div className="game-id">Game ID: {gameState.gameId}</div>
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
                  Bid{' '}
                  <select value={amount} onChange={event => setAmount(Number(event.target.value))}>
                    {bids.map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => gameService.makeMove({ type: 'bid', amount })}>Bid {amount}</button>
                <button type="button" onClick={() => gameService.makeMove({ type: 'pass' })}>Pass</button>
              </>
            )}
            {discarding && (
              <button type="button" disabled={chosen.length !== NEST_SIZE}
                onClick={() => gameService.makeMove({ type: 'discard', cards: chosen })}>
                Lay aside {chosen.length}/{NEST_SIZE}
              </button>
            )}
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
            {isGameOver && roundSummary && finalScoringClosed && (
              <button type="button" onClick={() => setFinalScoringClosed(false)}>Show Scoring</button>
            )}
          </div>
          {isMyTurn && phase === 'trump' && (
            <div className="color-picker" role="group" aria-label="Name trump">
              {COLORS.map(color => (
                <button key={color} type="button" className={`color-choice choice-${color}`}
                  onClick={() => gameService.makeMove({ type: 'nameTrump', color })}>
                  {color}
                </button>
              ))}
            </div>
          )}
        </div>
        <Table gameState={gameState} viewer={playerNumber} />
        <section className={isMyTurn ? 'hand' : 'hand hand-waiting'} aria-label="Your hand">
          <header className="hand-header">Your hand ({hand.length})</header>
          <div className="hand-cards">
            {sortedHand(hand).map((card, slot) => (
              <Card key={slot} card={card} animKey={handKey(slot)} playable={clickable(card)} selected={isChosen(card)}
                onClick={() => pick(card)} />
            ))}
          </div>
          {discards.length > 0 && (
            <div className="discards">
              <span className="discards-label">Laid aside (only you see these; they go with the last trick):</span>
              <div className="hand-cards">
                {sortedHand(discards).map((card, slot) => <Card key={slot} card={card} small />)}
              </div>
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
          onClose={() => setFinalScoringClosed(true)}
        />
      )}
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={approve => gameService.voteUndo(approve)} />
    </>
  );
}
