// Jenga rules shared by the browser (legal pulls, open slots) and the server (validation and the physics tick)
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { plural } from '../../shared/text.ts';
import type { Random, Standing } from '../../shared/types.ts';
import {
  BLOCK, DEFAULT_GRIP, IDENTITY, MAX_SPIN, QUARTER_TURN, REST_TURNTABLE, STEPS_PER_TICK, anchorWorld, buildWorld, clampTarget, fromTable, isOut,
  isResting, onGroundOutside, readBlocks, readTurntable, startingTower, stepWorld, toTable, topSurface, toppled,
} from './physics.ts';
import { forgetWorld, keepWorld, worldFor } from './simulation.ts';
import type { Block, GameState, Pose, PublicGameState, Quat, Result, Seat, Sim, Slot, Turntable, Vec3 } from './types.ts';

const HALF: Vec3 = [BLOCK.length / 2, BLOCK.height / 2, BLOCK.width / 2];
const CALM_TICKS = 10;
const RELEASE_TICKS = 200;
const COLLAPSE_TICKS = 100;
const NEW_SIM: Sim = { ticks: 0, calmTicks: 0, sinceRelease: 0 };

export const topLevel = (blocks: Block[]) => Math.max(...blocks.map(b => b.level));

// A room saved before the turntable has it at rest at angle 0
export const turntableOf = (state: Pick<GameState, 'turntable'>): Turntable => state.turntable ?? REST_TURNTABLE;

const SLOTS: Slot[] = [0, 1, 2];
// Even levels run along X, so their slot is across Z; odd levels the other way
const acrossAxis = (level: number) => level % 2 === 0 ? 2 : 0;
const slotOffset = (slot: Slot) => (slot - 1) * BLOCK.width;
// A neighbor that slid less than this into a slot leaves room for a block there
const SLACK = 0.1;

// The level the next block goes on and its open slots. A slot is open when no top block reaches into it,
// so a block that slid is never placed into; a top with no room left, even short of 3 blocks, counts as full.
// Slots are in the turntable's frame, so they turn with the tower
function nextLevel(blocks: Block[], table: Quat): { level: number; slots: Slot[] } {
  const top = topLevel(blocks);
  const onTop = blocks.filter(b => b.level === top);
  const axis = acrossAxis(top);
  const slots = SLOTS.filter(slot => onTop.every(b => Math.abs(toTable(b.pose, table).p[axis] - slotOffset(slot)) >= BLOCK.width - SLACK));
  return onTop.length < 3 && slots.length > 0 ? { level: top, slots } : { level: top + 1, slots: [...SLOTS] };
}

export const openSlots = (blocks: Block[], table: Quat = IDENTITY) => nextLevel(blocks, table).slots;

// The world pose a place sets each open slot's block at, just above the level under it
export function placementTargets(blocks: Block[], table: Quat): { slot: Slot; pose: Pose }[] {
  const { level, slots } = nextLevel(blocks, table);
  // Turning about Y keeps heights, so they are read straight from the world poses
  const onTop = blocks.filter(b => b.level === level);
  const y = onTop.length > 0
    ? onTop.reduce((sum, b) => sum + b.pose.p[1], 0) / onTop.length + 0.01
    : Math.max(...blocks.map(topSurface)) + BLOCK.height / 2 + 0.01;
  const q: Quat = level % 2 === 0 ? [0, 0, 0, 1] : [...QUARTER_TURN];
  return slots.map(slot => {
    const p: Vec3 = [0, y, 0];
    p[acrossAxis(level)] = slotOffset(slot);
    return { slot, pose: fromTable({ p, q }, table) };
  });
}

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
    lastMove: null,
    turntable: REST_TURNTABLE,
    turnStartTurntable: IDENTITY
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
  const { grip: _grip, turnStart: _turnStart, turnStartTurntable: _turnStartTurntable, ...view } = state;
  const { q, w, drive } = turntableOf(state);
  return { ...view, blocks: state.blocks.map(viewBlock), turntable: { q: rounded(q, 4), w: round(w, 3), drive }, undoAvailable };
}

const isVec3 = (value: unknown): value is Vec3 =>
  Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n));

