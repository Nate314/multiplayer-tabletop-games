import FaqButton from './FaqButton';
import HistoryButton from './HistoryButton';
import GitHubLink from './GitHubLink';
import ThemeToggle from './ThemeToggle';
import PresenceBar from './PresenceBar';
import HouseRulesButton from './HouseRulesButton';
import HouseRulesPanel from './HouseRulesPanel';
import DismissVote from './DismissVote';
import gameService from '../services/gameService';
import { needsAgreement } from '../../shared/houseRules.ts';
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
        <HistoryButton gameType={game.id} gameState={gameState} client={client} />
        <FaqButton game={game} items={client.faq} />
        <HouseRulesButton game={game} gameState={gameState} />
        <GitHubLink />
        <ThemeToggle />
      </header>
      <PresenceBar gameState={gameState} onDismiss={(seat) => gameService.requestDismiss(seat)} />
      {!gameState.started && needsAgreement(game) && <HouseRulesPanel game={game} gameState={gameState} playerNumber={playerNumber} error={error} />}
      <Screen gameState={gameState} playerNumber={playerNumber} error={error} />
      <DismissVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteDismiss(approve)} />
    </div>
  );
}
