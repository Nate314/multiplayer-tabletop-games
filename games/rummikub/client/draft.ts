// The table and rack as a player rearranges them during their turn, before the play is sent.
// Pure functions, so the screen only keeps the result in state.
import { COLORS, tileOf } from '../rules.ts';
import type { Result, Table } from '../types.ts';

export type Draft = { table: Table; rack: number[] }; // rack: the tiles still on the rack, in the order shown

// What the player has picked up: one tile, or a whole group by its index on the table
export type Held = { kind: 'tile'; id: number } | { kind: 'group'; index: number };

// Where it goes: in front of a tile (on the table or the rack), at the end of a group, as a new group, or on the rack
export type Target = { kind: 'before'; id: number } | { kind: 'groupEnd'; index: number } | { kind: 'newGroup' } | { kind: 'rack' };

export function heldTiles(draft: Draft, held: Held): number[] {
  return held.kind === 'tile' ? [held.id] : draft.table[held.index] ?? [];
}

const TABLE_TILES_STAY = 'Tiles from the table must stay on the table';

// Moves what is held to the target. `committed` are the tiles on the table at the start of the turn,
// which may move about the table but never to the rack.
export function moveTo(draft: Draft, held: Held, target: Target, committed: ReadonlySet<number>): Result<Draft> {
  const tiles = heldTiles(draft, held);
  if (tiles.length === 0 || (target.kind === 'before' && tiles.includes(target.id))) return { state: draft };
  const toRack = target.kind === 'rack' || (target.kind === 'before' && draft.rack.includes(target.id));
  if (toRack && tiles.some(id => committed.has(id))) return { error: TABLE_TILES_STAY };

  // Groups emptied by the move are dropped only at the end, so group indexes keep meaning what was shown
  let table = draft.table.map(group => group.filter(id => !tiles.includes(id)));
  let rack = draft.rack.filter(id => !tiles.includes(id));
  const insertBefore = (list: number[], id: number) => {
    const at = list.indexOf(id);
    return [...list.slice(0, at), ...tiles, ...list.slice(at)];
  };

  if (target.kind === 'rack') rack = [...rack, ...tiles];
  else if (target.kind === 'newGroup') table = [...table, tiles];
  else if (target.kind === 'groupEnd') table = table.map((group, index) => (index === target.index ? [...group, ...tiles] : group));
  else if (rack.includes(target.id)) rack = insertBefore(rack, target.id);
  else table = table.map(group => (group.includes(target.id) ? insertBefore(group, target.id) : group));

  return { state: { table: table.filter(group => group.length > 0), rack } };
}

// Whether what is held may go back to the rack: only tiles put on the table this turn
export function canReturnToRack(draft: Draft, held: Held, committed: ReadonlySet<number>): boolean {
  const tiles = heldTiles(draft, held);
  return tiles.length > 0 && tiles.every(id => !committed.has(id));
}

// The draft, what is held and the message for the player, as clicks and drops change them
export type Interaction = { draft: Draft; held: Held | null; hint: string | null };

const WAIT_FOR_TURN = 'Wait for your turn to put tiles on the table';

// Puts what is held at the target. Off turn, only the rack can be rearranged.
export function placeHeld(state: Interaction, target: Target, committed: ReadonlySet<number>, isMyTurn: boolean): Interaction {
  if (!state.held) return state;
  const onRack = target.kind === 'rack' || (target.kind === 'before' && state.draft.rack.includes(target.id));
  if (!isMyTurn && !onRack) return { ...state, hint: WAIT_FOR_TURN };
  const result = moveTo(state.draft, state.held, target, committed);
  if ('error' in result) return { ...state, held: null, hint: result.error };
  return { draft: result.state, held: null, hint: null };
}

// A click picks a tile up, puts it down again, or drops the held tile or group in front of the clicked tile
export function clickTile(state: Interaction, id: number, committed: ReadonlySet<number>, isMyTurn: boolean): Interaction {
  if (state.held?.kind === 'tile' && state.held.id === id) return { ...state, held: null, hint: null };
  if (state.held) return placeHeld(state, { kind: 'before', id }, committed, isMyTurn);
  return { ...state, held: { kind: 'tile', id }, hint: null };
}

// Splits a group in two before its tile at `at`
export function splitGroup(draft: Draft, index: number, at: number): Draft {
  const group = draft.table[index];
  if (!group || at <= 0 || at >= group.length) return draft;
  const table = [...draft.table.slice(0, index), group.slice(0, at), group.slice(at), ...draft.table.slice(index + 1)];
  return { ...draft, table };
}

// The table as it was at the start of the turn; the tiles placed this turn go back to the end of the rack
export function resetDraft(committedTable: Table, draft: Draft): Draft {
  const committed = new Set(committedTable.flat());
  const placed = draft.table.flat().filter(id => !committed.has(id));
  return { table: committedTable, rack: [...draft.rack, ...placed] };
}

// The rack in the order last shown, with any newly drawn tiles at the end
export function rackOrder(rack: number[], remembered: number[]): number[] {
  return [...remembered.filter(id => rack.includes(id)), ...rack.filter(id => !remembered.includes(id))];
}

// Jokers go last
function sortKey(id: number, by: 'color' | 'number'): number[] {
  const tile = tileOf(id);
  if (tile.kind === 'joker') return [99, 99, id];
  const color = COLORS.indexOf(tile.color);
  return by === 'color' ? [color, tile.value, id] : [tile.value, color, id];
}

export function sortRack(rack: number[], by: 'color' | 'number'): number[] {
  return [...rack].sort((a, b) => {
    const [x, y] = [sortKey(a, by), sortKey(b, by)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
}
