// Catan rules: the game's hooks for the platform, reading untrusted moves and actions, and the public view.
// The rules themselves live in board.ts, building.ts, dice.ts, trades.ts, devCards.ts, roads.ts and state.ts.
import { rollDie } from '../../shared/dice.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { minimumToStart } from '../../shared/houseRules.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { type Board, boardOf, desertOf, isIndex, randomLayout } from './board.ts';
import {
  advanceSetup, buildCity, buildRoad, buildSettlement, placeFreeRoad, placeSetupRoad, placeSetupSettlement
} from './building.ts';
import { buyDevCard, playKnight, playMonopoly, playRoadBuilding, playYearOfPlenty } from './devCards.ts';
import { afterDiscards, discard, discardForAbsent, moveRobber, roll } from './dice.ts';
import { roadLengths } from './roads.ts';
import { add, isResource, noResources, parseResources, total } from './resources.ts';
import {
  LOG_SIZE, checkWin, endGame, nameOf, note, points, settleAwards, startTurn, syncTurn, visiblePoints
} from './state.ts';
import { editionFor } from './editions.ts';
import { buildChance, playSpecialBuild, startSpecialBuild, withoutBuilder } from './specialBuild.ts';
import { answerTrade, bankTrade, cancelTrade, dropTradesOf, offerTrade } from './trades.ts';
import type { GameState, LastMove, Move, PublicGameState, Random, Resources, Result, Seat, Setup } from './types.ts';
import { PLAYERS } from './options.ts';

const MAX_ROLL_OFFS = 100; // ties roll again; the cap only guards against a broken random

export function createGameState(gameId: string): GameState {
  const edition = editionFor(0);
  const layout = randomLayout(() => 0.5, edition.board);
  return {
    ...baseGameState(gameId),
    layout,
    robber: desertOf(layout),
    roads: {},
    buildings: {},
    hands: {},
    bank: fullBank(edition.bankSize),
    devDeck: [],
    devCards: {},
    boughtThisTurn: [],
    devPlayed: false,
    knights: {},
    longestRoad: null,
    largestArmy: null,
    setup: null,
    turnHolder: null,
    rolled: false,
    dice: null,
    pending: null,
    specialBuild: null,
    trade: null,
    steal: null,
    log: [],
    lastMove: null
  };
}

function fullBank(size: number): Resources {
  return { wood: size, brick: size, sheep: size, wheat: size, ore: size };
}

// Everyone rolls both dice and the highest total goes first; players tied for highest roll again
function rollOff(state: GameState, random: Random): { first: Seat; status: string } {
  let contenders = state.activePlayers;
  const rounds: string[] = [];
  for (let round = 0; round < MAX_ROLL_OFFS && contenders.length > 1; round++) {
    const rolled = contenders.map(seat => ({ seat, value: rollDie(random) + rollDie(random) }));
    const highest = Math.max(...rolled.map(({ value }) => value));
    rounds.push(rolled.map(({ seat, value }) => `${nameOf(state, seat)} ${value}`).join(', '));
    contenders = rolled.filter(({ value }) => value === highest).map(({ seat }) => seat);
  }
  const first = contenders[0];
  return { first, status: `Highest roll goes first: ${rounds.join('; tie: ')}. ${nameOf(state, first)} goes first` };
}

// Setup order from the first player round the table and back: 1, 2, 3, 3, 2, 1
function snakeOrder(players: Seat[], first: Seat): Setup {
  const start = Math.max(0, players.indexOf(first));
  const round = [...players.slice(start), ...players.slice(0, start)];
  return { order: [...round, ...[...round].reverse()], step: 0, settlement: null };
}

