import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import ClueForm from './ClueForm';
import ClueLine from './ClueLine';
import Grid from './Grid';
import TeamPicker from './TeamPicker';
import { TEAM_NAMES } from '../teams.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { activePlayers, playerNames, roles, turn, phase, started, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, currentPlayer } = gameState;
  const mine = roles[playerNumber];
  const idle = isGameOver || undoVote !== null;
  // currentPlayer is the clue-giver while a clue is due, and null until both teams are ready
  const canClue = !idle && phase === 'clue' && currentPlayer === playerNumber && mine?.clueGiver === true;
  const canGuess = !idle && started && phase === 'guessing' && mine?.team === turn && !mine.clueGiver;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const roleText = mine ? `${TEAM_NAMES[mine.team]} ${mine.clueGiver ? 'clue-giver' : 'guesser'}` : 'no team yet';

  return (
    <>
      <div className="hintgrid-layout">
        <div className="game-info">
          <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber}), {roleText}</div>
          {error && !canClue && <div className="game-status game-status-error" role="alert">{error}</div>}
          {started && <div className="turn-message">{isGameOver ? gameStatus : `${TEAM_NAMES[turn]}'s turn`}</div>}
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        {!started && !isGameOver && <TeamPicker gameState={gameState} playerNumber={playerNumber} />}
        {started && <ClueLine gameState={gameState} canEnd={canGuess} />}
        {canClue && <ClueForm error={error} />}
        <Grid gameState={gameState} onGuess={canGuess ? (index) => gameService.makeMove({ type: 'guess', index }) : undefined} />
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
