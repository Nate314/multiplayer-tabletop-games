import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  COAST_DECEL, DEFAULT_GRIP, IDENTITY, MAX_REACH, MAX_SPIN, QUARTER_TURN, SPIN_ACCEL, STEPS_PER_TICK, STEP_S, anchorWorld, buildWorld,
  clampTarget, fromTable, initPhysics, isOut, isResting, onGroundOutside, readBlocks, readTurntable, spinStep, startingTower, stepWorld,
  syncWorld, toTable, toppled,
} from './physics.ts';
import type { Block, Grab, Pose, Quat, Vec3 } from './types.ts';

const GOLDEN = '24001cc3e949dacb3fe84adf9ef8557dc68a60041002ad81f79da372f6677ae8';

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

test('syncing a running world to a server state moves its bodies there and drops blocks taken out', () => {
  const start = startingTower();
  const tower = buildWorld(start, () => DEFAULT_GRIP);
  stepWorld(tower, pullOut(start, MIDDLE), 30);
  // The server's tower: block 22 gone, block 0 nudged and moving
  const server = start.filter(b => b.id !== MIDDLE).map(b => (b.id === 0 ? { ...b, pose: { ...b.pose, p: [0.5, 0.75, -2.5] as Vec3 }, v: [1, 0, 0] as Vec3 } : b));
  assert.equal(syncWorld(tower, server), true);
  assert.equal(tower.bodies.has(MIDDLE), false);
  // The ground, the turntable and 53 blocks
  assert.equal(tower.world.bodies.len(), 55);
  const read = readBlocks(tower, server);
  for (const block of server) assert.ok(distance(read.find(b => b.id === block.id)!.pose.p, block.pose.p) < 1e-4, `block ${block.id}`);
  assert.deepEqual(read.find(b => b.id === 0)!.v, [1, 0, 0]);
  // A block the world has never seen needs a rebuild
  assert.equal(syncWorld(tower, start), false);
  assert.equal(syncWorld(tower, server, { q: QUARTER_TURN, w: 1, drive: null }), true);
  const table = readTurntable(tower, null);
  assert.ok(table.q.every((v, i) => Math.abs(v - QUARTER_TURN[i]) < 1e-6), `turntable at ${table.q}`);
  assert.ok(Math.abs(table.w - 1) < 1e-6);
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

test('spinStep accelerates to the drive, clamps it and coasts to exactly zero', () => {
  assert.equal(spinStep(0, 1), 1);
  assert.equal(spinStep(0, 100), SPIN_ACCEL * STEP_S);
  let w = 0;
  for (let i = 0; i < 200; i++) {
    w = spinStep(w, 100);
    assert.ok(w <= MAX_SPIN, `spin ${w}`);
  }
  assert.equal(w, MAX_SPIN);
  w = 6;
  const steps = Math.ceil(6 / (COAST_DECEL * STEP_S));
  for (let i = 0; i < steps; i++) w = spinStep(w, null);
  assert.equal(w, 0);
  assert.equal(spinStep(w, null), 0);
});

const near = (a: Pose, b: Pose) => [...a.p, ...a.q].every((v, i) => Math.abs(v - [...b.p, ...b.q][i]) < 1e-9);

test('toTable and fromTable undo each other, and the footprint turns with the table', () => {
  const t = QUARTER_TURN;
  for (const block of startingTower()) assert.ok(near(fromTable(toTable(block.pose, t), t), block.pose), `block ${block.id}`);
  const block = startingTower()[1];
  const carried = (by: number, table: Quat): Block => ({ ...block, pose: fromTable({ ...block.pose, p: [by, block.pose.p[1], 0] }, table) });
  assert.equal(isOut(carried(0, t), t), false);
  assert.equal(isOut(carried(10, t), t), true);
  // An eighth turn, as half-angle sine and cosine: 9 along the table's X clears its footprint but not the world's
  const eighth: Quat = [0, 0.3826834323650898, 0, 0.9238795325112867];
  assert.equal(isOut(carried(9, eighth), eighth), true);
  assert.equal(isOut(carried(9, eighth)), false);
});

// Drives the turntable for `ticks` ticks at whatever `drive(tick)` asks, then lets it coast to a stop
const turned = (drive: (tick: number) => number, ticks: number) => {
  const start = startingTower();
  const tower = buildWorld(start, () => DEFAULT_GRIP);
  for (let tick = 0; tick < ticks; tick++) stepWorld(tower, null, STEPS_PER_TICK, drive(tick));
  let guard = 0;
  while (readTurntable(tower, null).w !== 0 && guard++ < 1000) stepWorld(tower, null, STEPS_PER_TICK);
  const table = readTurntable(tower, null);
  return { start, now: readBlocks(tower, start), table };
};

test('a gentle turn carries the tower round with the turntable', () => {
  const { start, now, table } = turned(() => 0.5, 120);
  assert.equal(table.w, 0);
  assert.ok(table.q[1] > 0.4, `turntable at ${table.q}`);
  assert.equal(toppled(start, now, null, IDENTITY, table.q), false);
});

test('jerking the turntable at full speed back and forth topples the tower', () => {
  const { start, now, table } = turned(tick => (Math.floor(tick / 10) % 2 === 0 ? MAX_SPIN : -MAX_SPIN), 200);
  assert.equal(toppled(start, now, null, IDENTITY, table.q), true);
});

test('a turned but undisturbed tower has not toppled', () => {
  const start = startingTower();
  const turnedRound = start.map(b => ({ ...b, pose: fromTable(b.pose, QUARTER_TURN) }));
  assert.equal(toppled(start, turnedRound, null, IDENTITY, QUARTER_TURN), false);
  assert.equal(toppled(start, turnedRound, null), true);
});

test('the tower stands on the turntable at any angle', () => {
  // Half-angle sine and cosine of 0, 10, 30, 45, 60 and 90 degrees about Y
  const angles: [number, number][] = [
    [0, 1], [0.08715574274765817, 0.9961946980917455], [0.25881904510252074, 0.9659258262890683],
    [0.3826834323650898, 0.9238795325112867], [0.5, 0.8660254037844387], [Math.SQRT1_2, Math.SQRT1_2],
  ];
  for (const [s, c] of angles) {
    const q: Quat = [0, s, 0, c];
    const start = startingTower().map(b => ({ ...b, pose: fromTable(b.pose, q) }));
    const tower = buildWorld(start, () => DEFAULT_GRIP, { q, w: 0, drive: null });
    stepWorld(tower, null, 40 * STEPS_PER_TICK);
    const now = readBlocks(tower, start);
    assert.equal(toppled(start, now, null, q, q), false, `toppled at ${q}`);
    assert.ok(now[1].pose.p[1] > 0, `block 1 at ${now[1].pose.p} with the table at ${q}`);
    tower.world.free();
  }
});
