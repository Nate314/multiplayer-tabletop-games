import { useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import Blanks from './Blanks';
import Canvas from './Canvas';
import Chat from './Chat';
import GameStatus from './GameStatus';
import Scores from './Scores';
import Toolbar from './Toolbar';
import type { Pen } from './Canvas';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, phase, drawer, wordChoices, strokes } = gameState;
  // Kept across turns, so the drawer finds the tools as they left them
  const [pen, setPen] = useState<Pen>({ tool: 'pen', color: 0, size: 1 });
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const isDrawer = drawer === playerNumber && !isGameOver && activePlayers.length >= 2;
  const drawing = isDrawer && phase === 'drawing' && !undoVote;

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="pictionary-layout">
        <div className="game-info">
          <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
          <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} />
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        <Blanks mask={gameState.mask} word={gameState.word} />
        {isDrawer && phase === 'choosing' && wordChoices.length > 0 && (
          <div className="word-choices" role="group" aria-label="Choose a word">
            {wordChoices.map((word, index) => (
              <button key={word} type="button" onClick={() => gameService.makeMove({ type: 'choose', index })} disabled={undoVote !== null}>
                {word}
              </button>
            ))}
          </div>
        )}
        <div className="pictionary-main">
          <div className="pictionary-paper">
            <Canvas strokes={strokes} pen={drawing ? pen : undefined} nextStrokeId={gameState.nextStrokeId} error={error} />
            {drawing && <Toolbar pen={pen} onChange={setPen} canUndo={strokes.length > 0} />}
          </div>
          <div className="pictionary-side">
            <Scores gameState={gameState} playerNumber={playerNumber} />
            <Chat gameState={gameState} playerNumber={playerNumber} />
          </div>
        </div>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
