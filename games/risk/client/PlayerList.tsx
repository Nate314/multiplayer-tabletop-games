import { setValue } from '../cards.ts';
import { continentsHeld, reinforcementsFor, territoriesHeld } from '../state.ts';
import { continentShort, seatClass } from './layout.ts';
import type { PublicGameState, Seat } from '../types.ts';

// Every player's territories, armies, cards, whole continents and next reinforcement, in seat order
export default function PlayerList({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, activePlayers, eliminated, winners, turnHolder, handCounts, armies, owners, tradeCount, deckCount } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);
  const neutral = Object.keys(owners).filter(id => owners[id] === null);

  return (
    <section className="panel player-list" aria-label="Players">
      <div className="panel-title">Players</div>
      {seats.map(seat => {
        const held = territoriesHeld(gameState, seat);
        const total = held.reduce((sum, id) => sum + (armies[id] ?? 0), 0);
        const continents = continentsHeld(gameState, seat);
        let status = '';
        if (winners.includes(seat)) status = 'winner';
        else if (!activePlayers.includes(seat)) status = 'left';
        else if (eliminated.includes(seat)) status = 'eliminated';
        const classNames = ['player-row'];
        if (seat === turnHolder) classNames.push('player-current');
        if (status === 'left' || status === 'eliminated') classNames.push('player-out');
        return (
          <div key={seat} className={classNames.join(' ')}>
            <div className="player-line">
              <span className={`swatch ${seatClass(seat)}`} aria-hidden="true" />
              <span className="player-name">{playerNames[seat]}{seat === viewer && ' (you)'}</span>
              {status && <span className="player-status">{status}</span>}
            </div>
            <div className="player-stats">
              <span>{held.length} territories</span>
              <span>{total} armies</span>
              <span>{handCounts[seat] ?? 0} cards</span>
              {held.length > 0 && !status && <span>+{reinforcementsFor(gameState, seat)} a turn</span>}
            </div>
            {continents.length > 0 && (
              <div className="player-continents">{continents.map(id => <span key={id} className="chip">{continentShort(id)}</span>)}</div>
            )}
          </div>
        );
      })}
      {neutral.length > 0 && (
        <div className="player-row">
          <div className="player-line">
            <span className="swatch seat-neutral" aria-hidden="true" />
            <span className="player-name">Neutral</span>
          </div>
          <div className="player-stats">
            <span>{neutral.length} territories</span>
            <span>{neutral.reduce((sum, id) => sum + (armies[id] ?? 0), 0)} armies</span>
          </div>
        </div>
      )}
      <div className="deck-line">Next set: {setValue(tradeCount)} armies. Cards in the deck: {deckCount}</div>
    </section>
  );
}
