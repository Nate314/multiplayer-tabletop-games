import { useState, useEffect, useRef } from 'react';
import gameService from '../../../src/services/gameService';
import GameStatus from './GameStatus';
import RoundSummary from './RoundSummary';
import Table from './Table';
import Tile from './Tile';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove, { handKey } from './animateMove.ts';
import { SETS, legalPlays, leftEnd, rightEnd, tilePips } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { End, PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  // A tile that fits both ends, waiting for the end to play it on
  const [choosing, setChoosing] = useState<number | null>(null);
  const [finalScoringClosed, setFinalScoringClosed] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const {
    started, currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable,
    hand, line, leadTile, set, boneyardCount, roundSummary
  } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const inLobby = !started && !isGameOver && activePlayers.includes(playerNumber);
  const plays = legalPlays(set, hand, line, leadTile);
  const stuck = plays.length === 0 && line.length > 0;
  const canDraw = isMyTurn && stuck && boneyardCount > 0;
  const canPass = isMyTurn && stuck && boneyardCount === 0;
  const showSummary = roundSummary !== null && !(isGameOver && finalScoringClosed);

  // Only the live table animates; the history dialog renders it without this hook
  useMoveAnimation(screenRef, gameState, animateMove);

  useEffect(() => {
    // A tile picked up but not placed is put back when the turn or the line changes
    setChoosing(null);
  }, [currentPlayer, line.length, hand.length]);

  useEffect(() => {
    // An undo can reopen a finished game; its next ending shows the scoring again
    if (!isGameOver) setFinalScoringClosed(false);
  }, [isGameOver]);

  function playTile(tile: number) {
    const ends = plays.filter(option => option.tile === tile).map(option => option.end);
    if (ends.length === 1 || line.length === 0) gameService.makeMove({ type: 'play', tile, end: ends[0] });
    else setChoosing(tile);
  }

  function playOn(end: End) {
    if (choosing === null) return;
    gameService.makeMove({ type: 'play', tile: choosing, end });
    setChoosing(null);
  }

  let hint: string | null = null;
  if (isMyTurn) {
    if (choosing !== null) hint = 'That tile fits both ends: choose one';
    else if (line.length === 0 && leadTile !== null) hint = 'Lead with your highest double, or your heaviest tile';
    else if (line.length === 0) hint = 'You won the last round: lead with any tile';
    else if (canDraw) hint = 'Nothing fits: draw from the boneyard';
    else if (canPass) hint = 'Nothing fits and the boneyard is empty: pass';
    else hint = 'Play a tile that matches an open end';
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
          {inLobby && (
            <div className="set-choice" role="group" aria-label="Domino set">
              {SETS.map(size => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={set === size}
                  onClick={() => gameService.sendAction({ type: 'chooseSet', set: size })}
                >
                  Double-{size === 6 ? 'six (28 tiles)' : 'nine (55 tiles)'}
                </button>
              ))}
            </div>
          )}
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.makeMove({ type: 'draw' })} disabled={!canDraw}>Draw</button>
            <button type="button" onClick={() => gameService.makeMove({ type: 'pass' })} disabled={!canPass}>Pass</button>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
            {isGameOver && roundSummary && finalScoringClosed && (
              <button type="button" onClick={() => setFinalScoringClosed(false)}>Show Scoring</button>
            )}
          </div>
        </div>
        <Table gameState={gameState} viewer={playerNumber} onDraw={canDraw ? () => gameService.makeMove({ type: 'draw' }) : undefined} />
        {choosing !== null && (
          <div className="end-choice" role="group" aria-label="Choose an end">
            <button type="button" onClick={() => playOn('left')}>Left end ({leftEnd(line)})</button>
            <button type="button" onClick={() => playOn('right')}>Right end ({rightEnd(line)})</button>
            <button type="button" className="end-cancel" onClick={() => setChoosing(null)}>Cancel</button>
          </div>
        )}
        <section className={isMyTurn ? 'hand' : 'hand hand-waiting'} aria-label="Your hand">
          <header className="hand-header">Your hand ({hand.length})</header>
          <div className="hand-tiles">
            {hand.map(tile => (
              <Tile
                key={tile}
                pips={tilePips(set, tile)}
                animKey={handKey(tile)}
                playable={isMyTurn && plays.some(option => option.tile === tile)}
                selected={choosing === tile}
                onClick={() => playTile(tile)}
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
