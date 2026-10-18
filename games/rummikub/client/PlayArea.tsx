import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import gameService from '../../../src/services/gameService';
import Pickable from './Pickable';
import TableArea from './TableArea';
import Tile from './Tile';
import { allowDrop } from './dragDrop.ts';
import { canReturnToRack, clickTile, placeHeld, resetDraft, sortRack, splitGroup } from './draft.ts';
import { useLocalSlides } from './useLocalSlides.ts';
import { checkPlay, tileName } from '../rules.ts';
import type { Draft, Held, Interaction, Target } from './draft.ts';
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
  const [state, setState] = useState<Interaction>({ draft: { table, rack: initialRack }, held: null, hint: null });
  // What is being dragged, known at once; `held` follows a frame later so the drag starts before anything re-renders
  const dragRef = useRef<Held | null>(null);
  const { draft, held, hint } = state;

  const committed = new Set(table.flat());
  const changed = !sameTable(draft.table, table);
  const check = changed ? checkPlay(table, melded.includes(playerNumber), rack, draft.table) : null;
  const highlighted = lastMove?.type === 'play' && lastMove.playerNumber !== playerNumber ? lastMove.added : [];

  function apply(next: Interaction) {
    if (next.draft !== draft) {
      captureSlides();
      onRackOrder(next.draft.rack);
    }
    setState(next);
  }

  const setDraft = (next: Draft) => apply({ draft: next, held: null, hint: null });
  const place = (target: Target) => apply(placeHeld(state, target, committed, isMyTurn));
  const click = (id: number) => apply(clickTile(state, id, committed, isMyTurn));

  function dragStart(event: DragEvent, holding: Held) {
    event.dataTransfer.setData('text/plain', 'rummikub');
    event.dataTransfer.effectAllowed = 'move';
    dragRef.current = holding;
    requestAnimationFrame(() => {
      if (dragRef.current === holding) setState(current => ({ ...current, held: holding, hint: null }));
    });
  }

  function drop(event: DragEvent, target: Target) {
    event.preventDefault();
    event.stopPropagation();
    const holding = dragRef.current ?? held;
    dragRef.current = null;
    if (holding) apply(placeHeld({ ...state, held: holding }, target, committed, isMyTurn));
  }

  // A drag dropped nowhere puts the tile down where it was
  function dragEnd() {
    if (!dragRef.current) return;
    dragRef.current = null;
    setState(current => ({ ...current, held: null }));
  }

  const edit = isMyTurn ? {
    held,
    onTile: click,
    onTarget: place,
    onPickGroup: (index: number) => apply({
      ...state, held: held?.kind === 'group' && held.index === index ? null : { kind: 'group', index }, hint: null
    }),
    onSplit: (index: number, at: number) => setDraft(splitGroup(draft, index, at)),
    onDragStart: dragStart,
    onDragEnd: dragEnd,
    onDrop: drop
  } : undefined;

  const canGoBack = held !== null && canReturnToRack(draft, held, committed);
  let message = hint;
  if (!message && held) {
    message = !isMyTurn
      ? 'Click a rack tile to put the held tile in front of it, or End of rack'
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
  const isError = hint !== null || (held === null && check !== null && 'error' in check);

  return (
    <div className={isMyTurn ? 'rk-play-area' : 'rk-play-area rk-play-area-waiting'} ref={rootRef}>
      <TableArea table={isMyTurn ? draft.table : table} highlighted={highlighted} edit={edit} />

      <section
        className="rk-rack-area"
        aria-label="Your rack"
        onDragEnter={allowDrop}
        onDragOver={allowDrop}
        onDrop={event => drop(event, { kind: 'rack' })}
      >
        <header className="rk-rack-header">
          <span>Your rack ({draft.rack.length})</span>
          <span className="rk-sort">
            Sort:
            <button type="button" onClick={() => setDraft({ ...draft, rack: sortRack(draft.rack, 'color') })}>Color</button>
            <button type="button" onClick={() => setDraft({ ...draft, rack: sortRack(draft.rack, 'number') })}>Number</button>
          </span>
        </header>
        <div className="rk-rack">
          {draft.rack.map(id => (
            <Pickable
              key={id}
              label={tileName(id)}
              className={held?.kind === 'tile' && held.id === id ? 'rk-tile-button rk-held' : 'rk-tile-button'}
              onActivate={() => click(id)}
              onDragStart={event => dragStart(event, { kind: 'tile', id })}
              onDragEnd={dragEnd}
              onDrop={event => drop(event, { kind: 'before', id })}
            >
              <Tile id={id} />
            </Pickable>
          ))}
          <button type="button" className={canGoBack ? 'rk-rack-end' : 'rk-rack-end rk-hidden'} onClick={() => place({ kind: 'rack' })}>
            End of rack
          </button>
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
        <button type="button" disabled={!isMyTurn || !changed} onClick={() => setDraft(resetDraft(table, draft))}>Reset</button>
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
