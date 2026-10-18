import gameService from '../../../src/services/gameService';
import GameStatus from './GameStatus';
import PlayArea from './PlayArea';
import Scores from './Scores';
import UndoVote from '../../../src/components/UndoVote';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, moveCount, rack } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="game-layout">
        <div className="game-info side-panel">
          <div className="player-info">
            You are {playerNames[playerNumber]} (Player {playerNumber})
          </div>
          <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} />
          <Scores gameState={gameState} playerNumber={playerNumber} />
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
              Undo
            </button>
          </div>
        </div>
        {/* A new move or a new rack starts the turn's placing afresh */}
        <PlayArea key={`${moveCount}:${rack.join('')}`} gameState={gameState} isMyTurn={isMyTurn} />
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
