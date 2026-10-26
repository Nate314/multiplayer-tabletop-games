// Dominoes rules shared by the browser (playable tiles) and the server (validation).
import { pointsText, rankStandings } from '../../shared/standings.ts';
import { handCounts, viewHand } from '../../shared/hands.ts';
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { acknowledge, awaiting, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random, Standing } from '../../shared/types.ts';
import { EMPTY_BOARD, SINGLE_LINE, boardOf, endPhrase, lay, openEnd, openEnds, pendingArms } from './board.ts';
import type { Branching, Layout } from './board.ts';
import type { GameState, LastMove, Move, PublicGameState, Result, RoundSummary, Seat, SetSize } from './types.ts';
import { BRANCHING_RULE, CHICKENFOOT_RULE, SET_RULE, TARGET_RULE, TRAINS_RULE } from './options.ts';

export function layoutOf(state: Pick<GameState, 'houseRules'>): Layout {
  // No house rules: saved before layouts (or built by hand in a test), so it keeps playing the single line it started as
  if (!state.houseRules) return SINGLE_LINE;
  return {
    branching: houseRule(state, BRANCHING_RULE),
    chickenfoot: houseRule(state, CHICKENFOOT_RULE),
    trains: houseRule(state, TRAINS_RULE)
  };
}

export const standardTarget = (players: number) => (players === 2 ? 100 : 61);

export const targetScore = (state: Pick<GameState, 'houseRules' | 'activePlayers'>): number => {
  const chosen = houseRule(state, TARGET_RULE);
  return typeof chosen === 'number' ? chosen : standardTarget(state.activePlayers.length);
};

// Wikipedia's Dominoes article is silent on hand sizes and target scores for the Draw game, so these follow Pagat's Draw
// Dominoes (pagat.com/domino/draw.html): with double-six each player draws 7 tiles, 6 with four players, so a boneyard is
// left; double-nine uses 9 for every player count. The game is played to 100 points for two players, 61 for three or four.
// Wikipedia's "Blocking game" (Middle Eastern version) has the holder of the double-six start, and later rounds are led by the
// previous round's winner with any tile.
export const HAND_SIZES: Record<SetSize, Record<number, number>> = {
  6: { 2: 7, 3: 7, 4: 6 },
  9: { 2: 9, 3: 9, 4: 9 }
};

// Every tile of a double-`set` set once, as [low, high] pips; a tile's id is its index
export function tilesOf(set: SetSize): [number, number][] {
  const tiles: [number, number][] = [];
  for (let low = 0; low <= set; low++) for (let high = low; high <= set; high++) tiles.push([low, high]);
  return tiles;
}

export const tilePips = (set: SetSize, tile: number): [number, number] => tilesOf(set)[tile];

export const pipTotal = (set: SetSize, tiles: number[]) =>
  tiles.reduce((sum, tile) => sum + tilePips(set, tile)[0] + tilePips(set, tile)[1], 0);

// What deciding a play needs; both GameState and PublicGameState have it. A state saved before layouts has `line` and no
// `board`, `openTrains` or `drewThisTurn`, so reads go through boardOf and defaults.
export type PlayView = Pick<GameState, 'set' | 'board' | 'leadTile' | 'openTrains' | 'drewThisTurn' | 'activePlayers' | 'houseRules'>;
export type Play = { tile: number; end: number }; // end: an arm index

// The arm indexes `seat` may play on: the ends of a double still waiting for a tile (for everyone), else every open end.
// With Trains, only your own train, the Mexican train, an open train or a dismissed player's train; `everyTrainOpen` lifts that.
export function usableEnds(view: PlayView, seat: Seat, everyTrainOpen = false): number[] {
  const board = boardOf(view);
  const layout = layoutOf(view);
  const ends = openEnds(board).map(({ arm }) => arm);
  const pending = pendingArms(board, layout);
  if (pending.length > 0) return ends.filter(arm => pending.includes(arm));
  if (!layout.trains || everyTrainOpen) return ends;
  const open = view.openTrains ?? [];
  return ends.filter(arm => {
    const { owner } = board.arms[arm];
    return owner === null || owner === seat || owner === 'mexican' || open.includes(owner) || !view.activePlayers.includes(owner);
  });
}

