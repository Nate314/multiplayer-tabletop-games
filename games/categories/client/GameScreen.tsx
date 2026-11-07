import AnswerSheet from './AnswerSheet';
import GameStatus from './GameStatus';
import ReviewTable from './ReviewTable';
import Scores from './Scores';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { playerNames, phase, round, letter, isGameOver } = gameState;

  return (
    <div className="categories-layout">
      <div className="game-info">
        <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
        <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} />
      </div>
      {letter && phase === 'answering' && !isGameOver && <AnswerSheet key={round} gameState={gameState} playerNumber={playerNumber} />}
      {letter && phase === 'review' && <ReviewTable gameState={gameState} viewer={playerNumber} />}
      <Scores gameState={gameState} playerNumber={playerNumber} />
    </div>
  );
}
