import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import type { Block, Grab, Pose, Quat, Turntable, Vec3 } from './types.ts';

// Units are cm, g and s. Determinism needs the same inputs in the same order, and no sin, cos, random or clock
export const BLOCK = { length: 7.5, height: 1.5, width: 2.5 };
export const LEVELS = 18;
export const STEP_S = 1 / 60;
export const STEPS_PER_TICK = 3;
export const PULL_STIFFNESS = 800;
export const PULL_DAMPING = 56;
export const MAX_PULL_FORCE = 600000;
export const MAX_REACH = 3;
export const QUARTER_TURN: Quat = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
export const DEFAULT_GRIP = 0.5;
export const TURNTABLE = { radius: 8, height: 1 };
export const TURNTABLE_FRICTION = 0.6;
export const MAX_SPIN = 10;
export const SPIN_ACCEL = 300;
export const COAST_DECEL = 3;
export const IDENTITY: Quat = [0, 0, 0, 1];
export const REST_TURNTABLE: Turntable = { q: IDENTITY, w: 0, drive: null };

const DENSITY = 0.6;
const GROUND_FRICTION = 0.6;
const CONTACT_HZ = 240;
const SOLVER_ITERATIONS = 16;
const FOOTPRINT = BLOCK.length / 2;
const HALF: Vec3 = [BLOCK.length / 2, BLOCK.height / 2, BLOCK.width / 2];
const REST_SPEED = 0.5;
const REST_SPIN = 0.05;
// cos(15 degrees): a turn of 30 degrees has a half-angle cosine of this
const TILT_DOT = 0.9659258262890683;

let ready: Promise<void> | null = null;
export const initPhysics = () => (ready ??= RAPIER.init());

// Rapier runs in the turntable's frame, so the table never turns in it; turntable is where the table is in the world and its spin
export type TowerWorld = { world: RAPIER.World; bodies: Map<number, RAPIER.RigidBody>; turntable: { q: Quat; w: number } };

export function startingTower(): Block[] {
  const blocks: Block[] = [];
  for (let level = 0; level < LEVELS; level++) {
    const y = BLOCK.height * (level + 0.5);
    for (let slot = 0; slot < 3; slot++) {
      const offset = (slot - 1) * BLOCK.width;
      const pose = level % 2 === 0
        ? { p: [0, y, offset] as Vec3, q: [0, 0, 0, 1] as Quat }
        : { p: [offset, y, 0] as Vec3, q: [...QUARTER_TURN] as Quat };
      blocks.push({ id: blocks.length, level, pose });
    }
  }
  return blocks;
}

const vec = ([x, y, z]: Vec3) => ({ x, y, z });
const arr = ({ x, y, z }: { x: number; y: number; z: number }): Vec3 => [x, y, z];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Vec3) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const capped = (a: Vec3, max: number) => {
  const l = length(a);
  return l > max ? scale(a, max / l) : a;
};

const rotate = ([x, y, z, w]: Quat, v: Vec3): Vec3 => {
  const u: Vec3 = [x, y, z];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, w)), cross(u, t));
};

const conj = ([x, y, z, w]: Quat): Quat => [-x, -y, -z, w];
const multiply = ([ax, ay, az, aw]: Quat, [bx, by, bz, bw]: Quat): Quat => [
  aw * bx + ax * bw + ay * bz - az * by,
  aw * by - ax * bz + ay * bw + az * bx,
  aw * bz + ax * by - ay * bx + az * bw,
  aw * bw - ax * bx - ay * by - az * bz,
];

// World to turntable frame and back, so footprint and topple checks turn with the table
export const toTable = (pose: Pose, table: Quat): Pose => ({ p: rotate(conj(table), pose.p), q: multiply(conj(table), pose.q) });
export const fromTable = (pose: Pose, table: Quat): Pose => ({ p: rotate(table, pose.p), q: multiply(table, pose.q) });

export const anchorWorld = (block: Block, anchor: Vec3) => add(block.pose.p, rotate(block.pose.q, anchor));

export const clampTarget = (anchor: Vec3, target: Vec3) => add(anchor, capped(sub(target, anchor), MAX_REACH));

