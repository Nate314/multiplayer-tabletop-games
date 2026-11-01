import type { RaceProgress as Progress } from '../../../shared/puzzleModes.ts';
import type { Seat } from '../../../shared/types.ts';

type RaceProgressProps = {
  progress: Progress;
  playerNames: Record<Seat, string>;
  viewer: Seat | null; // left out of the list, since their own board is in view
};

// How much of the puzzle every other racer has filled in, wrong or not
export default function RaceProgress({ progress, playerNames, viewer }: RaceProgressProps) {
  const seats = Object.keys(progress).map(Number).filter(seat => seat !== viewer).sort((a, b) => a - b);
  if (seats.length === 0) return null;
  return (
    <ul className="race-progress" aria-label="Race progress">
      {seats.map(seat => (
        <li key={seat}>
          {`${playerNames[seat]} ${progress[seat]}%`}
          <span className="race-bar" aria-hidden="true"><span style={{ width: `${progress[seat]}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}
