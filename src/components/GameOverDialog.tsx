import YouTag from './YouTag.tsx';
import useEscapeKey from '../hooks/useEscapeKey';
import { lengthText, ordinal, winnerLine } from './gameOver.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';

type GameOverDialogProps = {
  game: GameInfo;
  client: ClientGame;
  gameState: BasePublicState;
  viewer: Seat | null;
  canRematch: boolean;
  onRematch?: () => void;
  onHistory: () => void;
  onSeeTable: () => void;
  onBack: () => void;
};

// The same end screen in every game: who won, the final standings, the game's own last round if it has one, and what next
export default function GameOverDialog({
  game, client, gameState, viewer, canRematch, onRematch, onHistory, onSeeTable, onBack
}: GameOverDialogProps) {
  useEscapeKey(onSeeTable);
  const { FinalRound } = client;

  return (
    <div className="overlay game-over-overlay">
      <div className="modal game-over" role="dialog" aria-label="Game over">
        <h2>{winnerLine(gameState)}</h2>
        <div className="game-over-meta">{`${game.name} · Game ${gameState.gameId} · ${lengthText(gameState, client)}`}</div>
        <div className="game-over-body">
          <ol className="game-over-standings">
            {(gameState.standings ?? []).map(({ seat, place, score }) => (
              <li key={seat}>
                <span className="standing-place">{ordinal(place)}</span>{' '}
                <span className="standing-name">{gameState.playerNames[seat]}<YouTag when={seat === viewer} /></span>
                {score !== undefined && <>{' '}<span className="standing-score">{score}</span></>}
              </li>
            ))}
          </ol>
          {FinalRound && <FinalRound gameState={gameState} viewer={viewer} />}
        </div>
        <div className="game-over-actions">
          {canRematch && onRematch && <button type="button" className="primary-button" onClick={onRematch}>Rematch</button>}
          <button type="button" className="primary-button" onClick={onHistory}>History</button>
          <button type="button" className="primary-button" onClick={onSeeTable}>See the table</button>
          <button type="button" className="primary-button" onClick={onBack}>Back to games</button>
        </div>
      </div>
    </div>
  );
}
