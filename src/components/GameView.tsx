import FaqButton from './FaqButton';
import GitHubLink from './GitHubLink';
import ThemeToggle from './ThemeToggle';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';

type GameViewProps = {
  game: GameInfo;
  client: ClientGame;
  gameState: BasePublicState;
  playerNumber: Seat;
  error: string | null;
  onBack: () => void;
};

// The game's styles are scoped to data-game, so only this game's look applies while it is on screen
export default function GameView({ game, client, gameState, playerNumber, error, onBack }: GameViewProps) {
  const { Screen } = client;

  return (
    <div className="game-root" data-game={game.id}>
      <header className="game-header">
        <button type="button" className="back-button" onClick={onBack}>Back to games</button>
        <h1>{game.name}</h1>
        <FaqButton game={game} items={client.faq} />
        <GitHubLink />
        <ThemeToggle />
      </header>
      <Screen gameState={gameState} playerNumber={playerNumber} error={error} />
    </div>
  );
}
