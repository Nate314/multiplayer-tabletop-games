import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import gameService from '../../../src/services/gameService';
import TableArea from './TableArea';
import { allowDrop } from './dragDrop.ts';
import Tile from './Tile';
import { moveTo, resetDraft, sortRack, splitGroup } from './draft.ts';
import { useLocalSlides } from './useLocalSlides.ts';
import { checkPlay, tileName } from '../rules.ts';
import type { Draft, Held, Target } from './draft.ts';
import type { PublicGameState, Seat } from '../types.ts';

type PlayAreaProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  isMyTurn: boolean;
  initialRack: number[]; // the rack in the order last shown
  onRackOrder: (order: number[]) => void;
};

const sameTable = (a: number[][], b: number[][]) => JSON.stringify(a) === JSON.stringify(b);

// The table and the player's rack. During their turn the player rearranges both here and sends the result as one play;
// nobody else sees it until then. The game screen remounts this after every move, so a draft never outlives its turn.
export default function PlayArea({ gameState, playerNumber, isMyTurn, initialRack, onRackOrder }: PlayAreaProps) {
  const { table, rack, melded, lastMove, poolCount, playerNames, currentPlayer } = gameState;
  const rootRef = useRef<HTMLDivElement>(null);
  const captureSlides = useLocalSlides(rootRef);
  const [draft, setDraft] = useState<Draft>({ table, rack: initialRack });
  const [held, setHeld] = useState<Held | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const committed = new Set(table.flat());
  const changed = !sameTable(draft.table, table);
  const check = changed ? checkPlay(table, melded.includes(playerNumber), rack, draft.table) : null;
  const highlighted = lastMove?.type === 'play' && lastMove.playerNumber !== playerNumber ? lastMove.added : [];

  function update(next: Draft) {
    captureSlides();
    setDraft(next);
    setHeld(null);
    setHint(null);
    onRackOrder(next.rack);
  }

  function place(target: Target, holding: Held | null = held) {
    if (!holding) return;
    const onRack = target.kind === 'rack' || (target.kind === 'before' && draft.rack.includes(target.id));
    if (!isMyTurn && !onRack) {
      setHint('Wait for your turn to put tiles on the table');
      return;
    }
    const result = moveTo(draft, holding, target, committed);
    if ('error' in result) {
      setHint(result.error);
      setHeld(null);
    } else update(result.state);
  }

  // A click picks a tile up, drops the held one in front of it, or puts it back down
  function clickTile(id: number) {
    if (held?.kind === 'tile' && held.id === id) setHeld(null);
    else if (held) place({ kind: 'before', id });
    else setHeld({ kind: 'tile', id });
    setHint(null);
  }

  function dragStart(event: DragEvent, holding: Held) {
    event.dataTransfer.setData('text/plain', 'rummikub');
    event.dataTransfer.effectAllowed = 'move';
    setHeld(holding);
  }

  function drop(event: DragEvent, target: Target) {
    event.preventDefault();
    event.stopPropagation();
    place(target);
  }

  const edit = isMyTurn ? {
    held,
    onTile: clickTile,
    onTarget: (target: Target) => place(target),
    onPickGroup: (index: number) => setHeld(held?.kind === 'group' && held.index === index ? null : { kind: 'group', index }),
    onSplit: (index: number, at: number) => update(splitGroup(draft, index, at)),
    onDragStart: dragStart,
    onDrop: drop
  } : undefined;

  const holdingRackTile = held?.kind === 'tile' && !committed.has(held.id);
  let message = hint;
  if (!message && held) {
    message = held.kind === 'tile' && !isMyTurn
      ? `Holding ${tileName(held.id)}: click a rack tile to put it in front of, or the end of the rack`
      : 'Click a tile to put it in front of, the + at the end of a group, or New group. Click it again to put it down.';
  } else if (!message && check && 'error' in check) message = check.error;
  else if (!message && check && 'state' in check) {
    const count = check.state.added.length;
    message = check.state.meld === null
      ? `Ready to play ${count} ${count === 1 ? 'tile' : 'tiles'}`
      : `First meld of ${check.state.meld} points: ready to play`;
  } else if (!message && isMyTurn) {
    message = melded.includes(playerNumber)
      ? 'Your turn: add tiles from your rack to the table, rearranging it as you like, then click Play. Or draw a tile.'
      : 'Your turn: lay down sets and runs worth 30 or more from your rack, then click Play. Or draw a tile.';
  } else if (!message && currentPlayer !== null) {
    message = `Waiting for ${playerNames[currentPlayer]}. You can sort and arrange your rack.`;
  }
  const isError = hint !== null || (check !== null && 'error' in check);

  return (
    <div className={isMyTurn ? 'rk-play-area' : 'rk-play-area rk-play-area-waiting'} ref={rootRef}>
      <TableArea table={isMyTurn ? draft.table : table} highlighted={highlighted} edit={edit} />

      <section
        className="rk-rack-area"
        aria-label="Your rack"
        onDragOver={allowDrop}
        onDrop={event => drop(event, { kind: 'rack' })}
      >
        <header className="rk-rack-header">
          <span>Your rack ({draft.rack.length})</span>
          <span className="rk-sort">
            Sort:
            <button type="button" onClick={() => update({ ...draft, rack: sortRack(draft.rack, 'color') })}>Color</button>
            <button type="button" onClick={() => update({ ...draft, rack: sortRack(draft.rack, 'number') })}>Number</button>
          </span>
        </header>
        <div className="rk-rack">
          {draft.rack.map(id => (
            <button
              key={id}
              type="button"
              className={held?.kind === 'tile' && held.id === id ? 'rk-tile-button rk-held' : 'rk-tile-button'}
              aria-label={tileName(id)}
              draggable
              onDragStart={event => dragStart(event, { kind: 'tile', id })}
              onDragOver={allowDrop}
              onDrop={event => drop(event, { kind: 'before', id })}
              onClick={() => clickTile(id)}
            >
              <Tile id={id} />
            </button>
          ))}
          {holdingRackTile && (
            <button type="button" className="rk-rack-end" onClick={() => place({ kind: 'rack' })}>End of rack</button>
          )}
        </div>
      </section>

      <div className={isError ? 'rk-hint rk-hint-error' : 'rk-hint'} role="status">{message}</div>
      <div className="rk-turn-buttons">
        <button
          type="button"
          className="rk-play-button"
          disabled={!isMyTurn || !check || 'error' in check}
          onClick={() => gameService.makeMove({ type: 'play', table: draft.table })}
        >
          Play
        </button>
        <button type="button" disabled={!isMyTurn || !changed} onClick={() => update(resetDraft(table, draft))}>Reset</button>
        <button
          type="button"
          disabled={!isMyTurn}
          title={changed ? 'Drawing puts the table back as it was' : undefined}
          onClick={() => gameService.makeMove({ type: 'draw' })}
        >
          {poolCount > 0 ? 'Draw a tile' : 'Pass'}
        </button>
      </div>
    </div>
  );
}
