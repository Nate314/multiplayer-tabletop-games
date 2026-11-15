import { useEffect, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import PlayingCard from '../../../src/components/PlayingCard';
import { sameCard } from '../../../shared/playingCards.ts';
import PegBoard from './PegBoard';
import PeggingArea from './PeggingArea';
import ShowPanel from './ShowPanel';
import RoundSummary from './RoundSummary';
import { playable, sortedHand } from '../scoring.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Card, PublicGameState } from '../types.ts';

const HAND_AFTER_DISCARD = 4;

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const {
    currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, started,
    hand, phase, count, dealer, roundSummary, gameStatus, handNumber, showIndex
  } = gameState;
  const [picked, setPicked] = useState<Card[]>([]); // the cards picked for the crib
  const chosen = picked.filter(card => hand.some(held => sameCard(held, card))); // a redeal can drop picked cards
  const seated = activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const free = seated && !isGameOver && !undoVote && !dismissVote;
  const isMyTurn = free && currentPlayer === playerNumber;
  const toLay = activePlayers.length === 2 ? 2 : 1;
  const discarding = free && phase === 'discard' && hand.length > HAND_AFTER_DISCARD;
  const pegging = isMyTurn && phase === 'pegging';
  const canPlay = pegging ? playable(hand, count) : [];
  const canUndo = undoAvailable && !undoVote && !dismissVote && seated;
  const showSummary = roundSummary !== null && !isGameOver;

  useEffect(() => {
    // A new hand starts with nothing picked
    setPicked([]);
  }, [handNumber, phase]);

  const isChosen = (card: Card) => chosen.some(c => sameCard(c, card));
  function pick(card: Card) {
    if (discarding) setPicked(isChosen(card) ? chosen.filter(c => !sameCard(c, card)) : chosen.length < toLay ? [...chosen, card] : chosen);
    else gameService.makeMove({ type: 'play', card });
  }
  const clickable = (card: Card) => (discarding ? isChosen(card) || chosen.length < toLay : canPlay.some(c => sameCard(c, card)));

  let hint: string | null = null;
  if (isGameOver) hint = null;
  else if (activePlayers.length < 2) hint = 'Cribbage needs 2 to 4 players';
  else if (discarding) hint = `Choose ${toLay === 1 ? 'a card' : '2 cards'} for ${dealer === playerNumber ? 'your' : `${playerNames[dealer ?? playerNumber]}'s`} crib`;
  else if (phase === 'discard') hint = 'Waiting for the others to lay their cards in the crib';
  else if (isMyTurn && phase === 'cut') hint = 'Cut the deck for the starter';
  else if (pegging) hint = canPlay.length ? 'Play a card: the count may not pass 31' : 'No card fits under 31: say Go';
  else if (isMyTurn && phase === 'show') hint = 'Count your cards with the starter and claim the points';

  let turn = '';
  if (isGameOver) turn = 'Game over';
  else if (roundSummary) turn = 'The hand is over';
  else if (currentPlayer !== null) {
    turn = currentPlayer === playerNumber ? 'Your turn' : `${playerNames[currentPlayer]}'s turn`;
    if (!started) turn += '. Joining closes after the first move.';
  }

  return (
    <>
      <div className="game-screen">
        <div className="game-info">
          <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="turn-message">{turn}</div>
          <div className="hint">{hint}</div>
          <div className="action-buttons">
            {discarding && (
              <button type="button" disabled={chosen.length !== toLay} onClick={() => gameService.makeMove({ type: 'discard', cards: chosen })}>Send to crib</button>
            )}
            {isMyTurn && phase === 'cut' && <button type="button" onClick={() => gameService.makeMove({ type: 'cut' })}>Cut</button>}
            {pegging && !canPlay.length && <button type="button" onClick={() => gameService.makeMove({ type: 'go' })}>Go</button>}
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        <PegBoard gameState={gameState} viewer={playerNumber} />
        <PeggingArea gameState={gameState} viewer={playerNumber} />
        {phase === 'show' && <ShowPanel key={showIndex} gameState={gameState} viewer={playerNumber} controls={free} />}
        <section className={discarding || pegging ? 'hand' : 'hand hand-waiting'} aria-label="Your hand">
          <header className="hand-header">Your hand ({hand.length})</header>
          <div className="hand-cards">
            {sortedHand(hand).map(card => (
              <PlayingCard key={`${card.rank}${card.suit}`} card={card} selected={isChosen(card)} disabled={!clickable(card)} onClick={() => pick(card)} />
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