// Block poses in state are world poses; velocities are relative to the table but in world axes, so a block riding the table is at rest
const intoTable = (body: RAPIER.RigidBody, block: Block, table: Quat, wake: boolean) => {
  const pose = toTable(block.pose, table);
  const [x, y, z, w] = pose.q;
  body.setTranslation(vec(pose.p), wake);
  body.setRotation({ x, y, z, w }, wake);
  body.setLinvel(vec(rotate(conj(table), block.v ?? [0, 0, 0])), wake);
  body.setAngvel(vec(rotate(conj(table), block.w ?? [0, 0, 0])), wake);
};

export function buildWorld(blocks: Block[], grip: (id: number) => number, turntable: Turntable = REST_TURNTABLE): TowerWorld {
  const world = new RAPIER.World({ x: 0, y: -981, z: 0 });
  world.lengthUnit = 100;
  world.timestep = STEP_S;
  // The default soft contacts (30 Hz, 4 iterations) squash an 18-level stack by 3 cm; stiffer contacts need more iterations
  world.integrationParameters.contact_natural_frequency = CONTACT_HZ;
  world.numSolverIterations = SOLVER_ITERATIONS;
  // A kinematic ground that never moves: contacts with a fixed body ignore the contact frequency and let the tower sink
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -1 - TURNTABLE.height, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, 1, 100).setFriction(GROUND_FRICTION), ground);
  // The turntable, top at y = 0, is kinematic and still for the same reason; created first so it has the same body handle in every world
  const table = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -TURNTABLE.height / 2, 0));
  world.createCollider(RAPIER.ColliderDesc.cylinder(TURNTABLE.height / 2, TURNTABLE.radius).setFriction(TURNTABLE_FRICTION), table);
  const bodies = new Map<number, RAPIER.RigidBody>();
  for (const block of blocks) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
    intoTable(body, block, turntable.q, true);
    world.createCollider(RAPIER.ColliderDesc.cuboid(...HALF).setDensity(DENSITY).setFriction(grip(block.id)), body);
    bodies.set(block.id, body);
  }
  return { world, bodies, turntable: { q: [...turntable.q], w: turntable.w } };
}

// The turntable's spin after one step: toward the clamped drive at SPIN_ACCEL, or coasting toward 0 at COAST_DECEL
export function spinStep(w: number, drive: number | null): number {
  const target = drive === null ? 0 : Math.min(MAX_SPIN, Math.max(-MAX_SPIN, drive));
  const most = (drive === null ? COAST_DECEL : SPIN_ACCEL) * STEP_S;
  // The slack absorbs rounding left over from earlier steps, so a coast ends on exactly 0 instead of a step later
  return Math.abs(target - w) <= most * (1 + 1e-9) ? target : w + Math.sign(target - w) * most;
}

export const readTurntable = (tower: TowerWorld, drive: number | null): Turntable => ({ q: [...tower.turntable.q], w: tower.turntable.w, drive });

// A spring from the anchor to the target, damped by the anchor's speed. Clamping the target to MAX_REACH is what bounds
// a flick (spring at most about 0.4 N); MAX_PULL_FORCE (6 N) is only a backstop and does not bind in normal play
function pull(body: RAPIER.RigidBody, grab: Grab, table: Quat) {
  const center = arr(body.translation());
  const r = body.rotation();
  const anchor = add(center, rotate([r.x, r.y, r.z, r.w], grab.anchor));
  // The target comes in world coordinates and the body lives in the table's frame
  const goal = rotate(conj(table), grab.target);
  const target = clampTarget(anchor, [goal[0], anchor[1], goal[2]]);
  const speed = add(arr(body.linvel()), cross(arr(body.angvel()), sub(anchor, center)));
  const mass = body.mass();
  const force = capped(sub(scale(sub(target, anchor), PULL_STIFFNESS * mass), scale(speed, PULL_DAMPING * mass)), MAX_PULL_FORCE);
  body.applyImpulseAtPoint(vec(scale(force, STEP_S)), vec(anchor), true);
}

// The rotating frame's fictitious forces on each block: Euler -m (alpha x r), centrifugal m w^2 r across Y, Coriolis -2m (omega x v)
function spinForces(tower: TowerWorld, w: number, alpha: number) {
  for (const body of tower.bodies.values()) {
    const [x, , z] = arr(body.translation());
    const [vx, , vz] = arr(body.linvel());
    const m = body.mass();
    body.addForce({ x: m * (-alpha * z + w * w * x - 2 * w * vz), y: 0, z: m * (alpha * x + w * w * z + 2 * w * vx) }, true);
  }
}