// Before the first move: a new random board, the robber on the desert, empty hands, a full bank and a shuffled deck.
// Once two are seated the roll-off picks who places first.
export function resetLobby(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  const each = <T>(value: () => T): Record<Seat, T> => Object.fromEntries(players.map(seat => [seat, value()]));
  const edition = editionFor(players.length);
  const layout = randomLayout(random, edition.board);
  const fresh: GameState = {
    ...createGameState(state.gameId),
    ...state,
    layout,
    robber: desertOf(layout),
    roads: {},
    buildings: {},
    hands: each(noResources),
    bank: fullBank(edition.bankSize),
    devDeck: shuffle(edition.devDeck, random),
    devCards: each(() => []),
    boughtThisTurn: [],
    devPlayed: false,
    knights: each(() => 0),
    longestRoad: null,
    largestArmy: null,
    turnHolder: null,
    rolled: false,
    dice: null,
    pending: null,
    specialBuild: null,
    trade: null,
    steal: null,
    log: [],
    lastMove: null
  };
  if (players.length < 2) return syncTurn({ ...fresh, setup: snakeOrder(players, players[0] ?? 1) });
  const { first, status } = rollOff(fresh, random);
  return syncTurn({ ...fresh, setup: snakeOrder(players, first), gameStatus: `${state.gameStatus}. ${status}` });
}

// Hands and unplayed development cards are shown only to their owner, and the deck only as a count.
// Points leave out Victory Point cards a player has not shown, until the game is over.
export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, devDeck, devCards, boughtThisTurn, steal, ...view } = state;
  const seats = Object.keys(hands).map(Number);
  const newCards = (seat: Seat) => state.turnHolder === seat ? boughtThisTurn : [];
  const own = viewer !== null && viewer in hands;
  return {
    ...view,
    steal: steal && { ...steal, resource: viewer === steal.thief || viewer === steal.victim ? steal.resource : null },
    handCounts: Object.fromEntries(seats.map(seat => [seat, total(hands[seat])])),
    devCounts: Object.fromEntries(seats.map(seat => [seat, (devCards[seat] ?? []).length + newCards(seat).length])),
    // A dismissed player's pieces are dead, so they score nothing
    points: Object.fromEntries(seats.map(seat => [seat, !state.activePlayers.includes(seat) ? 0
      : state.isGameOver || seat === viewer ? points(state, seat) : visiblePoints(state, seat)])),
    roadLengths: roadLengths({ ...state, activePlayers: seats }),
    devDeckCount: devDeck.length,
    viewer,
    hand: own ? hands[viewer] : null,
    myDevCards: own ? devCards[viewer] ?? [] : [],
    myNewDevCards: own ? newCards(viewer) : [],
    undoAvailable
  };
}

// Reading untrusted moves

const VERTEX_MOVES = ['placeSettlement', 'buildSettlement', 'buildCity'] as const;
const EDGE_MOVES = ['placeRoad', 'buildRoad'] as const;
const PLAIN_MOVES = ['roll', 'buyDevCard', 'playKnight', 'playRoadBuilding', 'endTurn', 'passBuild'] as const;
// What a builder may do out of turn in the special build phase
const BUILD_CHANCE_MOVES: Move['type'][] = ['buildRoad', 'buildSettlement', 'buildCity', 'buyDevCard', 'passBuild'];

function parseMove(move: unknown, board: Board): Move | null {
  const input = asRecord(move);
  if (!input) return null;
  const vertexMove = VERTEX_MOVES.find(type => type === input.type);
  if (vertexMove) return isIndex(input.vertex, board.vertexCount) ? { type: vertexMove, vertex: input.vertex } : null;
  const edgeMove = EDGE_MOVES.find(type => type === input.type);
  if (edgeMove) return isIndex(input.edge, board.edgeCount) ? { type: edgeMove, edge: input.edge } : null;
  switch (input.type) {
    case 'moveRobber': {
      const { hex, victim } = input;
      if (!isIndex(hex, board.hexCount)) return null;
      if (victim !== null && !(typeof victim === 'number' && Number.isInteger(victim))) return null;
      return { type: 'moveRobber', hex, victim };
    }
    case 'playYearOfPlenty': {
      const chosen = input.resources;
      if (!Array.isArray(chosen) || chosen.length !== 2 || !chosen.every(isResource)) return null;
      return { type: 'playYearOfPlenty', resources: [chosen[0], chosen[1]] };
    }
    case 'playMonopoly':
      return isResource(input.resource) ? { type: 'playMonopoly', resource: input.resource } : null;
    case 'bankTrade':
      return isResource(input.give) && isResource(input.get) ? { type: 'bankTrade', give: input.give, get: input.get } : null;
  }
  const plain = PLAIN_MOVES.find(type => type === input.type);
  return plain ? { type: plain } : null;
}

