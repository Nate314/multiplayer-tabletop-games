import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import type { Block, Grab, Quat, Vec3 } from './types.ts';

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

export type TowerWorld = { world: RAPIER.World; bodies: Map<number, RAPIER.RigidBody> };

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

export const anchorWorld = (block: Block, anchor: Vec3) => add(block.pose.p, rotate(block.pose.q, anchor));

export const clampTarget = (anchor: Vec3, target: Vec3) => add(anchor, capped(sub(target, anchor), MAX_REACH));

export function buildWorld(blocks: Block[], grip: (id: number) => number): TowerWorld {
  const world = new RAPIER.World({ x: 0, y: -981, z: 0 });
  world.lengthUnit = 100;
  world.timestep = STEP_S;
  // The default soft contacts (30 Hz, 4 iterations) squash an 18-level stack by 3 cm; stiffer contacts need more iterations
  world.integrationParameters.contact_natural_frequency = CONTACT_HZ;
  world.numSolverIterations = SOLVER_ITERATIONS;
  // A kinematic ground that never moves: contacts with a fixed body ignore the contact frequency and let the tower sink
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -1, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, 1, 100).setFriction(GROUND_FRICTION), ground);
  const bodies = new Map<number, RAPIER.RigidBody>();
  for (const block of blocks) {
    const [x, y, z, w] = block.pose.q;
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(...block.pose.p).setRotation({ x, y, z, w });
    if (block.v) desc.setLinvel(...block.v);
    if (block.w) desc.setAngvel(vec(block.w));
    const body = world.createRigidBody(desc);
    world.createCollider(RAPIER.ColliderDesc.cuboid(...HALF).setDensity(DENSITY).setFriction(grip(block.id)), body);
    bodies.set(block.id, body);
  }
  return { world, bodies };
}

// A spring from the anchor to the target, damped by the anchor's speed. Clamping the target to MAX_REACH is what bounds
// a flick (spring at most about 0.4 N); MAX_PULL_FORCE (6 N) is only a backstop and does not bind in normal play
function pull(body: RAPIER.RigidBody, grab: Grab) {
  const center = arr(body.translation());
  const r = body.rotation();
  const anchor = add(center, rotate([r.x, r.y, r.z, r.w], grab.anchor));
  const target = clampTarget(anchor, [grab.target[0], anchor[1], grab.target[2]]);
  const speed = add(arr(body.linvel()), cross(arr(body.angvel()), sub(anchor, center)));
  const mass = body.mass();
  const force = capped(sub(scale(sub(target, anchor), PULL_STIFFNESS * mass), scale(speed, PULL_DAMPING * mass)), MAX_PULL_FORCE);
  body.applyImpulseAtPoint(vec(scale(force, STEP_S)), vec(anchor), true);
}

export function stepWorld(tower: TowerWorld, grab: Grab | null, steps: number) {
  const body = grab && tower.bodies.get(grab.block);
  for (let i = 0; i < steps; i++) {
    if (grab && body) pull(body, grab);
    tower.world.step();
  }
}

// Moves a running world's bodies to `blocks` instead of rebuilding it; false when a block has no body yet and only a rebuild will do
export function syncWorld(tower: TowerWorld, blocks: Block[]): boolean {
  if (blocks.some(block => !tower.bodies.has(block.id))) return false;
  const shown = new Set(blocks.map(block => block.id));
  for (const [id, body] of tower.bodies) {
    if (shown.has(id)) continue;
    tower.world.removeRigidBody(body);
    tower.bodies.delete(id);
  }
  for (const block of blocks) {
    const body = tower.bodies.get(block.id)!;
    const [x, y, z, w] = block.pose.q;
    // Views send velocities only for moving blocks, so a missing one is at rest
    const moving = !!(block.v || block.w);
    body.setTranslation(vec(block.pose.p), moving);
    body.setRotation({ x, y, z, w }, moving);
    body.setLinvel(vec(block.v ?? [0, 0, 0]), moving);
    body.setAngvel(vec(block.w ?? [0, 0, 0]), moving);
  }
  return true;
}

export function readBlocks(tower: TowerWorld, previous: Block[]): Block[] {
  return previous.map(block => {
    const body = tower.bodies.get(block.id);
    if (!body) return block;
    const { x, y, z, w } = body.rotation();
    const read: Block = { id: block.id, level: block.level, pose: { p: arr(body.translation()), q: [x, y, z, w] } };
    if (!body.isSleeping()) {
      read.v = arr(body.linvel());
      read.w = arr(body.angvel());
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

export function isOut(block: Block) {
  const [ex, , ez] = extents(block.pose.q);
  const [x, , z] = block.pose.p;
  return Math.abs(x) - ex > FOOTPRINT || Math.abs(z) - ez > FOOTPRINT;
}

export const topSurface = (block: Block) => block.pose.p[1] + extents(block.pose.q)[1];

export const onGroundOutside = (block: Block) => block.pose.p[1] < BLOCK.height && isOut(block);

export function toppled(start: Block[], now: Block[], exempt: number | null) {
  const before = new Map(start.map(b => [b.id, b.pose]));
  return now.some(block => {
    const from = before.get(block.id);
    if (!from || block.id === exempt) return false;
    const [a, b] = [from.q, block.pose.q];
    const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
    return from.p[1] - block.pose.p[1] > 0.75 || dot < TILT_DOT;
  });
}

export const isResting = (blocks: Block[]) =>
  blocks.every(b => (!b.v || length(b.v) < REST_SPEED) && (!b.w || length(b.w) < REST_SPIN));