export function stepWorld(tower: TowerWorld, grab: Grab | null, steps: number, drive: number | null = null) {
  const body = grab && tower.bodies.get(grab.block);
  const table = tower.turntable;
  for (let i = 0; i < steps; i++) {
    const w = spinStep(table.w, drive);
    const alpha = (w - table.w) / STEP_S;
    table.w = w;
    const spinning = w !== 0 || alpha !== 0;
    if (spinning) {
      // First-order turn by w * STEP_S about +Y, normalized so it stays a unit quaternion without trig
      const turn = multiply([0, w, 0, 0], table.q);
      const q = table.q.map((v, j) => v + 0.5 * STEP_S * turn[j]);
      const size = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
      table.q = q.map(v => v / size) as Quat;
      spinForces(tower, w, alpha);
    }
    if (grab && body) pull(body, grab, table.q);
    tower.world.step();
    // Rapier keeps added forces until reset, and the next step's spin needs its own
    if (spinning) for (const block of tower.bodies.values()) block.resetForces(false);
  }
}

// Moves a running world's bodies to `blocks` instead of rebuilding it; false when a block has no body yet and only a rebuild will do
export function syncWorld(tower: TowerWorld, blocks: Block[], turntable: Turntable = REST_TURNTABLE): boolean {
  if (blocks.some(block => !tower.bodies.has(block.id))) return false;
  tower.turntable = { q: [...turntable.q], w: turntable.w };
  const shown = new Set(blocks.map(block => block.id));
  for (const [id, body] of tower.bodies) {
    if (shown.has(id)) continue;
    tower.world.removeRigidBody(body);
    tower.bodies.delete(id);
  }
  for (const block of blocks) {
    const body = tower.bodies.get(block.id)!;
    // Views send velocities only for moving blocks, so a missing one is at rest
    intoTable(body, block, turntable.q, !!(block.v || block.w) || turntable.w !== 0);
  }
  return true;
}

export function readBlocks(tower: TowerWorld, previous: Block[]): Block[] {
  const table = tower.turntable.q;
  return previous.map(block => {
    const body = tower.bodies.get(block.id);
    if (!body) return block;
    const { x, y, z, w } = body.rotation();
    const read: Block = { id: block.id, level: block.level, pose: fromTable({ p: arr(body.translation()), q: [x, y, z, w] }, table) };
    if (!body.isSleeping()) {
      read.v = rotate(table, arr(body.linvel()));
      read.w = rotate(table, arr(body.angvel()));
    }
    return read;
  });
}

// The block's world bounding box half extents, from the rotation matrix's absolute values
function extents([x, y, z, w]: Quat): Vec3 {
  const m = [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
  return m.map(row => row.reduce((sum, v, j) => sum + Math.abs(v) * HALF[j], 0)) as Vec3;
}

export function isOut(block: Block, table: Quat = IDENTITY) {
  const pose = toTable(block.pose, table);
  const [ex, , ez] = extents(pose.q);
  const [x, , z] = pose.p;
  return Math.abs(x) - ex > FOOTPRINT || Math.abs(z) - ez > FOOTPRINT;
}

export const topSurface = (block: Block) => block.pose.p[1] + extents(block.pose.q)[1];

export const onGroundOutside = (block: Block, table: Quat = IDENTITY) => block.pose.p[1] < BLOCK.height && isOut(block, table);

// Each block is compared in its own turntable frame, so a tower carried round by the table has not toppled
export function toppled(start: Block[], now: Block[], exempt: number | null, startTable: Quat = IDENTITY, nowTable: Quat = IDENTITY) {
  const before = new Map(start.map(b => [b.id, b.pose]));
  return now.some(block => {
    const from = before.get(block.id);
    if (!from || block.id === exempt) return false;
    const [a, b] = [toTable(from, startTable).q, toTable(block.pose, nowTable).q];
    const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
    return from.p[1] - block.pose.p[1] > 0.75 || dot < TILT_DOT;
  });
}

export const isResting = (blocks: Block[]) =>
  blocks.every(b => (!b.v || length(b.v) < REST_SPEED) && (!b.w || length(b.w) < REST_SPIN));
