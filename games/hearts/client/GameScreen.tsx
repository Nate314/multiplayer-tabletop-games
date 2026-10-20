import { useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import PlayingCard from '../../../src/components/PlayingCard';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import RoundSummary from './RoundSummary';
import Table from './Table';
import animateMove, { handKey } from './animateMove.ts';
import { PASS_SIZE, SEATS, passDirection, passPhrase, passTarget, playError } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [chosen, setChosen] = useState<number[]>([]); // places in the hand picked to pass
  const [finalScoringClosed, setFinalScoringClosed] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const {
    currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, started,
    hand, phase, trick, roundSummary, gameStatus, handNumber, passed, myPass
  } = gameState;
  const full = activePlayers.length === SEATS.length;
  const voting = Boolean(undoVote || dismissVote);
  const isMyTurn = currentPlayer === playerNumber && phase === 'play' && full && !isGameOver && !voting;
  const canUndo = undoAvailable && !voting && activePlayers.includes(playerNumber) && full;
  const direction = passDirection(handNumber);
  const receiver = playerNames[passTarget(playerNumber, direction)];
  const choosing = phase === 'passing' && full && !isGameOver && !voting && !passed.includes(playerNumber);
  const showSummary = roundSummary !== null && !(isGameOver && finalScoringClosed);

  useMoveAnimation(screenRef, gameState, animateMove);

  useEffect(() => {
    // A new hand starts with nothing picked
    setChosen([]);
  }, [handNumber, phase]);

  useEffect(() => {
    if (!isGameOver) setFinalScoringClosed(false);
  }, [isGameOver]);

  function toggle(slot: number) {
    setChosen(picked => picked.includes(slot) ? picked.filter(other => other !== slot)
      : picked.length < PASS_SIZE ? [...picked, slot] : picked);
  }

  const clickable = (slot: number) =>
    choosing ? chosen.includes(slot) || chosen.length < PASS_SIZE : isMyTurn && playError(hand, hand[slot], gameState) === null;
  function pick(slot: number) {
    if (choosing) toggle(slot);
    else gameService.makeMove({ type: 'play', card: hand[slot] });
  }

  let hint: string | null = null;
  if (isGameOver) hint = null;
  else if (!full) hint = `Hearts needs exactly 4 players (${activePlayers.length} seated)`;
  else if (choosing) hint = `Pick three cards to pass ${passPhrase(direction)}, to ${receiver}`;
  else if (phase === 'passing') {
    const waiting = SEATS.filter(seat => !passed.includes(seat)).map(seat => playerNames[seat]);
    hint = `Waiting for ${waiting.join(', ')} to pass`;
  } else if (isMyTurn) {
    if (trick.length > 0) hint = 'Follow suit if you can';
    else hint = gameState.tricksPlayed === 0 ? 'Lead the 2 of clubs' : 'Lead a card';
  }

  let turn = '';
  if (isGameOver) turn = 'Game over';
  else if (roundSummary) turn = 'The hand is over';
  else if (full && phase === 'passing') turn = started ? 'Passing' : 'Passing. The seats lock at the first pass.';
  else if (full && currentPlayer !== null) turn = currentPlayer === playerNumber ? 'Your turn' : `${playerNames[currentPlayer]}'s turn`;

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
            {choosing && (
              <button type="button" disabled={chosen.length !== PASS_SIZE}
                onClick={() => gameService.sendAction({ type: 'pass', cards: chosen })}>
                Pass {chosen.length}/{PASS_SIZE}
              </button>
            )}
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
            {isGameOver && roundSummary && finalScoringClosed && (
              <button type="button" onClick={() => setFinalScoringClosed(false)}>Show Scoring</button>
            )}
          </div>
        </div>
        <Table gameState={gameState} viewer={playerNumber} />
        <section className={isMyTurn || choosing ? 'hand' : 'hand hand-waiting'} aria-label="Your hand">
          <header className="hand-header">Your hand ({hand.length})</header>
          <div className="hand-cards">
            {hand.map((card, slot) => (
              <PlayingCard key={slot} card={card} animKey={handKey(slot)} selected={chosen.includes(slot)}
                disabled={!clickable(slot)} onClick={() => pick(slot)} />
            ))}
          </div>
          {myPass.length > 0 && (
            <div className="my-pass">
              <span className="my-pass-label">Passed to {receiver} (they get them once everyone has passed):</span>
              <div className="hand-cards">
                {myPass.map((card, slot) => <PlayingCard key={slot} card={card} size="small" />)}
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
