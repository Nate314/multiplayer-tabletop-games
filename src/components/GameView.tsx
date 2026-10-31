import { useState } from 'react';
import { WatchingContext } from './WatchingContext.ts';
import RulesButton from './RulesButton';
import HistoryButton, { useHistoryDialog } from './HistoryButton';
import GameOverDialog from './GameOverDialog';
import { canRematch } from './gameOver.ts';
import ShareButton from './ShareButton';
import HideButton from './HideButton';
import SettingsButton from './SettingsButton';
import GitHubLink from './GitHubLink';
import ThemeToggle from './ThemeToggle';
import PresenceBar from './PresenceBar';
import HouseRulesPanel from './HouseRulesPanel';
import HouseRulesSection from './HouseRulesSection';
import DismissVote from './DismissVote';
import RematchVote from './RematchVote';
import SpectatorView from './SpectatorView';
import TableScreenView from './TableScreenView';
import QrCodeDialog from './QrCodeDialog';
import LayoutSwitch from './LayoutSwitch';
import HandRequestPrompt from './HandRequestPrompt';
import HandoffScreen from './HandoffScreen';
import PassAndPlayBar from './PassAndPlayBar';
import gameService from '../services/gameService';
import { agreementPending, houseRulesOf } from '../../shared/houseRules.ts';
import { dismissVoters } from '../../shared/seating.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';
import { loadTableLayout, saveTableLayout } from '../services/settings.ts';
import type { TableLayout } from '../services/settings.ts';
import useStateSounds from '../sound/useStateSounds.ts';
import useTurnAlerts from '../alerts/useTurnAlerts.ts';

type GameViewProps = {
  game: GameInfo;
  client: ClientGame;
  gameState: BasePublicState;
  playerNumber: Seat | null;
  spectatorId: string | null;
  credential: string | undefined;
  localSeats: { seat: Seat; name: string }[] | null; // a pass-and-play device's seats, null for any other join
  onShowSeat: (seat: Seat | null) => void;
  error: string | null;
  onBack: () => void;
  onDrop: () => void; // leaves and forgets the game
};