export function describeMove(lastMove: LastMove): string {
  return lastMove.events.join('. ');
}

// Everything that follows by itself: the award cards, a win, and who must act now.
// A player wins only on their own turn, so never in the special build phase
function settle(state: GameState): GameState {
  const awarded = settleAwards(state);
  return syncTurn(awarded.specialBuild ? awarded : checkWin(awarded));
}

// The rules run with an empty log, so what they noted is exactly what this change did
function finish(before: GameState, after: GameState, lastMove?: Omit<LastMove, 'events'>): GameState {
  const settled = settle(after);
  const events = settled.log;
  return {
    ...settled,
    log: [...before.log, ...events].slice(-LOG_SIZE),
    gameStatus: events.length > 0 ? events.join('. ') : before.gameStatus,
    lastMove: lastMove ? { ...lastMove, events } : before.lastMove
  };
}

function playSetup(state: GameState, seat: Seat, move: Move): Result<GameState> {
  if (move.type === 'placeSettlement') return placeSetupSettlement(state, seat, move.vertex);
  if (move.type === 'placeRoad') return placeSetupRoad(state, seat, move.edge);
  return { error: state.setup?.settlement === null ? 'Place a settlement' : 'Place a road next to your new settlement' };
}

function endTurn(state: GameState, seat: Seat): Result<GameState> {
  const next = note(startTurn(state, nextActivePlayer(state, seat)), `${nameOf(state, seat)} ended their turn`);
  return { state: startSpecialBuild(next, seat) };
}

// The turn holder's moves: a pending robber, discard or free road comes first; development cards may be played
// before rolling; everything else needs the roll. A special build phase comes before all of it.
function play(state: GameState, seat: Seat, move: Move, random: Random): Result<GameState> {
  if (state.setup) return playSetup(state, seat, move);
  if (state.specialBuild) return playSpecialBuild(state, seat, move);
  const { pending } = state;
  if (pending?.kind === 'discard') return { error: 'Wait for everyone to discard' };
  if (pending?.kind === 'robber') {
    return move.type === 'moveRobber' ? moveRobber(state, seat, move.hex, move.victim, random) : { error: 'Move the robber first' };
  }
  if (pending?.kind === 'roadBuilding') {
    return move.type === 'placeRoad' ? placeFreeRoad(state, seat, move.edge) : { error: 'Place your free roads first' };
  }
  switch (move.type) {
    case 'playKnight': return playKnight(state, seat);
    case 'playRoadBuilding': return playRoadBuilding(state, seat);
    case 'playYearOfPlenty': return playYearOfPlenty(state, seat, move.resources);
    case 'playMonopoly': return playMonopoly(state, seat, move.resource);
    case 'roll': return state.rolled ? { error: 'You have rolled this turn' } : { state: roll(state, seat, random) };
    case 'placeSettlement':
    case 'placeRoad':
    case 'moveRobber':
    case 'passBuild':
      return { error: 'You cannot do that now' };
  }
  if (!state.rolled) return { error: 'Roll the dice first' };
  switch (move.type) {
    case 'buildRoad': return buildRoad(state, seat, move.edge);
    case 'buildSettlement': return buildSettlement(state, seat, move.vertex);
    case 'buildCity': return buildCity(state, seat, move.vertex);
    case 'buyDevCard': return buyDevCard(state, seat);
    case 'bankTrade': return bankTrade(state, seat, move.give, move.get);
    case 'endTurn': return endTurn(state, seat);
  }
}

// Only the builder whose chance it is moves out of turn, and only to build, buy or be done
export function allowsOutOfTurn(state: GameState, seat: Seat, move: unknown): boolean {
  if (!buildChance(state, seat)) return false;
  const parsed = parseMove(move, boardOf(state.layout));
  return parsed !== null && BUILD_CHANCE_MOVES.includes(parsed.type);
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move, boardOf(state.layout));
  if (!parsed) return { error: 'Invalid move' };
  if (!state.activePlayers.includes(seat)) return { error: 'You are not in this game' };
  const result = play({ ...state, log: [], steal: null }, seat, parsed, random);
  if ('error' in result) return result;
  return { state: finish(state, discardForAbsent(result.state, random), { type: parsed.type, playerNumber: seat }) };
}