function grab(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  if (state.phase !== 'pull') return { error: 'Place the block you are holding first' };
  // A placement that did not settle in time keeps moving into the next turn; a fall then is the placer's
  if (state.sim && !state.pull) return { error: 'Wait for the tower to settle' };
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

// A speed spins the turntable toward it and makes this the turner's turn; null lets go and the table coasts
function turn(state: GameState, seat: Seat, speed: unknown): Result<GameState> {
  // A NaN or infinite speed would poison the spin for the rest of the simulation
  if (speed !== null && (typeof speed !== 'number' || !Number.isFinite(speed))) return { error: 'Invalid speed' };
  const table = turntableOf(state);
  // A stray key-up with nothing driven is silent
  if (speed === null) return { state: table.drive === null ? state : { ...state, turntable: { ...table, drive: null } } };
  if (state.sim && !state.pull) return { error: 'Wait for the tower to settle' };
  return {
    state: {
      ...state,
      started: true,
      turntable: { ...table, drive: Math.min(MAX_SPIN, Math.max(-MAX_SPIN, speed)) },
      pull: state.pull ?? { seat, block: null },
      sim: { ...(state.sim ?? NEW_SIM), calmTicks: 0, sinceRelease: 0 }
    }
  };
}

// Grab, drag, release and turn steer the tick and are never recorded
export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const input = asRecord(action);
  if (state.isGameOver) return { error: 'The game is over' };
  if (!state.started && state.activePlayers.length < 2) return { error: 'Waiting for more players' };
  // Letting go stays allowed during a vote, so a vote opened mid-pull never leaves the spring pulling or the table driven
  const release = input?.type === 'release';
  const lettingGo = release || (input?.type === 'turn' && input.speed === null);
  if (state.undoVote && !lettingGo) return { error: 'An undo vote is in progress' };
  if (state.dismissVote && !lettingGo) return { error: 'A dismiss vote is in progress' };
  if (state.toppled) return { error: 'The tower has toppled' };
  if (state.currentPlayer !== seat) return { error: 'Not your turn' };
  if (input?.type === 'grab') return grab(state, seat, input);
  if (input?.type === 'drag') return drag(state, input.target);
  if (input?.type === 'turn') return turn(state, seat, input.speed);
  if (release) {
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
  const tower = buildWorld(blocks, id => state.grip[id] ?? DEFAULT_GRIP, { q: turntableOf(state).q, w: 0, drive: null });
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
  const table = turntableOf(state).q;
  const { level } = nextLevel(state.blocks, table);
  const target = placementTargets(state.blocks, table).find(t => t.slot === slot);
  if (!target) return { error: 'That spot is taken' };

  const id = state.held;
  const result = settled(state, [...state.blocks, { id, level, pose: target.pose }]);
  const blocks = result.rested ? still(result.blocks) : result.blocks;
  const to = blocks.find(b => b.id === id)!.pose;
  const startTable = state.turnStartTurntable ?? IDENTITY;
  // Carried into the turned tower, so History's ghost of where it came from turns with it
  const from = fromTable(toTable(state.turnStart.find(b => b.id === id)!.pose, startTable), table);
  const placed = { ...state, blocks, held: null, phase: 'pull' as const, grab: null, lastMove: { type: 'place' as const, seat, block: id, level, from, to } };

  // A collapse keeps simulating, even if already still, so its own tick ends the game and is recorded as the topple
  if (toppled(state.turnStart, blocks, id, startTable, table)) {
    return { state: { ...placed, sim: NEW_SIM, toppled: true, loser: seat, gameStatus: `${state.playerNames[seat]} toppled the tower!` } };
  }
  const next: GameState = {
    ...placed,
    turnStart: blocks,
    turnStartTurntable: table,
    pull: null,
    sim: result.rested ? null : NEW_SIM,
    placed: { ...state.placed, [seat]: (state.placed[seat] ?? 0) + 1 },
    currentPlayer: nextActivePlayer(state, seat)
  };
  return { state: { ...next, gameStatus: turnStatus(next) } };
}

// The undone or abandoned turn starts over: the tower and turntable as they were, nobody holding anything
function backToTurnStart(state: GameState): GameState {
  forgetWorld(state.gameId);
  return {
    ...state,
    blocks: state.turnStart,
    turntable: { q: state.turnStartTurntable ?? IDENTITY, w: 0, drive: null },
    phase: 'pull',
    grab: null,
    held: null,
    pull: null,
    sim: null,
    toppled: false,
    loser: null
  };
}

export const onUndo = (state: GameState) => backToTurnStart(state);

// A dismissed puller's half-done turn is put back, unless they already toppled it: that collapse and loss stand
export const onPlayerLeft = (state: GameState, seat: Seat) => state.pull?.seat === seat && !state.toppled ? backToTurnStart(state) : state;

const holdingOn = (state: GameState) => state.grab !== null || turntableOf(state).drive !== null;
// The grab and the drive both let go; the turntable coasts and the tower settles from where it is
const letGo = (state: GameState): GameState => ({ ...released(state), turntable: { ...turntableOf(state), drive: null } });

// The tower settles where it is; a topple during that still counts against them, and a block in hand stays in hand
export const onPlayerDisconnected = (state: GameState, seat: Seat) => holdingOn(state) && state.pull?.seat === seat ? letGo(state) : state;

// Nobody can be holding a block or driving the turntable after a restart or an undo; a saved simulation keeps settling from its poses
export const resumeClock = (state: GameState) => holdingOn(state) ? letGo(state) : state;

// Winners (everyone but the loser, or the last player left after a dismissal) share place 1
export function jengaStandings(state: GameState): Standing[] {
  return state.activePlayers.map(seat => ({
    seat,
    place: state.winners.includes(seat) ? 1 : 2,
    score: seat === state.loser ? 'Toppled the tower' : plural(state.placed[seat] ?? 0, 'block placed', 'blocks placed')
  }));
}

export const simulating = (state: GameState) => state.sim !== null;

// The last pulled block counts as taken out once it is clear of the tower while held, or lying on the ground out there
function takenOut(state: GameState, blocks: Block[]): number | null {
  // In a collapse every block stays on the table, so the final step shows them all and nobody holds one
  if (state.toppled || state.phase !== 'pull' || state.pull?.block == null) return null;
  const block = blocks.find(b => b.id === state.pull!.block);
  if (!block) return null;
  const table = turntableOf(state).q;
  return (state.grab?.block === block.id ? isOut(block, table) : !state.grab && onGroundOutside(block, table)) ? block.id : null;
}

const still = (blocks: Block[]) => blocks.map(({ id, level, pose }) => ({ id, level, pose }));

// A throw after stepping leaves the kept world ahead of its state, so it is dropped. The tower then stops where it
// stood, ending a collapse, since a toppled game refuses every action and nothing else would ever restart its clock
export function simulate(state: GameState): GameState {
  try {
    return tick(state);
  } catch (error) {
    forgetWorld(state.gameId);
    console.error(`jenga simulation failed in ${state.gameId}:`, error);
    return atRest({ ...state, grab: null });
  }
}

// One tick: step the world, then catch a topple, take a block out, and stop once everything is at rest
function tick(state: GameState): GameState {
  if (!state.sim) return state;
  const tower = worldFor(state.gameId, state);
  const { drive } = turntableOf(state);
  stepWorld(tower, state.grab, STEPS_PER_TICK, drive);
  let blocks = readBlocks(tower, state.blocks);
  const turntable = readTurntable(tower, drive);
  let next: GameState = { ...state, blocks, turntable };

  let sim = { ...state.sim, ticks: state.sim.ticks + 1 };
  // A game already over (everyone else left) still settles, but a collapse then cannot pick a new loser.
  // Without a pull the tower is still settling from the last placement, so the placer toppled it
  const startTable = state.turnStartTurntable ?? IDENTITY;
  if (!next.toppled && !state.isGameOver && toppled(state.turnStart, blocks, state.pull?.block ?? null, startTable, turntable.q)) {
    const loser = (state.pull ? state.currentPlayer : state.lastMove?.seat ?? state.currentPlayer) ?? null;
    const name = loser === null ? 'Someone' : state.playerNames[loser];
    // A toppled game refuses every action, so the turner could never let go of the drive
    next = { ...next, toppled: true, loser, grab: null, turntable: { ...turntable, drive: null }, gameStatus: `${name} toppled the tower!` };
    sim = { ...sim, ticks: 0 };
  }

  // Checked after the topple, which keeps a block pulled clear in that same tick on the table
  const out = takenOut(next, blocks);
  if (out !== null) {
    const body = tower.bodies.get(out)!;
    tower.world.removeRigidBody(body);
    tower.bodies.delete(out);
    blocks = blocks.filter(b => b.id !== out);
    next = { ...next, blocks, held: out, phase: 'place', grab: null, gameStatus: `${state.playerNames[state.pull!.seat]} took a block out. Place it on top` };
  }

  // A driven or still spinning turntable keeps the simulation going, however still the blocks look
  const holding = holdingOn(next);
  const calm = !holding && turntable.w === 0 && isResting(blocks);
  sim = { ...sim, calmTicks: calm ? sim.calmTicks + 1 : 0, sinceRelease: holding ? 0 : sim.sinceRelease + 1 };
  const rested = !next.grab && (sim.calmTicks >= CALM_TICKS || sim.sinceRelease >= RELEASE_TICKS);
  if (!rested && !(next.toppled && sim.ticks >= COLLAPSE_TICKS)) {
    next = { ...next, sim };
    keepWorld(state.gameId, next, tower);
    return next;
  }

  // At rest the world is no longer needed: the next grab rebuilds it from these poses
  forgetWorld(state.gameId);
  return atRest(next);
}

// Velocities dropped and the simulation stopped; a collapse ends the game, and a placement's settling sets the turn start
function atRest(state: GameState): GameState {
  const blocks = still(state.blocks);
  const turntable = { ...turntableOf(state), w: 0, drive: null };
  const next = { ...state, blocks, turntable, sim: null };
  if (!next.toppled) return next.pull ? next : { ...next, turnStart: blocks, turnStartTurntable: turntable.q };
  const loser = next.loser!;
  return {
    ...next,
    isGameOver: true,
    winners: next.activePlayers.filter(seat => seat !== loser),
    currentPlayer: null,
    lastMove: { type: 'topple', seat: loser }
  };
}
