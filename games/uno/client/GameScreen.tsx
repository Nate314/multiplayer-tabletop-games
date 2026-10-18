import { useState, useEffect, useRef } from 'react';
import gameService from '../../../src/services/gameService';
import Card from './Card';
import GameStatus from './GameStatus';
import RoundSummary from './RoundSummary';
import Table from './Table';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove, { handKey, sortedHand } from './animateMove.ts';
import { COLORS, canPlay, isWild, sameCard } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Card as CardData, Color, PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  // A Wild waiting for its color
  const [pendingWild, setPendingWild] = useState<CardData | null>(null);
  // UNO is called with the next play, which leaves one card
  const [unoArmed, setUnoArmed] = useState(false);
  const [finalScoringClosed, setFinalScoringClosed] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const {
    currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable,
    hand, discardTop, currentColor, hasDrawn, drawnCard, drawPileCount, pendingFour, unoWindow, revealed, roundSummary
  } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const canAct = !isGameOver && !undoVote && !dismissVote && activePlayers.includes(playerNumber);
  const needsColor = isMyTurn && currentColor === null;
  const answeringFour = isMyTurn && pendingFour !== null;
  const canPlayCards = isMyTurn && !needsColor && !answeringFour;
  // The UNO button calls with the play that leaves one card, or late, before anyone catches you
  const lateUno = canAct && unoWindow?.seat === playerNumber && !unoWindow.called;
  const canArmUno = canPlayCards && hand.length === 2 && !lateUno;
  const catchable = canAct && unoWindow !== null && !unoWindow.called && unoWindow.seat !== playerNumber ? unoWindow.seat : null;
  const showSummary = roundSummary !== null && !(isGameOver && finalScoringClosed);

  // Only the live table animates; the history dialog renders it without this hook
  useMoveAnimation(screenRef, gameState, animateMove);

  useEffect(() => {
    // A Wild picked up but not played is put back, and an UNO call not yet played is dropped, when the turn changes
    setPendingWild(null);
    setUnoArmed(false);
  }, [currentPlayer, hasDrawn]);

  useEffect(() => {
    // An undo can reopen a finished game; its next ending shows the scoring again
    if (!isGameOver) setFinalScoringClosed(false);
  }, [isGameOver]);

  // After drawing, only the drawn card may be played
  const isPlayable = (card: CardData) => canPlayCards &&
    (drawnCard ? sameCard(card, drawnCard) : !hasDrawn && canPlay(card, discardTop, currentColor));

  function playCard(card: CardData) {
    if (isWild(card)) {
      setPendingWild(card);
      return;
    }
    gameService.makeMove({ type: 'play', card, uno: unoArmed });
  }

  function chooseColor(color: Color) {
    if (needsColor) {
      gameService.makeMove({ type: 'chooseColor', color });
      return;
    }
    if (!pendingWild) return;
    gameService.makeMove({ type: 'play', card: pendingWild, color, uno: unoArmed });
    setPendingWild(null);
  }

  function callUno() {
    if (lateUno) gameService.sendAction({ type: 'callUno' });
    else setUnoArmed(armed => !armed);
  }

  let hint: string | null = null;
  if (needsColor) hint = 'The game starts on a Wild: name the first color';
  else if (answeringFour) hint = 'Accept the Wild Draw Four, or challenge it';
  else if (lateUno) hint = 'Call UNO before anyone catches you!';
  else if (isMyTurn) {
    if (pendingWild) hint = 'Choose a color for your Wild';
    else if (unoArmed) hint = 'UNO! Now play your next-to-last card';
    else if (hasDrawn) hint = 'Play the card you drew, or pass to keep it';
    else if (hand.length === 2) hint = 'Call UNO before you play your next-to-last card';
    else hint = 'Play a matching card, or draw one';
  }

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="game-screen" ref={screenRef}>
        <div className="game-info">
          <div className="player-info">
            You are {playerNames[playerNumber]} (Player {playerNumber})
          </div>
          <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} hint={hint} />
          <div className="action-buttons">
            <button
              type="button"
              onClick={() => gameService.makeMove({ type: 'draw' })}
              disabled={!canPlayCards || hasDrawn}
            >
              Draw
            </button>
            <button
              type="button"
              onClick={() => gameService.makeMove({ type: 'pass' })}
              disabled={!canPlayCards || (!hasDrawn && drawPileCount > 0)}
            >
              Pass
            </button>
            <button
              type="button"
              className="uno-button"
              aria-pressed={unoArmed}
              onClick={callUno}
              disabled={!lateUno && !canArmUno}
            >
              UNO!
            </button>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
              Undo
            </button>
            {isGameOver && roundSummary && finalScoringClosed && (
              <button type="button" onClick={() => setFinalScoringClosed(false)}>
                Show Scoring
              </button>
            )}
          </div>
          {catchable !== null && (
            <button type="button" className="catch-button" onClick={() => gameService.sendAction({ type: 'catchUno' })}>
              Catch {playerNames[catchable]}: no UNO call!
            </button>
          )}
        </div>
        <Table
          gameState={gameState}
          viewer={playerNumber}
          onDraw={canPlayCards && !hasDrawn ? () => gameService.makeMove({ type: 'draw' }) : undefined}
        />
        {answeringFour && pendingFour && (
          <div className="four-answer" role="group" aria-label="Answer the Wild Draw Four">
            <p>
              {playerNames[pendingFour.by]} played a Wild Draw Four on you. It was allowed only if they held
              no {pendingFour.previousColor} card. If you challenge and they did, they draw 4 and you play on;
              if they did not, you draw 6 and lose your turn.
            </p>
            <div className="four-actions">
              <button type="button" onClick={() => gameService.makeMove({ type: 'challenge' })}>Challenge</button>
              <button type="button" onClick={() => gameService.makeMove({ type: 'accept' })}>Accept and draw 4</button>
            </div>
          </div>
        )}
        {revealed && (
          <section className="revealed" aria-label={`${playerNames[revealed.of]}'s hand`}>
            <header className="hand-header">{playerNames[revealed.of]}'s hand when you challenged (only you see this)</header>
            <div className="hand-cards">
              {sortedHand(revealed.hand).map((card, slot) => <Card key={slot} card={card} />)}
            </div>
          </section>
        )}
        {(pendingWild || needsColor) && (
          <div className="color-picker" role="group" aria-label="Choose a color">
            {COLORS.map(color => (
              <button key={color} type="button" className={`color-choice swatch-${color}`} onClick={() => chooseColor(color)}>
                {color}
              </button>
            ))}
            {pendingWild && <button type="button" className="color-cancel" onClick={() => setPendingWild(null)}>Cancel</button>}
          </div>
        )}
        <section className={isMyTurn ? 'hand' : 'hand hand-waiting'} aria-label="Your hand">
          <header className="hand-header">Your hand ({hand.length})</header>
          <div className="hand-cards">
            {sortedHand(hand).map((card, slot) => (
              <Card
                key={slot}
                card={card}
                animKey={handKey(slot)}
                playable={isPlayable(card)}
                selected={pendingWild !== null && sameCard(card, pendingWild)}
                onClick={() => playCard(card)}
              />
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
          onClose={() => setFinalScoringClosed(true)}
        />
      )}
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