function plays(view: PlayView, seat: Seat, hand: number[], everyTrainOpen: boolean): Play[] {
  const board = boardOf(view);
  if (!board.start) return hand.filter(tile => view.leadTile === null || tile === view.leadTile).map(tile => ({ tile, end: 0 }));
  const ends = usableEnds(view, seat, everyTrainOpen);
  return hand.flatMap(tile => ends
    .filter(arm => tilePips(view.set, tile).some(side => side === openEnd(board, arm)))
    .map((end): Play => ({ tile, end })));
}

// Every way a tile in `hand` can be played. The first tile of a round has no end to match, so it is listed once with end 0;
// a `leadTile` restricts it.
export function legalPlays(view: PlayView, seat: Seat, hand: number[]): Play[] {
  return plays(view, seat, hand, false);
}

// What a player with no tile that fits must do; null when a tile fits. With Trains a player draws one tile a turn
export function stuckMove(view: PlayView, seat: Seat, hand: number[], boneyardCount: number): 'draw' | 'pass' | null {
  if (legalPlays(view, seat, hand).length > 0) return null;
  const drawn = layoutOf(view).trains && (view.drewThisTurn ?? false);
  return boneyardCount > 0 && !drawn ? 'draw' : 'pass';
}

// How the status line and the history name a tile: its pips as laid, e.g. '3-4'
export const pipsName = ([left, right]: [number, number]) => `${left}-${right}`;

// The tile that leads the first round: the highest double, else the heaviest tile (ties go to the higher end)
export function openingTile(set: SetSize, hands: Record<Seat, number[]>): { seat: Seat; tile: number } {
  const worth = (tile: number) => {
    const [a, b] = tilePips(set, tile);
    return (a === b ? 1000 : 0) + (a + b) * 20 + b;
  };
  const held = Object.entries(hands).flatMap(([seat, hand]) => hand.map(tile => ({ seat: Number(seat), tile })));
  return held.reduce((best, next) => (worth(next.tile) > worth(best.tile) ? next : best));
}

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    set: SET_RULE.standard,
    roundNumber: 1,
    scores: {},
    hands: {},
    boneyard: [],
    board: EMPTY_BOARD,
    openTrains: [],
    drewThisTurn: false,
    leadTile: null,
    lastWinner: null,
    roundSummary: null,
    lastMove: null
  };
}

const isDoubleTile = (set: SetSize, tile: number) => tilePips(set, tile)[0] === tilePips(set, tile)[1];

// Who leads the round, and with which tile. The first round is led by the holder of the highest double; after that the
// previous round's winner leads with any tile. With Trains every round needs a double for the hub: the highest double held
// leads, and if nobody holds one, players draw from the boneyard in seat order, from the lowest seat, until one draws a double.
function openRound(state: GameState): GameState {
  const players = state.activePlayers;
  if (!layoutOf(state).trains) {
    const opening = state.lastWinner !== null && players.includes(state.lastWinner) ? null : openingTile(state.set, state.hands);
    return { ...state, leadTile: opening?.tile ?? null, currentPlayer: opening?.seat ?? state.lastWinner };
  }
  const hands = { ...state.hands };
  const boneyard = [...state.boneyard];
  const seats = [...players].sort((a, b) => a - b);
  const holdsDouble = () => Object.values(hands).some(hand => hand.some(tile => isDoubleTile(state.set, tile)));
  for (let turn = 0; !holdsDouble() && boneyard.length > 0; turn++) {
    const seat = seats[turn % seats.length];
    hands[seat] = [...hands[seat], boneyard.pop() as number];
  }
  const opening = openingTile(state.set, hands);
  return { ...state, hands, boneyard, leadTile: opening.tile, currentPlayer: opening.seat };
}

