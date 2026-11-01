import YouTag from '../../../src/components/YouTag.tsx';
import { MAX_GUESSES } from '../options.ts';
import type { PublicGameState, Seat } from '../types.ts';

type RaceProgressProps = {
  gameState: Pick<PublicGameState, 'activePlayers' | 'playerNames' | 'progress' | 'guessesUsed'>;
  exclude: Seat | null; // my own seat, whose board is shown in full
  viewer: Seat | null;
};

// Each Race board as its guess count and how close its best guess came, never its pegs
export default function RaceProgress({ gameState, exclude, viewer }: RaceProgressProps) {
  const { activePlayers, playerNames, progress, guessesUsed } = gameState;
  const seats = activePlayers.filter(seat => seat !== exclude && progress[seat] !== undefined);
  if (seats.length === 0) return null;
  return (
    <ul className="cb-race" aria-label="Race progress">
      {seats.map(seat => {
        const percent = progress[seat] ?? 0;
        const broken = percent >= 100;
        return (
          <li key={seat} className={`cb-race-row${broken ? ' cb-race-broken' : ''}`}>
            <span className="cb-race-name">{playerNames[seat]}<YouTag when={seat === viewer} /></span>
            <span className="cb-race-count">{guessesUsed[seat] ?? 0} of {MAX_GUESSES}</span>
            <span className="cb-race-percent">{broken ? 'Broken' : `${percent}%`}</span>
            <span className="cb-race-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
          </li>
        );
      })}
    </ul>
  );
}
