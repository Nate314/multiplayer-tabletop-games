import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_BOARD, FIVE_SIX_BOARD, boardOf,
  EDGES, EDGE_COUNT, HEX_COUNT, HEX_NEIGHBORS, HEX_RESOURCES, HEX_VERTICES, NUMBER_TOKENS, PORT_EDGES, VERTEX_COUNT,
  VERTEX_HEXES, VERTEX_NEIGHBORS, desertOf, fairNumbers, randomLayout
} from './board.ts';

// The same layout on every run
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1103515245 + 12345) % 2147483648;
    return a / 2147483648;
  };
}

test('the board has 19 hexes, 54 intersections and 72 paths', () => {
  assert.equal(HEX_COUNT, 19);
  assert.equal(VERTEX_COUNT, 54);
  assert.equal(EDGE_COUNT, 72);
  for (const corners of HEX_VERTICES) assert.equal(new Set(corners).size, 6);
  // 18 coast intersections touch one hex, 12 touch two and 24 touch three
  const touching = (n: number) => VERTEX_HEXES.filter(hexes => hexes.length === n).length;
  assert.deepEqual([touching(1), touching(2), touching(3)], [18, 12, 24]);
  for (const neighbors of VERTEX_NEIGHBORS) assert.ok(neighbors.length === 2 || neighbors.length === 3);
  assert.equal(HEX_NEIGHBORS[9].length, 6); // the middle hex
});

test('the 9 ports sit on distinct coast edges with no shared intersection', () => {
  assert.equal(new Set(PORT_EDGES).size, 9);
  const ends = PORT_EDGES.flatMap(edge => EDGES[edge]);
  assert.equal(new Set(ends).size, 18);
  for (const vertex of ends) assert.ok(VERTEX_HEXES[vertex].length <= 2);
});

test('a random layout has the standard mix and no 6 or 8 next to each other', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const layout = randomLayout(seeded(seed));
    assert.deepEqual(layout.hexes.map(hex => hex.resource).sort(), [...HEX_RESOURCES].sort());
    assert.deepEqual(layout.hexes.flatMap(hex => hex.number ?? []).sort((a, b) => a - b), NUMBER_TOKENS);
    assert.equal(layout.hexes[desertOf(layout)].number, null);
    assert.ok(fairNumbers(layout.hexes));
    assert.deepEqual(layout.ports.map(port => port.kind).sort(), ['any', 'any', 'any', 'any', 'brick', 'ore', 'sheep', 'wheat', 'wood']);
  }
});

test('fairNumbers spots a 6 next to an 8', () => {
  const hexes = HEX_RESOURCES.map(() => ({ resource: 'wood' as const, number: 3 }));
  hexes[9] = { resource: 'wood', number: 6 };
  assert.ok(fairNumbers(hexes));
  hexes[HEX_NEIGHBORS[9][0]] = { resource: 'wood', number: 8 };
  assert.equal(fairNumbers(hexes), false);
});

test('the 5-6 player board has 30 hexes, 80 intersections and 109 paths', () => {
  const b = FIVE_SIX_BOARD;
  assert.deepEqual([b.hexCount, b.vertexCount, b.edgeCount], [30, 80, 109]);
  const touching = (n: number) => b.vertexHexes.filter(hexes => hexes.length === n).length;
  assert.deepEqual([touching(1), touching(2), touching(3)], [22, 16, 42]);
  for (const neighbors of b.vertexNeighbors) assert.ok(neighbors.length === 2 || neighbors.length === 3);
  assert.equal(b.hexNeighbors.filter(n => n.length === 6).length, 14);
});
test('the 11 ports of the 5-6 player board sit on distinct coast edges with no shared intersection', () => {
  assert.equal(new Set(FIVE_SIX_BOARD.portEdges).size, 11);
  const ends = FIVE_SIX_BOARD.portEdges.flatMap(edge => FIVE_SIX_BOARD.edges[edge]);
  assert.equal(new Set(ends).size, 22);
  for (const vertex of ends) assert.ok(FIVE_SIX_BOARD.vertexHexes[vertex].length <= 2);
});
test('a 5-6 player random layout has the extension mix, two deserts and no 6 or 8 next to each other', () => {
  const sorted = <T extends string | number | null>(values: T[]) => [...values].sort((a, b) => String(a).localeCompare(String(b)));
  for (let seed = 1; seed <= 20; seed++) {
    const layout = randomLayout(seeded(seed), FIVE_SIX_BOARD);
    assert.deepEqual(sorted(layout.hexes.map(hex => hex.resource)), sorted(FIVE_SIX_BOARD.hexResources));
    const deserts = layout.hexes.filter(hex => hex.resource === null);
    assert.equal(deserts.length, 2);
    for (const desert of deserts) assert.equal(desert.number, null);
    assert.deepEqual(layout.hexes.flatMap(hex => hex.number === null ? [] : [hex.number]).sort((a, b) => a - b),
      [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12]);
    assert.deepEqual(sorted(layout.ports.map(port => port.kind)),
      ['any', 'any', 'any', 'any', 'any', 'brick', 'ore', 'sheep', 'sheep', 'wheat', 'wood']);
    assert.deepEqual(layout.ports.map(port => port.edge), FIVE_SIX_BOARD.portEdges);
    assert.ok(fairNumbers(layout.hexes));
  }
});
test('boardOf picks the board by hex count', () => {
  assert.equal(boardOf(randomLayout(seeded(1))), BASE_BOARD);
  assert.equal(boardOf(randomLayout(seeded(1), FIVE_SIX_BOARD)), FIVE_SIX_BOARD);
});
test('the base board keeps its ids', () => {
  assert.equal(HEX_VERTICES, BASE_BOARD.hexVertices);
  assert.deepEqual(BASE_BOARD.centers[9], { x: 0, y: 0 }); // the middle hex
});
