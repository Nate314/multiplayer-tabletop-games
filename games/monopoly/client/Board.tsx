import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { BOARD, HOTEL, JAIL, ownable } from '../board.ts';
import { DECKS, DECK_NAMES } from '../cards.ts';
import { freeParkingJackpot } from '../options.ts';
import { gridPosition, seatClass, shortName, sideOf, tokenKey } from './layout.ts';
import Dice from './Dice';
import type { PublicGameState, Seat } from '../types.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { DISC_URL } from '../../../src/components/pieces.ts';
import { svgUrl } from '../../../src/assets/svgCache.ts';

type BoardProps = {
  gameState: PublicGameState;
  selected?: number | null;
  onSelect?: (space: number) => void;
  highlight?: number | null; // the space the last move ended on
};

// The kinds games/monopoly/svg.ts draws a picture for
const ICONS = new Set(['railroad', 'chance', 'chest', 'tax', 'go', 'parking', 'goToJail', 'jail']);

function iconFor(space: number): string | null {
  const target = BOARD[space];
  if (target.kind === 'utility') return target.name === 'Water Works' ? 'water' : 'electric';
  const kind = target.kind === 'card' ? target.deck : target.kind;
  return ICONS.has(kind) ? kind : null;
}

function Buildings({ level }: { level: number }) {
  if (level === HOTEL) return <span className="hotel" title="Hotel" />;
  return <>{Array.from({ length: level }, (_, index) => <span key={index} className="house" title="House" />)}</>;
}

function Token({ seat, name }: { seat: Seat; name: string }) {
  return (
    <span className={`token ${seatClass(seat)}`} data-anim-key={tokenKey(seat)} title={name}>
      <ServerSvg url={DISC_URL} className="piece-art" />
      <ColorSymbol color={SEAT_SYMBOLS[seat]} className="token-symbol" />
      <span className="token-initial">{name.slice(0, 1).toUpperCase()}</span>
    </span>
  );
}

function Space({ space, gameState, selected, onSelect, highlight }: BoardProps & { space: number }) {
  const { owners, buildings, mortgaged, positions, jailed, playerNames, bankrupt, activePlayers } = gameState;
  const target = BOARD[space];
  const property = ownable(space);
  const owner = owners[space];
  const { row, column } = gridPosition(space);
  const here = activePlayers.filter(seat => !bankrupt.includes(seat) && positions[seat] === space);
  const classNames = ['space', `side-${sideOf(space)}`, `kind-${target.kind}`];
  if (selected === space) classNames.push('space-selected');
  if (highlight === space) classNames.push('space-highlight');
  if (mortgaged.includes(space)) classNames.push('space-mortgaged');

  const tokens = (seats: Seat[]) => seats.map(seat => <Token key={seat} seat={seat} name={playerNames[seat]} />);
  const content = (
    <>
      {target.kind === 'street' && (
        <span className={`color-bar group-${target.group}`}>
          <Buildings level={buildings[space] ?? 0} />
        </span>
      )}
      <span className="space-name">{shortName(space)}</span>
      {iconFor(space) && <ServerSvg url={svgUrl('monopoly-space', iconFor(space)!)} className="space-icon" />}
      {property && owner === undefined && <span className="space-price">${property.price}</span>}
      {target.kind === 'tax' && <span className="space-price">${target.amount}</span>}
      {target.kind === 'parking' && freeParkingJackpot(gameState) && (
        <span className="space-pot">Pot ${gameState.freeParkingPot ?? 0}</span>
      )}
      {owner !== undefined && (
        <span className={`owner-tag ${seatClass(owner)}`}>
          {mortgaged.includes(space) ? 'Mortgaged' : playerNames[owner]}
        </span>
      )}
      {space === JAIL ? (
        <span className="space-tokens jail-tokens">
          {here.some(seat => seat in jailed) && <span className="in-jail">{tokens(here.filter(seat => seat in jailed))}</span>}
          {tokens(here.filter(seat => !(seat in jailed)))}
        </span>
      ) : (
        <span className="space-tokens">{tokens(here)}</span>
      )}
    </>
  );
  const style = { gridRow: row, gridColumn: column };
  const label = `${target.name}${owner !== undefined ? `, owned by ${playerNames[owner]}` : ''}`;
  if (onSelect && property) {
    return (
      <button type="button" className={classNames.join(' ')} style={style} aria-label={label} aria-pressed={selected === space}
        onClick={() => onSelect(space)}>
        {content}
      </button>
    );
  }
  return <div className={classNames.join(' ')} style={style} title={label}>{content}</div>;
}

// The board: every space with its owner, buildings and the tokens on it, and the dice and last card in the middle
export default function Board(props: BoardProps) {
  const { dice, drawnCard, deckCounts, playerNames } = props.gameState;
  return (
    <div className="board">
      {BOARD.map((_, space) => <Space key={space} space={space} {...props} />)}
      <div className="board-center">
        <div className="board-title">MONOPOLY</div>
        <Dice dice={dice} />
        {drawnCard && (
          <div className={`drawn-card deck-${drawnCard.deck}`} aria-live="polite">
            <div className="drawn-card-deck">{DECK_NAMES[drawnCard.deck]} ({playerNames[drawnCard.seat]})</div>
            <div className="drawn-card-text">{DECKS[drawnCard.deck][drawnCard.index].text}</div>
          </div>
        )}
        <div className="deck-counts">Cards left: Chance {deckCounts.chance}, Community Chest {deckCounts.chest}</div>
      </div>
    </div>
  );
}
