import RulesButton from './RulesButton';
import HistoryButton from './HistoryButton';
import ShareButton from './ShareButton';
import SettingsButton from './SettingsButton';
import GitHubLink from './GitHubLink';
import ThemeToggle from './ThemeToggle';
import PresenceBar from './PresenceBar';
import HouseRulesPanel from './HouseRulesPanel';
import HouseRulesSection from './HouseRulesSection';
import DismissVote from './DismissVote';
import gameService from '../services/gameService';
import { everyoneAgreed, needsAgreement } from '../../shared/houseRules.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';
import useStateSounds from '../sound/useStateSounds.ts';

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
  useStateSounds(gameState, playerNumber, true);
  const choosingRules = !gameState.started && needsAgreement(game);
  // Nobody can move until everyone agreed, so the game screen is dimmed until then (the server refuses a move anyway)
  const awaitingAgreement = choosingRules && !everyoneAgreed(game, gameState);

  return (
    <div className="game-root" data-game={game.id} data-awaiting-agreement={awaitingAgreement ? '' : undefined}>
      <header className="game-header">
        <button type="button" className="back-button" onClick={onBack}>Back to games</button>
        <h1>{game.name}</h1>
        <HistoryButton gameType={game.id} gameState={gameState} client={client} />
        <ShareButton game={game} gameId={gameState.gameId} />
        <RulesButton game={game} faq={client.faq} />
        <SettingsButton phoneControls={(
          <>
            <div className="settings-row">Share this game <ShareButton game={game} gameId={gameState.gameId} /></div>
            <div className="settings-row">Theme <ThemeToggle /></div>
          </>
        )}>
          <HouseRulesSection game={game} gameState={gameState} />
        </SettingsButton>
        <GitHubLink />
        <ThemeToggle />
      </header>
      <PresenceBar gameState={gameState} playerNumber={playerNumber} onDismiss={(seat) => gameService.requestDismiss(seat)} />
      {choosingRules && <HouseRulesPanel game={game} gameState={gameState} playerNumber={playerNumber} error={error} />}
      <Screen gameState={gameState} playerNumber={playerNumber} error={error} />
      <DismissVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteDismiss(approve)} />
    </div>
  );
}