// The game's styles are scoped to data-game, so only this game's look applies while it is on screen
export default function GameView({ game, client, gameState, playerNumber, spectatorId, credential, localSeats, onShowSeat, error, onBack, onDrop }: GameViewProps) {
  // App only shows a game once the connection has a seat, a spectator id or local seats
  if (playerNumber === null && spectatorId === null && localSeats === null) throw new Error('A joined game has a seat, a spectator id or local seats');
  const { Screen } = client;
  useStateSounds(gameState, playerNumber, true);
  const choosingRules = !gameState.started; // every game can set the turn timer
  // Nobody can move until everyone agreed, so the game screen is dimmed until then (the server refuses a move anyway)
  const awaitingAgreement = choosingRules && agreementPending(game, gameState);
  const history = useHistoryDialog(game.id, gameState, client, credential);
  // Closed with See the table; an undo past the end reopens it on the next ending
  const [closed, setClosed] = useState(false);
  // Kept mounted and only made invisible, so nothing a player arranged is lost
  const [hidden, setHidden] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  if (closed && !gameState.isGameOver) setClosed(false);
  // A vote runs above the table, so the screen steps aside until it ends (a decline brings it back).
  // A dismiss target does not vote on it: in a rematch they answer the rematch instead, which clears the dismiss,
  // and only the seats that joined the rematch have a say.
  const dismissVoting = gameState.dismissVote && (playerNumber === null || dismissVoters(gameState).includes(playerNumber));
  const voting = Boolean(gameState.undoVote || dismissVoting);
  const rematchVote = (
    <RematchVote
      gameState={gameState}
      viewer={playerNumber}
      onVote={(join) => {
        gameService.voteRematch(join);
        // A shared device keeps its other players; the reset removes the seats that dropped
        if (!join && !localSeats) onDrop();
      }}
      onRemove={(seat) => gameService.requestDismiss(seat)}
    />
  );
  // Nothing is private before the first move, so a shared device sets and agrees to the rules during a handoff too (Agree counts for every local seat).
  // It sets them as its host seat when the host is one of its players, as the server does.
  const localHost = localSeats?.find(local => local.seat === houseRulesOf(game, gameState).host)?.seat;
  const rulesSeat = localHost ?? playerNumber ?? localSeats?.[0]?.seat ?? null;
  const handingOff = localSeats !== null && playerNumber === null;
  const tableScreen = (gameState.spectators ?? []).some(s => s.id === spectatorId && s.tableScreen);
  // A table screen is a spectator, so it and other spectators pass no seats: a plain title and no notifications
  useTurnAlerts(game, gameState, localSeats ? localSeats.map(local => local.seat) : playerNumber === null ? [] : [playerNumber]);
  // Players only receive connected spectators, so this is on only while the TV's page is open
  const tableScreenOn = playerNumber !== null && (gameState.spectators ?? []).some(s => s.tableScreen);
  const [layout, setLayout] = useState<TableLayout>(loadTableLayout);
  const chooseLayout = (next: TableLayout) => { setLayout(next); saveTableLayout(next); };
  const myTurn = playerNumber !== null && gameState.currentPlayer === playerNumber && !gameState.isGameOver;

  return (
    <WatchingContext value={playerNumber === null}>
      <div className="game-root" data-game={game.id} data-awaiting-agreement={awaitingAgreement ? '' : undefined} data-hidden={hidden ? '' : undefined} data-table-screen={tableScreen ? '' : undefined} data-hand-only={tableScreenOn && layout === 'handOnly' ? '' : undefined} data-my-turn={myTurn ? '' : undefined}>
        <header className="game-header">
          <button type="button" className="back-button" onClick={onBack}>Back to games</button>
          <h1>{game.name}</h1>
          <HistoryButton onOpen={history.open} />
          <ShareButton game={game} gameId={gameState.gameId} />
          {tableScreen && <button type="button" className="history-button qr-button" onClick={() => setQrOpen(true)}>Show QR code</button>}
          <RulesButton game={game} faq={client.faq} />
          {!tableScreen && <HideButton hidden={hidden} onToggle={() => setHidden(h => !h)} />}
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
        {hidden && (
          <section className="hidden-cover" aria-label="Game hidden">
            <h2>Game hidden</h2>
            <p>Press the eye button above to show it again.</p>
          </section>
        )}
        {gameState.isGameOver && closed && !voting && (
          <button type="button" className="game-over-reopen" onClick={() => setClosed(false)}>Game summary</button>
        )}
        <PresenceBar
          gameState={gameState}
          playerNumber={playerNumber}
          spectatorId={spectatorId}
          canReact={!handingOff}
          onDismiss={playerNumber === null ? null : (seat) => gameService.requestDismiss(seat)}
        />
        {tableScreenOn && <LayoutSwitch layout={layout} onChange={chooseLayout} />}
        {choosingRules && rulesSeat !== null && <HouseRulesPanel game={game} gameState={gameState} playerNumber={rulesSeat} error={error} />}
        {tableScreen ? (
          <TableScreenView game={game} client={client} gameState={gameState} />
        ) : handingOff ? (
          <HandoffScreen client={client} gameState={gameState} localSeats={localSeats!} onShow={onShowSeat} />
        ) : playerNumber === null ? (
          <SpectatorView client={client} gameState={gameState} spectatorId={spectatorId!} error={error} />
        ) : (
          <>
            {localSeats && <PassAndPlayBar name={gameState.playerNames[playerNumber]} onPass={() => onShowSeat(null)} />}
            {/* Remounted per shown seat, so nothing one player picked (a pass, a rack order) shows to the next */}
            <Screen key={playerNumber} gameState={gameState} playerNumber={playerNumber} error={error} />
            <DismissVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteDismiss(approve)} />
            <HandRequestPrompt gameState={gameState} onAnswer={(spectator, allow) => gameService.answerHand(spectator, allow)} />
          </>
        )}
        {/* A shared device between voters shows the handoff, so the next voter can take it */}
        {gameState.isGameOver && !closed && !voting && !handingOff && (
          <GameOverDialog
            game={game}
            client={client}
            gameState={gameState}
            viewer={playerNumber}
            canRematch={canRematch(gameState, playerNumber) && !gameState.rematchVote}
            onRematch={() => gameService.requestRematch()}
            onHistory={history.open}
            // Escape in History or the QR code closes only that dialog
            onSeeTable={() => { if (!history.dialog && !qrOpen) setClosed(true); }}
            onBack={onBack}
          >
            {rematchVote}
          </GameOverDialog>
        )}
        {/* After See the table the vote shows on its own, with nothing under it to cover */}
        {gameState.isGameOver && closed && !voting && !handingOff && rematchVote}
        {history.dialog}
        {qrOpen && <QrCodeDialog game={game} gameId={gameState.gameId} onClose={() => setQrOpen(false)} />}
      </div>
    </WatchingContext>
  );
}
