import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import Blanks from '../../../src/components/guessing/Blanks';
import Chat from '../../../src/components/guessing/Chat';
import GameStatus from '../../../src/components/guessing/GameStatus';
import Scores from '../../../src/components/guessing/Scores';
import type { GuessTexts } from '../../../src/components/guessing/GameStatus';
import PromptCard from './PromptCard';
import { phaseDeadline } from '../clock.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

const TEXTS: GuessTexts = {
  choose: 'Choose a prompt to act',
  choosing: name => `${name} is choosing a prompt`,
  busy: prompt => `Act out ${prompt}`,
  busyOther: name => `${name} is acting`,
  was: prompt => `The prompt was ${prompt}`
};

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, phase, drawer, wordChoices, word } = gameState;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const isActor = drawer === playerNumber && !isGameOver && activePlayers.length >= 2;
  const acting = isActor && phase === 'drawing' && word !== null;

  return (
    <>
      <div className="charades-layout">
        <div className="game-info">
          <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
          <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} deadline={phaseDeadline(gameState)} texts={TEXTS} />
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        {isActor && phase === 'choosing' && wordChoices.length > 0 && (
          <div className="prompt-choices" role="group" aria-label="Choose a prompt">
            {wordChoices.map((prompt, index) => (
              <button key={prompt} type="button" onClick={() => gameService.makeMove({ type: 'choose', index })} disabled={undoVote !== null}>
                {prompt}
              </button>
            ))}
          </div>
        )}
        <div className="charades-main">
          <div className="charades-stage">
            {acting ? <PromptCard prompt={word} /> : <Blanks mask={gameState.mask} word={word} className="charades-blanks" />}
          </div>
          <div className="charades-side">
            <Scores gameState={gameState} playerNumber={playerNumber} busyNote="acting" />
            <Chat gameState={gameState} playerNumber={playerNumber} inputId="charades-chat-input" className="charades-chat" busyPlaceholder="You are acting" />
          </div>
        </div>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
