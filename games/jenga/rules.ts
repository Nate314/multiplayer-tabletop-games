// Jenga rules shared by the browser (legal pulls, open slots) and the server (validation and the physics tick)
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { plural } from '../../shared/text.ts';
import type { Random } from '../../shared/types.ts';
import {
  BLOCK, DEFAULT_GRIP, QUARTER_TURN, STEPS_PER_TICK, anchorWorld, buildWorld, clampTarget, isOut, isResting, onGroundOutside, readBlocks,
  startingTower, stepWorld, topSurface, toppled,
} from './physics.ts';
import { forgetWorld, keepWorld, worldFor } from './simulation.ts';
import type { Block, GameState, PublicGameState, Quat, Result, Seat, Sim, Vec3 } from './types.ts';

const HALF: Vec3 = [BLOCK.length / 2, BLOCK.height / 2, BLOCK.width / 2];
const CALM_TICKS = 10;
const RELEASE_TICKS = 200;
const COLLAPSE_TICKS = 100;
const NEW_SIM: Sim = { ticks: 0, calmTicks: 0, sinceRelease: 0 };

export const topLevel = (blocks: Block[]) => Math.max(...blocks.map(b => b.level));

type Slot = 0 | 1 | 2;
const SLOTS: Slot[] = [0, 1, 2];
// Even levels run along X, so their slot is across Z; odd levels the other way
const acrossAxis = (level: number) => level % 2 === 0 ? 2 : 0;
const slotOffset = (slot: Slot) => (slot - 1) * BLOCK.width;
// A neighbor that slid less than this into a slot leaves room for a block there
const SLACK = 0.1;

// The level the next block goes on and its open slots. A slot is open when no top block reaches into it,
// so a block that slid is never placed into; a top with no room left, even short of 3 blocks, counts as full
function nextLevel(blocks: Block[]): { level: number; slots: Slot[] } {
  const top = topLevel(blocks);
  const onTop = blocks.filter(b => b.level === top);
  const axis = acrossAxis(top);
  const slots = SLOTS.filter(slot => onTop.every(b => Math.abs(b.pose.p[axis] - slotOffset(slot)) >= BLOCK.width - SLACK));
  return onTop.length < 3 && slots.length > 0 ? { level: top, slots } : { level: top + 1, slots: [...SLOTS] };
}

export const openSlots = (blocks: Block[]) => nextLevel(blocks).slots;

function pullRefusal(blocks: Block[], id: number): string | null {
  const block = blocks.find(b => b.id === id);
  if (!block) return 'Invalid block';
  const top = topLevel(blocks);
  if (block.level >= top) return 'You cannot take a block from the top level';
  const full = blocks.filter(b => b.level === top).length === 3;
  if (!full && block.level >= top - 1) return 'You cannot take a block from the level under an incomplete top';
  return null;
}

export const canPull = (state: Pick<GameState, 'blocks'>, block: number) => pullRefusal(state.blocks, block) === null;

const turnStatus = (state: GameState) => state.currentPlayer === null ? state.gameStatus : `${state.playerNames[state.currentPlayer]}'s turn to pull a block`;

// Everything a new tower resets: the full stack, nobody pulling, nothing placed yet
function freshTower(grip: () => number) {
  const blocks = startingTower();
  return {
    blocks,
    grip: blocks.map(grip),
    turnStart: blocks,
    phase: 'pull' as const,
    grab: null,
    held: null,
    pull: null,
    sim: null,
    toppled: false,
    loser: null,
    lastMove: null
  };
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...freshTower(() => DEFAULT_GRIP), placed: {} };
}

// New hidden grips whenever the table changes; the joined message stays as the status
export function resetLobby(state: GameState, random: Random): GameState {
  return {
    ...state,
    ...freshTower(() => Math.round((0.35 + 0.3 * random()) * 100) / 100),
    placed: Object.fromEntries(state.activePlayers.map(seat => [seat, 0]))
  };
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
const rounded = <T extends number[]>(values: T, places: number) => values.map(n => round(n, places)) as T;

function viewBlock(block: Block): Block {
  const view: Block = { id: block.id, level: block.level, pose: { p: rounded(block.pose.p, 3), q: rounded(block.pose.q, 4) } };
  if (!isResting([block])) {
    if (block.v) view.v = rounded(block.v, 3);
    if (block.w) view.w = rounded(block.w, 3);
  }
  return view;
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  const { grip: _grip, turnStart: _turnStart, ...view } = state;
  return { ...view, blocks: state.blocks.map(viewBlock), undoAvailable };
}

const isVec3 = (value: unknown): value is Vec3 =>
  Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n));

