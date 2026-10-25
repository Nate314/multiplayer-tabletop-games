import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  DEFAULT_GRIP, MAX_REACH, QUARTER_TURN, anchorWorld, buildWorld, clampTarget, initPhysics, isOut, isResting, onGroundOutside,
  readBlocks, startingTower, stepWorld, toppled,
} from './physics.ts';
import type { Block, Grab, Vec3 } from './types.ts';

const GOLDEN = '658911cf44695f0b917870cddd8e2cd5f7c6fe1fa21f289956a6317f2d1cb588';

before(initPhysics);

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

// Block 22 is the middle of level 7, which runs along Z; local +X is its long axis
const MIDDLE = 22;
const END: Vec3 = [3.75, 0, 0];
const pullOut = (blocks: Block[], id: number): Grab => {
  const block = blocks.find(b => b.id === id)!;
  return { block: id, anchor: END, target: anchorWorld(block, [13.75, 0, 0]) };
};
// Distance the block has travelled along its own long axis
const travel = (start: Block[], now: Block[], id: number) => {
  const from = start.find(b => b.id === id)!.pose.p;
  const axis = anchorWorld(start.find(b => b.id === id)!, [1, 0, 0]).map((v, i) => v - from[i]);
  const to = now.find(b => b.id === id)!.pose.p;
  return axis.reduce((sum, a, i) => sum + a * (to[i] - from[i]), 0);
};

const pulled = (grip: (id: number) => number, steps: number) => {
  const start = startingTower();
  const tower = buildWorld(start, grip);
  stepWorld(tower, pullOut(start, MIDDLE), steps);
  return { start, tower, after: readBlocks(tower, start) };
};
const snapshotAfterPull = () => JSON.stringify(pulled(() => DEFAULT_GRIP, 120).after);

const settle = (blocks: Block[]) => {
  const tower = buildWorld(blocks, () => DEFAULT_GRIP);
  stepWorld(tower, null, 300);
  return readBlocks(tower, blocks);
};

test('the starting tower is 54 blocks in 18 alternating levels inside the footprint', () => {
  const tower = startingTower();
  assert.equal(tower.length, 54);
  assert.deepEqual(new Set(tower.map(b => b.level)).size, 18);
  assert.deepEqual(tower.map(b => b.id), [...Array(54).keys()]);
  assert.deepEqual(tower[0].pose.q, [0, 0, 0, 1]);
  assert.deepEqual(tower[3].pose.q, QUARTER_TURN);
  assert.equal(tower[53].pose.p[1], 1.5 * 17.5);
  assert.ok(tower.every(b => !isOut(b)));
});

test('the tower stands still for 5 seconds with nobody touching it', () => {
  const start = startingTower();
  const tower = buildWorld(start, () => DEFAULT_GRIP);
  stepWorld(tower, null, 300);
  const after = readBlocks(tower, start);
  assert.equal(toppled(start, after, null), false);
  assert.ok(isResting(after));
  assert.deepEqual(after.map(b => [b.id, b.level]), start.map(b => [b.id, b.level]));
});

test('the same pull twice gives byte-identical worlds', () => {
  const first = snapshotAfterPull();
  assert.ok(first.length > 1000);
  assert.equal(first, snapshotAfterPull());
});

test('the pulled world matches the golden hash on every platform', () => {
  assert.equal(sha256(snapshotAfterPull()), GOLDEN);
});

test('a slick middle block comes out in under 4 seconds and the tower stands', () => {
  const start = startingTower();
  const tower = buildWorld(start, id => (id === MIDDLE ? 0.35 : DEFAULT_GRIP));
  const grab = pullOut(start, MIDDLE);
  let steps = 0;
  let now = start;
  while (steps < 240 && !isOut(now.find(b => b.id === MIDDLE)!)) {
    stepWorld(tower, grab, 1);
    now = readBlocks(tower, now);
    steps++;
  }
  assert.ok(isOut(now.find(b => b.id === MIDDLE)!), `still in after ${steps} steps`);
  assert.equal(toppled(start, now, MIDDLE), false);
});

