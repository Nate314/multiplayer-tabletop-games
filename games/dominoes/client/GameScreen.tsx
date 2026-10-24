import { useState, useEffect, useRef } from 'react';
import gameService from '../../../src/services/gameService';
import GameStatus from './GameStatus';
import RoundSummary from './RoundSummary';
import Table from './Table';
import Tile from './Tile';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove, { handKey } from './animateMove.ts';
import { boardOf, endLabel, openEnd, pendingArms } from '../board.ts';
import { layoutOf, legalPlays, stuckMove, tilePips, usableEnds } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  // A tile that fits more than one end, waiting for the end to play it on: clicked, then an end clicked
  const [choosing, setChoosing] = useState<number | null>(null);
  const [finalScoringClosed, setFinalScoringClosed] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const {
    currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable,
    hand, leadTile, set, boneyardCount, roundSummary, drewThisTurn
  } = gameState;
  const board = boardOf(gameState);
  const layout = layoutOf(gameState);
  const roundBegun = board.start !== null;
  const tilesLaid = board.arms.reduce((count, arm) => count + arm.tiles.length, roundBegun ? 1 : 0);
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const plays = legalPlays(gameState, playerNumber, hand);
  const stuck = roundBegun ? stuckMove(gameState, playerNumber, hand, boneyardCount) : null;
  const canDraw = isMyTurn && stuck === 'draw';
  const canPass = isMyTurn && stuck === 'pass';
  const usable = isMyTurn ? usableEnds(gameState, playerNumber) : [];
  const pending = pendingArms(board, layout);
  const showSummary = roundSummary !== null && !(isGameOver && finalScoringClosed);

  // Only the live table animates; the history dialog renders it without this hook
  useMoveAnimation(screenRef, gameState, animateMove);

  useEffect(() => {
    // A tile picked up but not placed is put back when the turn or the board changes
    setChoosing(null);
  }, [currentPlayer, tilesLaid, hand.length]);

  useEffect(() => {
    // An undo can reopen a finished game; its next ending shows the scoring again
    if (!isGameOver) setFinalScoringClosed(false);
  }, [isGameOver]);

  const endsFor = (tile: number) => plays.filter(option => option.tile === tile).map(option => option.end);

  // Plays at once when the tile fits one end (or leads the round); else selects it, and clicking it again puts it back
  function playTile(tile: number) {
    const ends = endsFor(tile);
    if (choosing === tile) setChoosing(null);
    else if (ends.length === 1) gameService.makeMove({ type: 'play', tile, end: ends[0] });
    else setChoosing(tile);
  }

  function playOn(end: number) {
    if (choosing === null) return;
    gameService.makeMove({ type: 'play', tile: choosing, end });
    setChoosing(null);
  }

  let hint: string | null = null;
  if (isMyTurn) {
    if (choosing !== null) hint = 'That tile fits more than one end: choose one';
    else if (!roundBegun && leadTile !== null) hint = 'Lead with your highest double, or your heaviest tile';
    else if (!roundBegun) hint = 'You won the last round: lead with any tile';
    else if (canDraw) hint = 'Nothing fits: draw from the boneyard';
    else if (canPass && layout.trains && boneyardCount === 0) hint = 'Nothing fits and the boneyard is empty: pass, and your train opens';
    else if (canPass && layout.trains && drewThisTurn) hint = 'Nothing fits: pass, and your train opens';
    else if (canPass) hint = 'Nothing fits and the boneyard is empty: pass';
    else if (pending.length > 0) {
      const double = board.arms[pending[0]].base;
      hint = `Finish the ${double}-${double} first: play on its open ends`;
    } else hint = 'Play a tile that matches an open end';
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
            <button type="button" onClick={() => gameService.makeMove({ type: 'draw' })} disabled={!canDraw}>Draw</button>
            <button type="button" onClick={() => gameService.makeMove({ type: 'pass' })} disabled={!canPass}>Pass</button>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
            {isGameOver && roundSummary && finalScoringClosed && (
              <button type="button" onClick={() => setFinalScoringClosed(false)}>Show Scoring</button>
            )}
          </div>
        </div>
        <Table
          gameState={gameState}
          viewer={playerNumber}
          onDraw={canDraw ? () => gameService.makeMove({ type: 'draw' }) : undefined}
          usable={usable}
          fits={choosing === null ? [] : endsFor(choosing)}
          onEnd={playOn}
        />
        {choosing !== null && (
          <div className="end-choice" role="group" aria-label="Choose an end">
            {endsFor(choosing).map(end => (
              <button key={end} type="button" onClick={() => playOn(end)}>
                {`${endLabel(board, end, playerNames)} (${openEnd(board, end)})`}
              </button>
            ))}
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
