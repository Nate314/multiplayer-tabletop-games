import type { ReactNode } from 'react';
import type { PuzzleMode } from '../../../shared/puzzleModes.ts';
import type { PublicGameState, Seat } from '../types.ts';

type SidePanelProps = {
  gameState: PublicGameState;
  mode: PuzzleMode;
  pictureUrl: string;
  placed: number;
  total: number;
  guide: boolean;
  onGuide(show: boolean): void;
  undo: { label: string; disabled: boolean; onClick(): void };
  error: string | null;
  children?: ReactNode; // the lobby's picture picker
};

function PlayerRows({ seats, names, value }: { seats: Seat[]; names: Record<Seat, string>; value(seat: Seat): string }) {
  return (
    <ul className="jigsaw-players">
      {seats.map(seat => (
        <li key={seat} style={{ borderColor: `var(--player${seat})` }}>
          <span>{names[seat]}</span> <span>{value(seat)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SidePanel({ gameState, mode, pictureUrl, placed, total, guide, onGuide, undo, error, children }: SidePanelProps) {
  const { activePlayers, playerNames, progress, contributions, gameStatus } = gameState;
  return (
    <aside className="jigsaw-side">
      {(error || gameStatus) && <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>}
      <img className="jigsaw-preview" src={pictureUrl} alt="The picture" />
      {children}
      <label className="jigsaw-guide-toggle">
        <input type="checkbox" checked={guide} onChange={event => onGuide(event.currentTarget.checked)} />
        Show picture guide
      </label>
      <p className="jigsaw-count">{placed} of {total} placed</p>
      {mode === 'race' && <PlayerRows seats={activePlayers} names={playerNames} value={seat => `${progress[seat] ?? 0}%`} />}
      {mode === 'together' && <PlayerRows seats={activePlayers} names={playerNames} value={seat => String(contributions[seat] ?? 0)} />}
      <button type="button" disabled={undo.disabled} onClick={undo.onClick}>{undo.label}</button>
    </aside>
  );
}
