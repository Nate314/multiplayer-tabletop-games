import { boardSeats } from './shown.ts';
import type { PublicGameState, Seat } from '../types.ts';

type BoardPickerProps = {
  gameState: PublicGameState;
  owner: Seat | null;
  onPick: (seat: Seat) => void;
};

// One button per Race board in view, with its player's progress; shown only when there is more than one board to see
export default function BoardPicker({ gameState, owner, onPick }: BoardPickerProps) {
  const seats = boardSeats(gameState);
  if (seats.length < 2) return null;
  return (
    <div className="board-picker" role="group" aria-label="Boards">
      {seats.map(seat => (
        <button key={seat} type="button" className="themed-chip" aria-pressed={seat === owner} onClick={() => onPick(seat)}>
          {`${gameState.playerNames[seat]} ${gameState.progress[seat] ?? 0}%`}
        </button>
      ))}
    </div>
  );
}