function grab(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  if (state.phase !== 'pull') return { error: 'Place the block you are holding first' };
  const { block: id, anchor } = input;
  if (typeof id !== 'number' || !isVec3(anchor) || anchor.some((a, i) => Math.abs(a) > HALF[i])) return { error: 'Invalid block' };
  const refusal = pullRefusal(state.blocks, id);
  if (refusal) return { error: refusal };
  const block = state.blocks.find(b => b.id === id)!;
  return {
    state: {
      ...state,
      started: true,
      grab: { block: id, anchor, target: anchorWorld(block, anchor) },
      pull: { seat, block: id },
      sim: { ...(state.sim ?? NEW_SIM), calmTicks: 0, sinceRelease: 0 },
      gameStatus: `${state.playerNames[seat]} is pulling a block`
    }
  };
}

function drag(state: GameState, target: unknown): Result<GameState> {
  if (!state.grab) return { error: 'You are not holding a block' };
  if (!isVec3(target)) return { error: 'Invalid target' };
  const block = state.blocks.find(b => b.id === state.grab!.block)!;
  const anchor = anchorWorld(block, state.grab.anchor);
  return { state: { ...state, grab: { ...state.grab, target: clampTarget(anchor, [target[0], anchor[1], target[2]]) } } };
}

// Grab, drag and release steer the tick and are never recorded
export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const input = asRecord(action);
  if (state.isGameOver) return { error: 'The game is over' };
  if (!state.started && state.activePlayers.length < 2) return { error: 'Waiting for more players' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  if (state.toppled) return { error: 'The tower has toppled' };
  if (state.currentPlayer !== seat) return { error: 'Not your turn' };
  if (input?.type === 'grab') return grab(state, seat, input);
  if (input?.type === 'drag') return drag(state, input.target);
  if (input?.type === 'release') {
    if (!state.grab) return { error: 'You are not holding a block' };
    return { state: { ...released(state), gameStatus: turnStatus(state) } };
  }
  return { error: 'Unknown action type' };
}

// Letting go starts the settle countdown afresh; the tower keeps moving from where it is
const released = (state: GameState): GameState => ({ ...state, grab: null, sim: { ...(state.sim ?? NEW_SIM), calmTicks: 0, sinceRelease: 0 } });

const PLACE_TICKS = 60;

// Steps a world of `blocks` until at rest, or at most PLACE_TICKS ticks (180 steps)
function settled(state: GameState, blocks: Block[]): { blocks: Block[]; rested: boolean } {
  const tower = buildWorld(blocks, id => state.grip[id] ?? DEFAULT_GRIP);
  try {
    let calm = 0;
    for (let tick = 0; tick < PLACE_TICKS && calm < CALM_TICKS; tick++) {
      stepWorld(tower, null, STEPS_PER_TICK);
      blocks = readBlocks(tower, blocks);
      calm = isResting(blocks) ? calm + 1 : 0;
    }
    return { blocks, rested: calm >= CALM_TICKS };
  } finally {
    tower.world.free();
  }
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'place') return { error: 'Unknown move type' };
  const slot = SLOTS.find(s => s === input.slot);
  if (slot === undefined) return { error: 'Invalid slot' };
  if (state.toppled) return { error: 'The tower has toppled' };
  if (state.held === null) return { error: 'You have no block to place' };
  if (state.sim) return { error: 'Wait for the tower to settle' };
  const { level, slots } = nextLevel(state.blocks);
  if (!slots.includes(slot)) return { error: 'That spot is taken' };

  const onTop = state.blocks.filter(b => b.level === level);
  const y = onTop.length > 0
    ? onTop.reduce((sum, b) => sum + b.pose.p[1], 0) / onTop.length + 0.01
    : Math.max(...state.blocks.map(topSurface)) + BLOCK.height / 2 + 0.01;
  const across: Vec3 = [0, y, 0];
  across[acrossAxis(level)] = slotOffset(slot);
  const q: Quat = level % 2 === 0 ? [0, 0, 0, 1] : [...QUARTER_TURN];
  const id = state.held;
  const result = settled(state, [...state.blocks, { id, level, pose: { p: across, q } }]);
  const blocks = result.rested ? still(result.blocks) : result.blocks;
  const to = blocks.find(b => b.id === id)!.pose;
  const from = state.turnStart.find(b => b.id === id)!.pose;
  const placed = { ...state, blocks, held: null, phase: 'pull' as const, grab: null, lastMove: { type: 'place' as const, seat, block: id, level, from, to } };

  // A collapse keeps simulating, even if already still, so its own tick ends the game and is recorded as the topple
  if (toppled(state.turnStart, blocks, id)) {
    return { state: { ...placed, sim: NEW_SIM, toppled: true, loser: seat, gameStatus: `${state.playerNames[seat]} toppled the tower!` } };
  }
  const next: GameState = {
    ...placed,
    turnStart: blocks,
    pull: null,
    sim: result.rested ? null : NEW_SIM,
    placed: { ...state.placed, [seat]: (state.placed[seat] ?? 0) + 1 },
    currentPlayer: nextActivePlayer(state, seat)
  };
  return { state: { ...next, gameStatus: turnStatus(next) } };
}

