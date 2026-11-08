import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import Pawn from './Pawn';
import { useDrag } from '../../../src/drag/useDrag.ts';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { CENTER_AREA, HOME_COLUMN, SEATS, TRACK_CELLS, cellKey, cellOf, cellPlacement, gridPlacement, nestArea } from './geometry.ts';
import { dieLabel } from './dice.ts';
import { HOME, NEST, PAWN_COUNT, entryIndex, getLegalMoves, isSafe, sideOf } from '../rules.ts';
import type { Cell } from './geometry.ts';
import type { LegalMove, Move, PawnRef, PublicGameState, Seat } from '../types.ts';

const HOME_KEY = 'home';
const PAWN_PREFIX = 'pawn-'; // a pawn's drag id is pawn-<index>
const pawnOf = (id: string) => Number(id.slice(PAWN_PREFIX.length));

type BoardProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  isMyTurn: boolean;
  selectedPawn: number | null;
  onSelectPawn: (pawn: number | null) => void;
  onMove: (move: Move) => void;
};

function destinationKey(seat: Seat, move: LegalMove): string {
  const cell = cellOf(seat, move.to);
  return cell ? cellKey(cell) : HOME_KEY;
}

export default function Board({ gameState, playerNumber, isMyTurn, selectedPawn, onSelectPawn, onMove }: BoardProps) {
  const { pawns, dice, playerNames, activePlayers, lastMove, isGameOver } = gameState;
  const legalMoves = isMyTurn ? getLegalMoves(gameState, playerNumber) : [];
  const movable = new Set(legalMoves.map(move => move.pawn));

  // Every option for the selected pawn, grouped by where it lands; two dice of one value land on the same square
  const destinations = new Map<string, LegalMove[]>();
  for (const move of legalMoves.filter(option => option.pawn === selectedPawn)) {
    const key = destinationKey(playerNumber, move);
    destinations.set(key, [...(destinations.get(key) ?? []), move]);
  }

  const pawnsByCell = new Map<string, PawnRef[]>();
  for (const [seat, progresses] of Object.entries(pawns)) {
    progresses.forEach((progress, pawn) => {
      const cell = cellOf(Number(seat), progress);
      if (!cell) return;
      const key = cellKey(cell);
      pawnsByCell.set(key, [...(pawnsByCell.get(key) ?? []), { seat: Number(seat), pawn }]);
    });
  }

  const lastFrom = lastMove ? cellOf(lastMove.playerNumber, lastMove.from) : null;
  const lastTo = lastMove ? cellOf(lastMove.playerNumber, lastMove.to) : null;

  function isMine(ref: PawnRef): boolean {
    return ref.seat === playerNumber;
  }

  // Sends the first option for a square, by click or drop
  function play(options: LegalMove[]) {
    onMove({ type: 'move', pawn: options[0].pawn, die: options[0].die });
  }

  // The options that land on `key` for the pawn a drag id names, read from the latest render rather than the selection
  const optionsFor = (id: string, key: string) =>
    legalMoves.filter(move => move.pawn === pawnOf(id) && destinationKey(playerNumber, move) === key);
  const drag = useDrag({
    canLift: id => movable.has(pawnOf(id)),
    canDrop: (id, target) => optionsFor(id, target).length > 0,
    onLift: id => onSelectPawn(pawnOf(id)),
    onDrop: (id, target) => play(optionsFor(id, target)),
    onCancel: () => onSelectPawn(null)
  });

  // A click on a destination moves; a click on one of your movable pawns selects it, or clears it if already selected
  function handleClick(key: string, there: PawnRef[]) {
    const options = destinations.get(key);
    if (options) {
      play(options);
      return;
    }
    const mine = there.find(ref => isMine(ref) && movable.has(ref.pawn));
    if (mine) onSelectPawn(mine.pawn === selectedPawn ? null : mine.pawn);
  }

  function renderPawn({ seat, pawn }: PawnRef) {
    const mine = seat === playerNumber && movable.has(pawn);
    return (
      <Pawn
        key={`${seat}-${pawn}`}
        seat={seat}
        pawn={pawn}
        name={playerNames[seat]}
        movable={mine}
        selected={mine && pawn === selectedPawn}
        dragProps={seat === playerNumber ? drag.source(`${PAWN_PREFIX}${pawn}`) : undefined}
      />
    );
  }

  function renderBadge(key: string) {
    const options = destinations.get(key);
    if (!options) return null;
    const labels = new Set(options.map(option => dieLabel(option.die, option.steps, dice)));
    return <span className="destination-badge">{[...labels].join(' / ')}</span>;
  }

  function squareClass(cell: Cell, extra: string[]): string {
    const key = cellKey(cell);
    const classNames = ['square', ...extra];
    if (destinations.has(key)) classNames.push('destination');
    if (lastFrom && cellKey(lastFrom) === key) classNames.push('last-move-from');
    if (lastTo && cellKey(lastTo) === key) classNames.push('last-move-to');
    return classNames.join(' ');
  }

  function renderSquare(cell: Cell, extra: string[], laneSeat?: Seat) {
    const key = cellKey(cell);
    const there = pawnsByCell.get(key) ?? [];
    return (
      <div key={key} className={squareClass(cell, extra)} style={cellPlacement(cell)} data-drop={key} onClick={() => handleClick(key, there)}>
        {laneSeat && <ColorSymbol color={SEAT_SYMBOLS[laneSeat]} className="lane-symbol" />}
        {there.map(renderPawn)}
        {renderBadge(key)}
      </div>
    );
  }

  const entrySeats = new Map(SEATS.map(seat => [entryIndex(seat), seat]));

  return (
    <div className={`board hand-only-board ${isMyTurn ? '' : 'not-your-turn'} ${isGameOver ? 'game-over' : ''}`}>
      {SEATS.map(seat => {
        const nestPawns = (pawns[seat] ?? []).flatMap((progress, pawn) => progress === NEST ? [{ seat, pawn }] : []);
        const classNames = ['nest', `player${seat}`];
        if (!activePlayers.includes(seat)) classNames.push('empty-seat');
        if (lastMove?.playerNumber === seat && lastMove.from === NEST) classNames.push('last-move-from');
        if (lastMove?.captured.some(ref => ref.seat === seat)) classNames.push('last-move-to');
        return (
          <div key={`nest-${seat}`} className={classNames.join(' ')} style={gridPlacement(nestArea(seat))} onClick={() => handleClick('', nestPawns)}>
            <span className="nest-name"><ColorSymbol color={SEAT_SYMBOLS[seat]} className="nest-symbol" /> {playerNames[seat] ?? ''}</span>
            <div className="nest-pawns">{nestPawns.map(renderPawn)}</div>
          </div>
        );
      })}
      {TRACK_CELLS.map((cell, index) => {
        const entrySeat = entrySeats.get(index);
        const extra = ['track'];
        if (isSafe(index)) extra.push('safe');
        if (entrySeat) extra.push('entry', `player${entrySeat}`);
        return renderSquare(cell, extra);
      })}
      {SEATS.flatMap(seat => HOME_COLUMN.map(progress => renderSquare(cellOf(seat, progress)!, ['home-lane', `player${seat}`], seat)))}
      <div
        className={[
          'center',
          destinations.has(HOME_KEY) ? 'destination' : '',
          lastMove?.to === HOME ? 'last-move-to' : ''
        ].join(' ')}
        style={gridPlacement(CENTER_AREA)}
        data-drop={HOME_KEY}
        onClick={() => handleClick(HOME_KEY, [])}
      >
        {SEATS.filter(seat => pawns[seat]).map(seat => (
          <div key={seat} className={`home-pawns side${sideOf(seat)}`}>
            {Array.from({ length: PAWN_COUNT }, (_, pawn) => pawn)
              .filter(pawn => pawns[seat][pawn] === HOME)
              .map(pawn => renderPawn({ seat, pawn }))}
          </div>
        ))}
        {renderBadge(HOME_KEY)}
      </div>
    </div>
  );
}
