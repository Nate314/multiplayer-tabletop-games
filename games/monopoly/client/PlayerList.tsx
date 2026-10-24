import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { BOARD } from '../board.ts';
import { seatClass, shortName } from './layout.ts';
import type { PublicGameState, Seat } from '../types.ts';

type PlayerListProps = {
  gameState: PublicGameState;
  viewer: Seat | null;
  onSelect?: (space: number) => void;
};

function chipClass(space: number, mortgaged: boolean): string {
  const target = BOARD[space];
  const classNames = ['chip', target.kind === 'street' ? `group-${target.group}` : `chip-${target.kind}`];
  if (mortgaged) classNames.push('chip-mortgaged');
  return classNames.join(' ');
}

// Every player's cash, properties, jail state and cards, in seat order
export default function PlayerList({ gameState, viewer, onSelect }: PlayerListProps) {
  const { playerNames, activePlayers, cash, owners, mortgaged, jailed, jailCards, bankrupt, turnHolder, winners } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <section className="panel player-list" aria-label="Players">
      <div className="panel-title">Players</div>
      {seats.map(seat => {
        const left = !activePlayers.includes(seat);
        const out = bankrupt.includes(seat);
        const properties = Object.keys(owners).map(Number).filter(space => owners[space] === seat).sort((a, b) => a - b);
        const cards = jailCards[seat]?.length ?? 0;
        const classNames = ['player-row'];
        if (seat === turnHolder) classNames.push('player-current');
        if (out || left) classNames.push('player-out');
        let status = '';
        if (winners.includes(seat)) status = 'winner';
        else if (out) status = 'bankrupt';
        else if (left) status = 'left';
        else if (seat in jailed) status = 'in Jail';
        return (
          <div key={seat} className={classNames.join(' ')}>
            <div className="player-line">
              <span className={`token ${seatClass(seat)}`} aria-hidden="true">
                <ColorSymbol color={SEAT_SYMBOLS[seat]} className="token-symbol" />
                <span className="token-initial">{playerNames[seat].slice(0, 1).toUpperCase()}</span>
              </span>
              <span className="player-name">
                {playerNames[seat]}
                {seat === viewer && ' (you)'}
              </span>
              {status && <span className="player-status">{status}</span>}
              <span className="player-cash">${cash[seat] ?? 0}</span>
            </div>
            {(properties.length > 0 || cards > 0) && (
              <div className="player-properties">
                {properties.map(space => {
                  const title = `${BOARD[space].name}${mortgaged.includes(space) ? ' (mortgaged)' : ''}`;
                  return onSelect ? (
                    <button key={space} type="button" className={chipClass(space, mortgaged.includes(space))} title={title}
                      aria-label={title} onClick={() => onSelect(space)}>
                      {shortName(space)}
                    </button>
                  ) : (
                    <span key={space} className={chipClass(space, mortgaged.includes(space))} title={title}>{shortName(space)}</span>
                  );
                })}
                {cards > 0 && <span className="chip chip-card" title="Get Out of Jail Free">Jail card{cards > 1 ? ` x${cards}` : ''}</span>}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