// Everyone draws their tiles from a shuffled set and the rest is the boneyard; then the round opens (see openRound)
export function dealRound(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  const deck = shuffle(tilesOf(state.set).map((_, tile) => tile), random);
  const size = HAND_SIZES[state.set][players.length];
  const hands = Object.fromEntries(players.map((seat, index) => [seat, deck.slice(index * size, (index + 1) * size)]));
  return openRound({
    ...state,
    hands,
    boneyard: deck.slice(players.length * size),
    board: EMPTY_BOARD,
    openTrains: [],
    drewThisTurn: false,
    roundSummary: null,
    lastMove: null
  });
}

// Before the first move, the tiles are dealt afresh for the current players from the house rules' set.
// Nothing is dealt until two players are seated.
export function resetLobby(state: GameState, random: Random): GameState {
  const players = state.activePlayers;
  const empty: GameState = {
    ...state,
    set: houseRule(state, SET_RULE),
    roundNumber: 1,
    scores: Object.fromEntries(players.map(seat => [seat, 0])),
    hands: Object.fromEntries(players.map(seat => [seat, []])),
    boneyard: [],
    board: EMPTY_BOARD,
    openTrains: [],
    drewThisTurn: false,
    leadTile: null,
    lastWinner: null,
    roundSummary: null,
    lastMove: null
  };
  return players.length < 2 ? empty : dealRound(empty, random);
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, boneyard, ...view } = state;
  return {
    ...view,
    hand: viewHand(hands, viewer),
    handCounts: handCounts(hands),
    boneyardCount: boneyard.length,
    undoAvailable
  };
}

function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'draw':
    case 'pass':
      return { type: input.type };
    case 'play':
      if (!Number.isInteger(input.tile) || !Number.isInteger(input.end)) return null;
      return { type: 'play', tile: input.tile as number, end: input.end as number };
    default:
      return null;
  }
}

// How the status line and the history describe a move, e.g. 'Alice played 3-4 on the left'.
// A play saved before layouts has `end` instead of `where`
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'draw': return `${name} drew a tile`;
    case 'pass': return lastMove.trainOpened ? `${name} passed: ${name}'s train is open` : `${name} passed`;
    case 'play': {
      const where = lastMove.where ?? (lastMove.end ? `on the ${lastMove.end}` : null);
      return `${name} played ${pipsName(lastMove.pips)}${where ? ` ${where}` : ''}${lastMove.wentOut ? ' and went out' : ''}`;
    }
  }
}

const canMove = (state: GameState, seat: Seat, everyTrainOpen = false) =>
  plays(state, seat, state.hands[seat] ?? [], everyTrainOpen).length > 0;

// Nobody can play and there is nothing left to draw. With Trains a stuck player's pass opens their train, so the round is
// blocked only if nobody could play even with every train open. A double nobody can finish blocks it too.
function isBlocked(state: GameState): boolean {
  return state.boneyard.length === 0 && boardOf(state).start !== null &&
    !state.activePlayers.some(seat => canMove(state, seat, true));
}

// A round ends in a win for the player who went out, who scores the pips in every other hand and in the boneyard (Wikipedia,
// "Scoring": the score is the pips in the losing hands plus the stock). A blocked round (`wentOut` null) goes to the lowest pip
// total, who scores the other hands ("Blocking game", Middle Eastern version); a tie for the lowest scores nothing.
// The first to the target score wins the game.
function endRound(state: GameState, wentOut: Seat | null): GameState {
  const players = state.activePlayers;
  const pips = Object.fromEntries(players.map(seat => [seat, pipTotal(state.set, state.hands[seat])]));
  const boneyardPips = pipTotal(state.set, state.boneyard);
  const lowest = Math.min(...players.map(seat => pips[seat]));
  const lowSeats = players.filter(seat => pips[seat] === lowest);
  const winner = wentOut ?? (lowSeats.length === 1 ? lowSeats[0] : null);
  const points = winner === null ? 0
    : players.filter(seat => seat !== winner).reduce((sum, seat) => sum + pips[seat], 0) + (wentOut === null ? 0 : boneyardPips);

  const summary: RoundSummary = {
    roundNumber: state.roundNumber,
    winner,
    blocked: wentOut === null,
    points,
    pipsLeft: pips,
    tilesLeft: Object.fromEntries(players.map(seat => [seat, state.hands[seat].length])),
    boneyardPips,
    acknowledged: []
  };
  const scored: GameState = {
    ...state,
    currentPlayer: null,
    lastWinner: winner,
    scores: winner === null ? state.scores : { ...state.scores, [winner]: (state.scores[winner] ?? 0) + points },
    roundSummary: summary
  };
  if (winner === null) return { ...scored, gameStatus: 'The round is blocked and tied, nobody scores. Waiting for everyone to continue.' };

  const name = state.playerNames[winner];
  const total = scored.scores[winner];
  if (total >= targetScore(state)) return { ...scored, isGameOver: true, winners: [winner], gameStatus: `${name} wins with ${total} points!` };
  const cause = wentOut === null ? `The round is blocked: ${name} has the lowest total and` : `${name} went out and`;
  return { ...scored, gameStatus: `${cause} scores ${points} points. Waiting for everyone to continue.` };
}

