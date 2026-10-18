import { useState, useEffect, useRef } from 'react';
import gameService from '../../../src/services/gameService';
import Card from './Card';
import GameStatus from './GameStatus';
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
  const screenRef = useRef<HTMLDivElement>(null);
  const {
    currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable,
    hand, discardTop, currentColor, hasDrawn, drawnCard, drawPileCount
  } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  // Only the live table animates; the history dialog renders it without this hook
  useMoveAnimation(screenRef, gameState, animateMove);

  useEffect(() => {
    // A Wild picked up but not played is put back when the turn changes
    setPendingWild(null);
  }, [currentPlayer, hasDrawn]);

  // After drawing, only the drawn card may be played
  const isPlayable = (card: CardData) => isMyTurn &&
    (drawnCard ? sameCard(card, drawnCard) : !hasDrawn && canPlay(card, discardTop, currentColor));

  function playCard(card: CardData) {
    if (isWild(card)) {
      setPendingWild(card);
      return;
    }
    gameService.makeMove({ type: 'play', card });
  }

  function chooseColor(color: Color) {
    if (!pendingWild) return;
    gameService.makeMove({ type: 'play', card: pendingWild, color });
    setPendingWild(null);
  }

  let hint: string | null = null;
  if (isMyTurn) {
    if (pendingWild) hint = 'Choose a color for your Wild';
    else if (hasDrawn) hint = 'Play the card you drew, or pass to keep it';
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
            <button type="button" onClick={() => gameService.makeMove({ type: 'draw' })} disabled={!isMyTurn || hasDrawn}>
              Draw
            </button>
            <button
              type="button"
              onClick={() => gameService.makeMove({ type: 'pass' })}
              disabled={!isMyTurn || (!hasDrawn && drawPileCount > 0)}
            >
              Pass
            </button>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
              Undo
            </button>
          </div>
        </div>
        <Table
          gameState={gameState}
          viewer={playerNumber}
          onDraw={isMyTurn && !hasDrawn ? () => gameService.makeMove({ type: 'draw' }) : undefined}
        />
        {pendingWild && (
          <div className="color-picker" role="group" aria-label="Choose a color">
            {COLORS.map(color => (
              <button key={color} type="button" className={`color-choice swatch-${color}`} onClick={() => chooseColor(color)}>
                {color}
              </button>
            ))}
            <button type="button" className="color-cancel" onClick={() => setPendingWild(null)}>Cancel</button>
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
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
