import { useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import Blanks from '../../../src/components/guessing/Blanks';
import Chat from '../../../src/components/guessing/Chat';
import GameStatus from '../../../src/components/guessing/GameStatus';
import Scores from '../../../src/components/guessing/Scores';
import type { GuessTexts } from '../../../src/components/guessing/GameStatus';
import Canvas from './Canvas';
import Toolbar from './Toolbar';
import { phaseDeadline } from '../clock.ts';
import type { Pen } from './Canvas';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

const TEXTS: GuessTexts = {
  choose: 'Choose a word to draw',
  choosing: name => `${name} is choosing a word`,
  busy: word => `Draw ${word}`,
  busyOther: name => `${name} is drawing`,
  was: word => `The word was ${word}`
};

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, phase, drawer, wordChoices, strokes } = gameState;
  // Kept across turns, so the drawer finds the tools as they left them
  const [pen, setPen] = useState<Pen>({ tool: 'pen', color: 0, size: 1 });
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const isDrawer = drawer === playerNumber && !isGameOver && activePlayers.length >= 2;
  const drawing = isDrawer && phase === 'drawing' && !undoVote;

  return (
    <>
      <div className="drawandguess-layout">
        <div className="game-info">
          <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
          <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} deadline={phaseDeadline(gameState)} texts={TEXTS} />
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        <Blanks mask={gameState.mask} word={gameState.word} label="Word" className="drawandguess-blanks" />
        {isDrawer && phase === 'choosing' && wordChoices.length > 0 && (
          <div className="word-choices" role="group" aria-label="Choose a word">
            {wordChoices.map((word, index) => (
              <button key={word} type="button" onClick={() => gameService.makeMove({ type: 'choose', index })} disabled={undoVote !== null}>
                {word}
              </button>
            ))}
          </div>
        )}
        <div className="drawandguess-main">
          <div className="drawandguess-paper hand-only-board">
            <Canvas strokes={strokes} pen={drawing ? pen : undefined} nextStrokeId={gameState.nextStrokeId} error={error} />
            {drawing && <Toolbar pen={pen} onChange={setPen} canUndo={strokes.length > 0} />}
          </div>
          <div className="drawandguess-side">
            <Scores gameState={gameState} playerNumber={playerNumber} busyNote="drawing" />
            <Chat gameState={gameState} playerNumber={playerNumber} inputId="drawandguess-chat-input" className="drawandguess-chat" busyPlaceholder="You are drawing" />
          </div>
        </div>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