// A move that may have blocked the game: the round ends, else the turn moves on (or stays, after a draw)
function settle(state: GameState, seat: Seat, lastMove: LastMove, advance: boolean): GameState {
  if (isBlocked(state)) return { ...endRound(state, null), lastMove };
  const turn = advance ? nextActivePlayer(state, seat) : state.currentPlayer;
  return {
    ...state, currentPlayer: turn, drewThisTurn: advance ? false : state.drewThisTurn, lastMove,
    gameStatus: describeMove(lastMove, state.playerNames)
  };
}

// Why a tile cannot go on arm `end` of a started board, or null when it can
function refusal(state: GameState, seat: Seat, layout: Layout, tile: number, end: number): string | null {
  const board = boardOf(state);
  if (!Number.isInteger(end) || end < 0 || end >= board.arms.length) return 'There is no such end';
  const pips = openEnd(board, end);
  if (pips === null) return 'That end is closed';
  const pending = pendingArms(board, layout);
  if (pending.length > 0 && !pending.includes(end)) {
    // Every pending arm shares one `from`, so the first arm's base is the double's pips
    const double = board.arms[pending[0]].base;
    return `Finish the ${double}-${double} first`;
  }
  if (!usableEnds(state, seat).includes(end)) return 'You can play only on your own train, the Mexican train or an open train';
  if (!tilePips(state.set, tile).includes(pips)) return 'That tile does not match that end';
  return null;
}

function play(state: GameState, seat: Seat, tile: number, end: number): Result<GameState> {
  const hand = state.hands[seat];
  if (!hand.includes(tile)) return { error: 'You do not have that tile' };
  const board = boardOf(state);
  const first = board.start === null;
  if (first && state.leadTile !== null && tile !== state.leadTile) {
    return { error: 'Lead with the highest double, or the heaviest tile if nobody has a double' };
  }
  // The first tile has no end to match; afterwards the tile must fit the end it is played on
  const layout = layoutOf(state);
  const refused = first ? null : refusal(state, seat, layout, tile, end);
  if (refused) return { error: refused };

  const laid = lay(board, layout, tile, tilePips(state.set, tile), end, state.activePlayers);
  const rest = hand.filter(held => held !== tile);
  const next: GameState = {
    ...state,
    hands: { ...state.hands, [seat]: rest },
    board: laid.board,
    // Playing on your own train closes it
    openTrains: !first && board.arms[end].owner === seat ? state.openTrains.filter(open => open !== seat) : state.openTrains,
    leadTile: null
  };
  const lastMove: LastMove = {
    type: 'play', playerNumber: seat, tile, pips: laid.pips,
    where: first ? null : endPhrase(board, end, state.playerNames), wentOut: rest.length === 0
  };
  if (rest.length === 0) return { state: { ...endRound(next, seat), lastMove } };
  return { state: settle(next, seat, lastMove, true) };
}

// Only when nothing in the hand fits; the turn stays with the player. With Trains, one tile a turn
function draw(state: GameState, seat: Seat): Result<GameState> {
  if (canMove(state, seat)) return { error: 'You have a tile that fits' };
  if (layoutOf(state).trains && state.drewThisTurn) return { error: 'You have already drawn this turn' };
  if (state.boneyard.length === 0) return { error: 'The boneyard is empty' };
  const tile = state.boneyard[state.boneyard.length - 1];
  const next: GameState = {
    ...state,
    boneyard: state.boneyard.slice(0, -1),
    hands: { ...state.hands, [seat]: [...state.hands[seat], tile] },
    drewThisTurn: true
  };
  return { state: settle(next, seat, { type: 'draw', playerNumber: seat }, false) };
}

