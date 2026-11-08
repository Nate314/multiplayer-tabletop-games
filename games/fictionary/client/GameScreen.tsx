import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import gameService from '../../../src/services/gameService';
import GameStatus from './GameStatus';
import RevealRows from './RevealRows';
import Scores from './Scores';
import VotingPanel from './VotingPanel';
import WritingPanel from './WritingPanel';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { phase, reveal, activePlayers, round, word } = gameState;
  // The last word sets no reveal, so it has no Continue: its rows are the game-over screen's
  const dialog = phase === 'reveal' && reveal !== null && activePlayers.includes(playerNumber);

  return (
    <div className="fictionary-layout">
      <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} />
      {phase === 'writing' && <WritingPanel gameState={gameState} playerNumber={playerNumber} />}
      {phase === 'voting' && <VotingPanel gameState={gameState} playerNumber={playerNumber} />}
      {phase === 'reveal' && !dialog && <RevealRows gameState={gameState} viewer={playerNumber} />}
      <Scores gameState={gameState} viewer={playerNumber} />
      {dialog && (
        <RoundSummaryDialog label={`Round ${round} reveal`} title={word} gameState={gameState} result={null}
          acknowledged={reveal.acknowledged} playerNumber={playerNumber} onContinue={() => gameService.sendAction({ type: 'continue' })}>
          <RevealRows gameState={gameState} viewer={playerNumber} />
        </RoundSummaryDialog>
      )}
    </div>
  );
}