function act(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const input = asRecord(action);
  switch (input?.type) {
    case 'discard': {
      const cards = parseResources(input.resources);
      return cards ? discard(state, seat, cards) : { error: 'Invalid discard' };
    }
    case 'offerTrade': {
      const give = parseResources(input.give);
      const get = parseResources(input.get);
      if (!give || !get) return { error: 'Invalid trade' };
      return offerTrade(state, seat, input.to, give, get);
    }
    case 'answerTrade':
      if (typeof input.accept !== 'boolean') return { error: 'Invalid answer' };
      return answerTrade(state, seat, input.accept);
    case 'cancelTrade': return cancelTrade(state, seat);
    default: return { error: 'Unknown action' };
  }
}

export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  if (state.activePlayers.length < minimumToStart(PLAYERS, state)) return { error: 'Waiting for more players' };
  if (!state.activePlayers.includes(seat)) return { error: 'You are not in this game' };
  const result = act({ ...state, log: [] }, seat, action);
  if ('error' in result) return result;
  return { state: finish(state, result.state) };
}

// Setup goes on without a dismissed player: their remaining placements are dropped, and a settlement they placed
// without its road stays on the board
function setupWithout(state: GameState, seat: Seat): GameState {
  const { setup } = state;
  if (!setup) return state;
  const current = setup.order[setup.step] === seat;
  const step = setup.order.slice(0, setup.step).filter(other => other !== seat).length;
  const order = setup.order.filter(other => other !== seat);
  return advanceSetup({ ...state, setup: { order, step, settlement: current ? null : setup.settlement } });
}

// A dismissed player's pieces stay on the board as dead pieces: they score and produce nothing, but still block and
// break roads. Their cards go back to the bank, and their development cards out of the game. A discard or trade
// waiting on them is dropped, and so is their build chance; on their turn, the next player's turn begins (ending any
// special build phase). With fewer than three left (two at a table set for two), the game ends and the player with
// the most points wins.
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const working: GameState = { ...state, log: [] };
  const returned: GameState = {
    ...working,
    bank: add(state.bank, state.hands[seat] ?? noResources()),
    hands: { ...state.hands, [seat]: noResources() },
    devCards: { ...state.devCards, [seat]: [] },
    boughtThisTurn: state.turnHolder === seat ? [] : state.boughtThisTurn,
    knights: { ...state.knights, [seat]: 0 }
  };
  let next = note(dropTradesOf(returned, seat), `${nameOf(state, seat)} left the game; their pieces stay on the board`);
  if (next.pending?.kind === 'discard' && seat in next.pending.counts) {
    const counts = { ...next.pending.counts };
    delete counts[seat];
    next = { ...next, pending: afterDiscards(counts) };
  }
  next = setupWithout(next, seat);
  if (!next.setup && state.turnHolder === seat) {
    const following = nextActivePlayer(next, seat);
    next = note(startTurn({ ...next, specialBuild: null }, following), `${nameOf(state, following)}'s turn`);
  } else {
    next = withoutBuilder(next, seat);
  }
  if (next.activePlayers.length < minimumToStart(PLAYERS, next)) {
    const awarded = settleAwards(next);
    const scores = awarded.activePlayers.map(other => points(awarded, other));
    const best = Math.max(...scores);
    const winners = awarded.activePlayers.filter((_, index) => scores[index] === best);
    const names = winners.map(winner => nameOf(state, winner)).join(' and ');
    return finish(state, endGame(awarded, winners, `Too few players are left to go on: ${names} ${winners.length > 1 ? 'win' : 'wins'} with ${best} points`));
  }
  return finish(state, next);
}

// An offer from or to a player who disconnects is dropped, so it never holds up the turn
// A trade with the player is dropped, a discard they owe is made for them, and their build chance is skipped
export function onPlayerDisconnected(state: GameState, seat: Seat, random: Random): GameState {
  let next: GameState = { ...state, log: [] };
  if (state.trade?.from === seat || state.trade?.to === seat) next = note({ ...next, trade: null }, 'The open trade offer was dropped');
  next = discardForAbsent(next, random);
  if (buildChance(next, seat)) next = withoutBuilder(note(next, `${nameOf(state, seat)} is away, so their build chance is skipped`), seat);
  return next.log.length > 0 ? finish(state, next) : state;
}
