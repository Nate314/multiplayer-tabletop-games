import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLS, DOORS, PASSAGES, ROOM_CELLS, ROWS, STARTS, isCorridor, roomAt } from './board.ts';
import type { Cell } from './board.ts';
import { ROOMS, SUSPECTS } from './content.ts';
import type { RoomId } from './content.ts';

const key = (c: Cell) => `${c.row},${c.col}`;
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const neighbours = (c: Cell): Cell[] => NEIGHBOURS.map(([r, d]) => ({ row: c.row + r, col: c.col + d }));

test('every door opens from its room onto a corridor cell', () => {
  for (const { room, outside } of DOORS) {
    assert.ok(isCorridor(outside), `${room} door outside`);
    assert.ok(neighbours(outside).some(n => ROOM_CELLS[room].some(c => key(c) === key(n))), `${room} door touches room`);
  }
});

test('every room has one to four doors and every start is an edge corridor cell', () => {
  assert.ok(ROWS <= 25 && COLS <= 25);
  for (const { id } of ROOMS) {
    const n = DOORS.filter(d => d.room === id).length;
    assert.ok(n >= 1 && n <= 4, id);
    assert.ok(ROOM_CELLS[id].every(c => roomAt(c) === id));
  }
  for (const { id } of SUSPECTS) {
    const c = STARTS[id];
    assert.ok(isCorridor(c));
    assert.ok(c.row === 0 || c.col === 0 || c.row === ROWS - 1 || c.col === COLS - 1, id);
  }
  assert.equal(new Set(SUSPECTS.map(s => key(STARTS[s.id]))).size, 6);
});

test('two passage pairs join diagonally opposite corner rooms', () => {
  assert.equal(Object.keys(PASSAGES).length, 4);
  const corner = (r: RoomId) => ROOM_CELLS[r][0];
  for (const [from, to] of Object.entries(PASSAGES) as [RoomId, RoomId][]) {
    assert.equal(PASSAGES[to], from);
    const a = corner(from), b = corner(to);
    assert.ok(Math.abs(a.row - b.row) > ROWS / 2 && Math.abs(a.col - b.col) > COLS / 2);
  }
});

test('every room is reachable from every start', () => {
  for (const { id } of SUSPECTS) {
    const seen = new Set([key(STARTS[id])]);
    const queue = [STARTS[id]];
    const rooms = new Set<RoomId>();
    for (const c of queue) {
      for (const n of neighbours(c)) {
        if (isCorridor(n) && !seen.has(key(n))) { seen.add(key(n)); queue.push(n); }
      }
      for (const d of DOORS) if (key(d.outside) === key(c)) rooms.add(d.room);
    }
    assert.equal(rooms.size, 9, id);
  }
});