test('a sticky block moves less than a slick one under the same pull', () => {
  const slick = pulled(id => (id === MIDDLE ? 0.35 : DEFAULT_GRIP), 30);
  const sticky = pulled(id => (id === MIDDLE ? 0.65 : DEFAULT_GRIP), 30);
  const slickTravel = travel(slick.start, slick.after, MIDDLE);
  const stickyTravel = travel(sticky.start, sticky.after, MIDDLE);
  assert.ok(slickTravel > 0.1, `slick moved ${slickTravel}`);
  assert.ok(stickyTravel < slickTravel, `sticky ${stickyTravel} vs slick ${slickTravel}`);
});

test('pulling out a bottom-level side block topples nothing, removing the middle and one side of a low level topples the tower', () => {
  const sideGone = startingTower().filter(b => b.id !== 0);
  assert.equal(toppled(sideGone, settle(sideGone), null), false);
  const twoGone = startingTower().filter(b => b.id !== 3 && b.id !== 4);
  assert.equal(toppled(twoGone, settle(twoGone), null), true);
});

test('a block is out once its box clears the footprint, on the ground when it lies low out there, and moving blocks are not at rest', () => {
  const block = startingTower()[3];
  const at = (p: Vec3): Block => ({ ...block, pose: { ...block.pose, p } });
  // Turned a quarter, the block is 2.5 wide along X, so it clears |x| <= 3.75 past x = 5
  assert.equal(isOut(at([4.9, 10, 0])), false);
  assert.equal(isOut(at([5.1, 10, 0])), true);
  assert.equal(onGroundOutside(at([5.1, 10, 0])), false);
  assert.equal(onGroundOutside(at([5.1, 0.75, 0])), true);
  assert.equal(onGroundOutside(at([0, 0.75, 0])), false);
  assert.equal(isResting([{ ...block, v: [0.4, 0, 0], w: [0, 0.04, 0] }]), true);
  assert.equal(isResting([{ ...block, v: [0.6, 0, 0] }]), false);
  assert.equal(isResting([{ ...block, w: [0, 0.06, 0] }]), false);
});

test('a drag target far from the block is clamped to MAX_REACH', () => {
  assert.ok(distance(clampTarget([0, 0, 0], [100, 0, 0]), [0, 0, 0]) <= MAX_REACH + 1e-9);
  assert.deepEqual(clampTarget([1, 2, 3], [2, 2, 3]), [2, 2, 3]);
  const far = clampTarget([1, 2, 3], [1, 2, -100]);
  assert.ok(Math.abs(distance(far, [1, 2, 3]) - MAX_REACH) < 1e-9);
  assert.ok(far[2] < 3);
});

test('a flick pulls hard but never moves the block more than its reach in one tick', () => {
  const start = startingTower();
  const tower = buildWorld(start, () => DEFAULT_GRIP);
  stepWorld(tower, { block: MIDDLE, anchor: END, target: [0, 0, -1000] }, 3);
  const moved = distance(readBlocks(tower, start)[MIDDLE].pose.p, start[MIDDLE].pose.p);
  assert.ok(moved < MAX_REACH, `moved ${moved}`);
});

test('toppled ignores the exempt block and catches a drop of more than 0.75 or a tilt over 30 degrees', () => {
  const start = startingTower();
  const moved = (id: number, change: (b: Block) => Block) => start.map(b => (b.id === id ? change(b) : b));
  const lower = (by: number) => (b: Block): Block => ({ ...b, pose: { ...b.pose, p: [b.pose.p[0], b.pose.p[1] - by, b.pose.p[2]] } });
  // Rotations about X by 20 and 40 degrees, as constants: half-angle sine and cosine
  const tilt = (s: number, c: number) => (b: Block): Block => ({ ...b, pose: { ...b.pose, q: [s, 0, 0, c] } });
  assert.equal(toppled(start, start, null), false);
  assert.equal(toppled(start, moved(10, lower(0.7)), null), false);
  assert.equal(toppled(start, moved(10, lower(0.8)), null), true);
  assert.equal(toppled(start, moved(10, lower(5)), 10), false);
  assert.equal(toppled(start, moved(0, tilt(0.17364817766693033, 0.984807753012208)), null), false);
  assert.equal(toppled(start, moved(0, tilt(0.3420201433256687, 0.9396926207859084)), null), true);
  assert.equal(toppled(start, moved(0, tilt(0.3420201433256687, 0.9396926207859084)), 0), false);
  // A block in hand is missing from the tower and is not a topple
  assert.equal(toppled(start, start.filter(b => b.id !== 7), null), false);
});
