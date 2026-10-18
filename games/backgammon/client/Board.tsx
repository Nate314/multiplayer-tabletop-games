import { useState } from 'react';
import { checkerKey } from './animateMove.ts';
import { CHECKER_COLORS, CHECKERS_PER_PLAYER, legalSteps, otherSeat, pointIndex } from '../rules.ts';
import type { From, Move, PublicGameState, Seat, To } from '../types.ts';

// A point shows this many checkers; the outermost one carries the count of a taller stack
const MAX_SHOWN = 5;

// Point numbers from the viewer's side, left to right: their home board is at the bottom right
const TOP_LEFT = [13, 14, 15, 16, 17, 18];
const TOP_RIGHT = [19, 20, 21, 22, 23, 24];
const BOTTOM_LEFT = [12, 11, 10, 9, 8, 7];
const BOTTOM_RIGHT = [6, 5, 4, 3, 2, 1];

type Location = From | To;

// A bear-off that either of two dice can make waits for the player to pick the die
type DieChoice = { from: From; to: To; dice: number[]; moveCount: number };

type BoardProps = {
  gameState: PublicGameState;
  playerNumber: Seat; // 0 for the history, which shows seat 1's side
  isMyTurn: boolean;
  onMove: (move: Move) => void;
};

function Stack({ seat, count, location }: { seat: Seat; count: number; location: Location }) {
  const shown = Math.min(count, MAX_SHOWN);
  return (
    <div className="bg-stack">
      {Array.from({ length: shown }, (_, index) => {
        const outermost = index === shown - 1;
        return (
          <div
            key={index}
            className={`bg-checker ${CHECKER_COLORS[seat]}`}
            data-anim-key={outermost ? checkerKey(location, seat) : undefined}
          >
            {outermost && count > MAX_SHOWN && count}
          </div>
        );
      })}
    </div>
  );
}

export default function Board({ gameState, playerNumber, isMyTurn, onMove }: BoardProps) {
  const [selection, setSelection] = useState<{ from: From; moveCount: number } | null>(null);
  const [choice, setChoice] = useState<DieChoice | null>(null);
  const { points, bar, borneOff, isGameOver, moveCount } = gameState;
  // Rolls and the cube leave nothing to outline on the board
  const lastMove = gameState.lastMove?.type === 'move' ? gameState.lastMove : null;
  const viewer = playerNumber === 2 ? 2 : 1;
  const steps = isMyTurn ? legalSteps(gameState, playerNumber) : [];
  // A selection or a die choice lasts only until the next move, ours or an undo
  const selected = selection?.moveCount === moveCount ? selection.from : null;
  const pendingChoice = isMyTurn && choice?.moveCount === moveCount ? choice : null;
  const targets: Location[] = steps.filter(step => step.from === selected).map(step => step.to);

  // The player picks the die only when two dice reach the same place, which only happens bearing off
  function moveTo(from: From, to: To) {
    const dice = steps.filter(step => step.from === from && step.to === to).map(step => step.die);
    if (dice.length > 1) {
      setChoice({ from, to, dice, moveCount });
      return;
    }
    onMove({ type: 'move', from, to });
    setSelection(null);
  }

  function chooseDie(die: number | null) {
    if (pendingChoice && die !== null) onMove({ type: 'move', from: pendingChoice.from, to: pendingChoice.to, die });
    setChoice(null);
    setSelection(null);
  }

  function handleClick(location: Location) {
    if (!isMyTurn || pendingChoice) return;
    if (selected !== null && location !== 'bar' && targets.includes(location)) {
      moveTo(selected, location);
    } else if (location !== 'off' && location !== selected && steps.some(step => step.from === location)) {
      setSelection({ from: location, moveCount });
    } else {
      setSelection(null);
    }
  }

  // Where the viewer can click: the selected checker, the checkers that can move, and the selected checker's destinations
  function inputClass(location: Location): string {
    if (location === selected) return ' selected';
    if (targets.includes(location)) return ' target';
    return selected === null && steps.some(step => step.from === location) ? ' movable' : '';
  }

  // A bar half or a tray belongs to `owner`; a point (owner null) shows the last move whoever made it
  function lastMoveClass(location: Location, owner: Seat | null): string {
    if (!lastMove || (owner !== null && owner !== lastMove.playerNumber)) return '';
    if (lastMove.from === location) return ' last-from';
    return lastMove.to === location ? ' last-to' : '';
  }

  function renderPoint(number: number, half: 'top' | 'bottom') {
    const index = pointIndex(viewer, number);
    const point = points[index];
    const shade = index % 2 === 0 ? 'even' : 'odd';
    return (
      <div
        key={number}
        className={`bg-point bg-point-${half} ${shade}${inputClass(index)}${lastMoveClass(index, null)}`}
        onClick={() => handleClick(index)}
      >
        <span className="bg-point-label">{number}</span>
        {point && <Stack seat={point.seat} count={point.count} location={index} />}
      </div>
    );
  }

  function renderBar(seat: Seat) {
    const mine = seat === viewer;
    return (
      <div
        className={`bg-bar${mine ? inputClass('bar') : ''}${lastMoveClass('bar', seat)}`}
        onClick={() => mine && handleClick('bar')}
      >
        {bar[seat] > 0 && <Stack seat={seat} count={bar[seat]} location="bar" />}
      </div>
    );
  }

  function renderTray(seat: Seat) {
    const mine = seat === viewer;
    return (
      <div
        className={`bg-tray${mine ? inputClass('off') : ''}${lastMoveClass('off', seat)}`}
        onClick={() => mine && handleClick('off')}
      >
        <span className="bg-point-label">{borneOff[seat]}/{CHECKERS_PER_PLAYER}</span>
        <div className="bg-tray-slabs">
          {Array.from({ length: borneOff[seat] }, (_, index) => (
            <div
              key={index}
              className={`bg-slab ${CHECKER_COLORS[seat]}`}
              data-anim-key={index === borneOff[seat] - 1 ? checkerKey('off', seat) : undefined}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`bg-board${isMyTurn ? '' : ' not-your-turn'}${isGameOver ? ' game-over' : ''}`}>
        <div className="bg-half bg-half-top">
          {TOP_LEFT.map(number => renderPoint(number, 'top'))}
          {renderBar(otherSeat(viewer))}
          {TOP_RIGHT.map(number => renderPoint(number, 'top'))}
          {renderTray(otherSeat(viewer))}
        </div>
        <div className="bg-half bg-half-bottom">
          {BOTTOM_LEFT.map(number => renderPoint(number, 'bottom'))}
          {renderBar(viewer)}
          {BOTTOM_RIGHT.map(number => renderPoint(number, 'bottom'))}
          {renderTray(viewer)}
        </div>
      </div>
      {pendingChoice && (
        <div className="bg-die-choice">
          <span>Bear off with which die?</span>
          {pendingChoice.dice.map(die => (
            <button key={die} type="button" className="bg-button" onClick={() => chooseDie(die)}>{die}</button>
          ))}
          <button type="button" className="bg-button" onClick={() => chooseDie(null)}>Cancel</button>
        </div>
      )}
    </>
  );
}
