import YouTag from '../../../src/components/YouTag.tsx';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { RESOURCES } from '../board.ts';
import { RESOURCE_LABELS, SEAT_SYMBOLS, seatClass } from './layout.ts';
import type { PublicGameState, Seat } from '../types.ts';

// Every player's points, card counts, knights and road, with the award cards, then the bank
export default function PlayerList({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const {
    playerNames, activePlayers, points, handCounts, devCounts, knights, roadLengths, longestRoad, largestArmy, turnHolder, winners,
    bank, devDeckCount, isGameOver
  } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <section className="panel player-list" aria-label="Players">
      <div className="panel-title">Players</div>
      {seats.map(seat => {
        const left = !activePlayers.includes(seat);
        const classNames = ['player-row'];
        if (seat !== viewer) classNames.push('hand-only-hide');
        if (seat === turnHolder && !isGameOver) classNames.push('player-current');
        if (left) classNames.push('player-out');
        let status = '';
        if (winners.includes(seat)) status = 'winner';
        else if (left) status = 'left';
        const hiddenNote = seat !== viewer && !isGameOver ? ' (Victory Point cards are not shown)' : '';
        return (
          <div key={seat} className={classNames.join(' ')}>
            <div className="player-line">
              <span className={`player-swatch ${seatClass(seat)}`} aria-hidden="true"><ColorSymbol color={SEAT_SYMBOLS[seat as Seat]} className="swatch-symbol" /></span>
              <span className="player-name">{playerNames[seat]}<YouTag when={seat === viewer} /></span>
              {status && <span className="player-status">{status}</span>}
              <span className="player-points" title={`Points${hiddenNote}`}>{points[seat] ?? 0} pts</span>
            </div>
            <div className="player-stats">
              <span title="Resource cards">Cards {handCounts[seat] ?? 0}</span>
              <span title="Unplayed development cards">Dev {devCounts[seat] ?? 0}</span>
              <span title="Knights played">Knights {knights[seat] ?? 0}</span>
              <span title="Longest single road">Road {roadLengths[seat] ?? 0}</span>
              {longestRoad === seat && <span className="award">Longest Road</span>}
              {largestArmy === seat && <span className="award">Largest Army</span>}
            </div>
          </div>
        );
      })}
      <div className="bank-line hand-only-hide" aria-label="Bank">
        <span className="bank-title">Bank</span>
        {RESOURCES.map(resource => (
          <span key={resource} className={`bank-count res-${resource}`} title={RESOURCE_LABELS[resource]}>
            {RESOURCE_LABELS[resource]} {bank[resource]}
          </span>
        ))}
        <span className="bank-count" title="Development cards left">Dev {devDeckCount}</span>
      </div>
    </section>
  );
}
