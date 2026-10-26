import { useState } from 'react';
import RulesButton from './RulesButton';
import HistoryButton, { useHistoryDialog } from './HistoryButton';
import GameOverDialog from './GameOverDialog';
import { canRematch } from './gameOver.ts';
import ShareButton from './ShareButton';
import SettingsButton from './SettingsButton';
import GitHubLink from './GitHubLink';
import ThemeToggle from './ThemeToggle';
import PresenceBar from './PresenceBar';
import HouseRulesPanel from './HouseRulesPanel';
import HouseRulesSection from './HouseRulesSection';
import DismissVote from './DismissVote';
import SpectatorView from './SpectatorView';
import HandRequestPrompt from './HandRequestPrompt';
import gameService from '../services/gameService';
import { agreementPending } from '../../shared/houseRules.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';
import useStateSounds from '../sound/useStateSounds.ts';

type GameViewProps = {
  game: GameInfo;
  client: ClientGame;
  gameState: BasePublicState;
  playerNumber: Seat | null;
  spectatorId: string | null;
  credential: string | undefined;
  error: string | null;
  onBack: () => void;
};

// The game's styles are scoped to data-game, so only this game's look applies while it is on screen
export default function GameView({ game, client, gameState, playerNumber, spectatorId, credential, error, onBack }: GameViewProps) {
  // App only shows a game once the connection has a seat or a spectator id
  if (playerNumber === null && spectatorId === null) throw new Error('A joined game has a seat or a spectator id');
  const { Screen } = client;
  useStateSounds(gameState, playerNumber, true);
  const choosingRules = !gameState.started; // every game can set the turn timer
  // Nobody can move until everyone agreed, so the game screen is dimmed until then (the server refuses a move anyway)
  const awaitingAgreement = choosingRules && agreementPending(game, gameState);
  const history = useHistoryDialog(game.id, gameState, client, credential);
  // Closed with See the table; an undo past the end reopens it on the next ending
  const [closed, setClosed] = useState(false);
  if (closed && !gameState.isGameOver) setClosed(false);
  // A vote runs above the table, so the screen steps aside until it ends (a decline brings it back)
  const voting = Boolean(gameState.undoVote || gameState.dismissVote);

  return (
    <div className="game-root" data-game={game.id} data-awaiting-agreement={awaitingAgreement ? '' : undefined}>
      <header className="game-header">
        <button type="button" className="back-button" onClick={onBack}>Back to games</button>
        <h1>{game.name}</h1>
        <HistoryButton onOpen={history.open} />
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
      {gameState.isGameOver && closed && !voting && (
        <button type="button" className="game-over-reopen" onClick={() => setClosed(false)}>Game summary</button>
      )}
      <PresenceBar
        gameState={gameState}
        playerNumber={playerNumber}
        spectatorId={spectatorId}
        onDismiss={playerNumber === null ? null : (seat) => gameService.requestDismiss(seat)}
      />
      {playerNumber === null ? (
        <SpectatorView client={client} gameState={gameState} spectatorId={spectatorId!} error={error} />
      ) : (
        <>
          {choosingRules && <HouseRulesPanel game={game} gameState={gameState} playerNumber={playerNumber} error={error} />}
          <Screen gameState={gameState} playerNumber={playerNumber} error={error} />
          <DismissVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteDismiss(approve)} />
          <HandRequestPrompt gameState={gameState} onAnswer={(spectator, allow) => gameService.answerHand(spectator, allow)} />
        </>
      )}
      {gameState.isGameOver && !closed && !voting && (
        <GameOverDialog
          game={game}
          client={client}
          gameState={gameState}
          viewer={playerNumber}
          canRematch={canRematch(gameState, playerNumber)}
          onHistory={history.open}
          // Escape in History closes only History
          onSeeTable={() => { if (!history.dialog) setClosed(true); }}
          onBack={onBack}
        />
      )}
      {history.dialog}
    </div>
  );
}