// The undone or abandoned turn starts over: the tower as it was, nobody holding anything
function backToTurnStart(state: GameState): GameState {
  forgetWorld(state.gameId);
  return { ...state, blocks: state.turnStart, phase: 'pull', grab: null, held: null, pull: null, sim: null, toppled: false, loser: null };
}

export const onUndo = (state: GameState) => backToTurnStart(state);

// A dismissed puller's half-done turn is put back, unless they already toppled it: that collapse and loss stand
export const onPlayerLeft = (state: GameState, seat: Seat) => state.pull?.seat === seat && !state.toppled ? backToTurnStart(state) : state;

// The tower settles where it is; a topple during that still counts against them, and a block in hand stays in hand
export const onPlayerDisconnected = (state: GameState, seat: Seat) => state.grab && state.pull?.seat === seat ? released(state) : state;

// Nobody can be holding a block after a restart or an undo; a saved simulation keeps settling from its poses
export const resumeClock = (state: GameState) => state.grab ? released(state) : state;

export function jengaStandings(state: GameState): { seat: Seat; place: number; score?: string }[] {
  return state.activePlayers.map(seat => seat === state.loser
    ? { seat, place: 2, score: 'Toppled the tower' }
    : { seat, place: 1, score: plural(state.placed[seat] ?? 0, 'block placed', 'blocks placed') });
}

export const simulating = (state: GameState) => state.sim !== null;

// The last pulled block counts as taken out once it is clear of the tower while held, or lying on the ground out there
function takenOut(state: GameState, blocks: Block[]): number | null {
  // In a collapse every block stays on the table, so the final step shows them all and nobody holds one
  if (state.toppled || state.phase !== 'pull' || !state.pull) return null;
  const block = blocks.find(b => b.id === state.pull!.block);
  if (!block) return null;
  return (state.grab?.block === block.id ? isOut(block) : !state.grab && onGroundOutside(block)) ? block.id : null;
}

const still = (blocks: Block[]) => blocks.map(({ id, level, pose }) => ({ id, level, pose }));

// A throw after stepping leaves the kept world ahead of its state, so it is dropped and the manager logs the error
export function simulate(state: GameState): GameState {
  try {
    return tick(state);
  } catch (error) {
    forgetWorld(state.gameId);
    throw error;
  }
}

// One tick: step the world, then take a block out, catch a topple, and stop once everything is at rest
function tick(state: GameState): GameState {
  if (!state.sim) return state;
  const tower = worldFor(state.gameId, state);
  stepWorld(tower, state.grab, STEPS_PER_TICK);
  let blocks = readBlocks(tower, state.blocks);
  let next: GameState = { ...state, blocks };
  const name = state.currentPlayer === null ? '' : state.playerNames[state.currentPlayer];

  const out = takenOut(state, blocks);
  if (out !== null) {
    const body = tower.bodies.get(out)!;
    tower.world.removeRigidBody(body);
    tower.bodies.delete(out);
    blocks = blocks.filter(b => b.id !== out);
    next = { ...next, blocks, held: out, phase: 'place', grab: null, gameStatus: `${name} took a block out. Place it on top` };
  }

  let sim = { ...state.sim, ticks: state.sim.ticks + 1 };
  // A game already over (everyone else left) still settles, but a collapse then cannot pick a new loser
  if (!next.toppled && !state.isGameOver && toppled(state.turnStart, blocks, state.pull?.block ?? null)) {
    next = { ...next, toppled: true, loser: state.currentPlayer, grab: null, gameStatus: `${name} toppled the tower!` };
    sim = { ...sim, ticks: 0 };
  }

  const calm = !next.grab && isResting(blocks);
  sim = { ...sim, calmTicks: calm ? sim.calmTicks + 1 : 0, sinceRelease: next.grab ? 0 : sim.sinceRelease + 1 };
  const rested = !next.grab && (sim.calmTicks >= CALM_TICKS || sim.sinceRelease >= RELEASE_TICKS);
  if (!rested && !(next.toppled && sim.ticks >= COLLAPSE_TICKS)) {
    next = { ...next, sim };
    keepWorld(state.gameId, next, tower);
    return next;
  }

  // At rest the world is no longer needed: the next grab rebuilds it from these poses
  forgetWorld(state.gameId);
  next = { ...next, blocks: still(blocks), sim: null };
  if (!next.toppled) return next;
  const loser = next.loser!;
  return {
    ...next,
    isGameOver: true,
    winners: next.activePlayers.filter(seat => seat !== loser),
    currentPlayer: null,
    lastMove: { type: 'topple', seat: loser }
  };
}