// Only when nothing fits and the boneyard is empty, or with Trains once this turn's draw did not fit. With Trains it opens
// the player's train
function pass(state: GameState, seat: Seat): Result<GameState> {
  if (canMove(state, seat)) return { error: 'You have a tile that fits' };
  if (stuckMove(state, seat, state.hands[seat], state.boneyard.length) === 'draw') return { error: 'Draw from the boneyard first' };
  if (!layoutOf(state).trains || state.openTrains.includes(seat)) {
    return { state: settle(state, seat, { type: 'pass', playerNumber: seat }, true) };
  }
  const opened: GameState = { ...state, openTrains: [...state.openTrains, seat] };
  return { state: settle(opened, seat, { type: 'pass', playerNumber: seat, trainOpened: true }, true) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  if (state.roundSummary) return { error: 'The round is over' };
  if (parsed.type === 'draw') return draw(state, seat);
  if (parsed.type === 'pass') return pass(state, seat);
  return play(state, seat, parsed.tile, parsed.end);
}

const ROUND: RoundAccess<GameState, RoundSummary> = {
  get: state => state.roundSummary,
  set: (state, roundSummary) => ({ ...state, roundSummary }),
  noun: 'round'
};

// Deals the next round once every connected player has acknowledged the summary
function startNextRoundIfReady(state: GameState, random: Random): GameState {
  if (!everyoneReady(state, ROUND)) return state;
  const roundNumber = state.roundNumber + 1;
  const next = dealRound({ ...state, roundNumber }, random);
  return { ...next, gameStatus: `Round ${roundNumber}: ${state.playerNames[next.currentPlayer as Seat]} leads` };
}

function acknowledgeRound(state: GameState, seat: Seat, random: Random): Result<GameState> {
  return acknowledge(state, seat, ROUND, next => startNextRoundIfReady(next, random));
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  const input = asRecord(action);
  switch (input?.type) {
    case 'acknowledgeRound': return acknowledgeRound(state, seat, random);
    default: return { error: 'Unknown action' };
  }
}

// The leaver's tiles go back into the boneyard. The platform has already moved a held turn on (play runs up the seats too),
// but the round may now be blocked, and the next round may have been waiting only for them.
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const { [seat]: hand = [], ...hands } = state.hands;
  const returned: GameState = {
    ...state,
    hands,
    boneyard: shuffle([...state.boneyard, ...hand], random),
    lastWinner: state.lastWinner === seat ? null : state.lastWinner,
    // A draw this turn was the leaver's when the turn was theirs (the last move is their draw); the next player has not drawn
    drewThisTurn: state.drewThisTurn && state.lastMove?.playerNumber !== seat
  };
  if (returned.roundSummary) return startNextRoundIfReady(returned, random);
  // Nobody else can lead with a lead tile the leaver held, so the round opens again among the hands left
  if (boardOf(returned).start === null && returned.leadTile !== null && hand.includes(returned.leadTile)) return openRound(returned);
  return isBlocked(returned) ? endRound(returned, null) : returned;
}

// The next round may have been waiting only for the player who disconnected
export function onPlayerDisconnected(state: GameState, _seat: Seat, random: Random): GameState {
  return startNextRoundIfReady(state, random);
}

// Reshuffles the boneyard, so an undone draw cannot show which tile comes next
export function onUndo(state: GameState, random: Random): GameState {
  return { ...state, boneyard: shuffle(state.boneyard, random) };
}

export function finalStandings(state: GameState): Standing[] {
  const points = (seat: Seat) => state.scores[seat] ?? 0;
  return rankStandings(state, (a, b) => points(b) - points(a), seat => pointsText(points(seat)));
}

export const waitingOn = (state: GameState) => awaiting(state, ROUND);
