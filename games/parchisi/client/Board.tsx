import Pawn from './Pawn';
import { CENTER_AREA, HOME_COLUMN, SEATS, TRACK_CELLS, cellKey, cellOf, cellPlacement, gridPlacement, nestArea } from './geometry.ts';
import { dieLabel } from './dice.ts';
import { HOME, NEST, PAWN_COUNT, entryIndex, getLegalMoves, isSafe, sideOf } from '../rules.ts';
import type { Cell } from './geometry.ts';
import type { LegalMove, Move, PawnRef, PublicGameState, Seat } from '../types.ts';

const HOME_KEY = 'home';

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

  // A click on a destination moves; a click on one of your movable pawns selects it, or clears it if already selected
  function handleClick(key: string, there: PawnRef[]) {
    const options = destinations.get(key);
    if (options) {
      onMove({ type: 'move', pawn: options[0].pawn, die: options[0].die });
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

  function renderSquare(cell: Cell, extra: string[]) {
    const key = cellKey(cell);
    const there = pawnsByCell.get(key) ?? [];
    return (
      <div key={key} className={squareClass(cell, extra)} style={cellPlacement(cell)} onClick={() => handleClick(key, there)}>
        {there.map(renderPawn)}
        {renderBadge(key)}
      </div>
    );
  }

  const entrySeats = new Map(SEATS.map(seat => [entryIndex(seat), seat]));

  return (
    <div className={`board ${isMyTurn ? '' : 'not-your-turn'} ${isGameOver ? 'game-over' : ''}`}>
      {SEATS.map(seat => {
        const nestPawns = (pawns[seat] ?? []).flatMap((progress, pawn) => progress === NEST ? [{ seat, pawn }] : []);
        const classNames = ['nest', `player${seat}`];
        if (!activePlayers.includes(seat)) classNames.push('empty-seat');
        if (lastMove?.playerNumber === seat && lastMove.from === NEST) classNames.push('last-move-from');
        if (lastMove?.captured?.seat === seat) classNames.push('last-move-to');
        return (
          <div key={`nest-${seat}`} className={classNames.join(' ')} style={gridPlacement(nestArea(seat))} onClick={() => handleClick('', nestPawns)}>
            <span className="nest-name">{playerNames[seat] ?? ''}</span>
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
      {SEATS.flatMap(seat => HOME_COLUMN.map(progress => renderSquare(cellOf(seat, progress)!, ['home-lane', `player${seat}`])))}
      <div
        className={[
          'center',
          destinations.has(HOME_KEY) ? 'destination' : '',
          lastMove?.to === HOME ? 'last-move-to' : ''
        ].join(' ')}
        style={gridPlacement(CENTER_AREA)}
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
