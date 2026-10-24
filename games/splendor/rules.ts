// Splendor rules shared by the browser (what can be afforded) and the server (validation).
// Rules follow https://en.wikipedia.org/wiki/Splendor_(game); token counts per player count follow the published rulebook.
import { houseRule, targetScoreRule, type HouseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import { CARDS, GEMS, LEVELS, NOBLES } from './cards.ts';
import type {
  BuySource,
  Card,
  GameState,
  Gem,
  Gems,
  LastMove,
  Level,
  MarketSlot,
  Move,
  Noble,
  PlayerState,
  PublicGameState,
  ReserveSource,
  Result,
  Seat,
  Token,
  Tokens
} from './types.ts';

export const TOKENS: readonly Token[] = [...GEMS, 'gold'];
export const GOLD_COUNT = 5;
export const MARKET_SIZE = 4;
export const MAX_TOKENS = 10;
export const MAX_RESERVED = 3;
const PRESTIGE_RULE = targetScoreRule(15, [10, 21], 'Prestige to win');
export const SPLENDOR_RULES: HouseRule[] = [PRESTIGE_RULE];

export const winningPrestige = (state: Pick<GameState, 'houseRules'>): number => houseRule(state, PRESTIGE_RULE);

export function gemsPerColor(playerCount: number): number {
  return playerCount <= 2 ? 4 : playerCount === 3 ? 5 : 7;
}

export function emptyTokens(): Tokens {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
}

export function tokenTotal(tokens: Tokens): number {
  return TOKENS.reduce((total, token) => total + tokens[token], 0);
}

function addTokens(a: Tokens, b: Tokens, sign = 1): Tokens {
  const result = emptyTokens();
  for (const token of TOKENS) result[token] = a[token] + sign * b[token];
  return result;
}

type Owned = Pick<PlayerState, 'cards' | 'nobles'>;

export function bonuses(player: Pick<PlayerState, 'cards'>): Gems {
  const result: Gems = { white: 0, blue: 0, green: 0, red: 0, black: 0 };
  for (const id of player.cards) result[CARDS[id].bonus]++;
  return result;
}

export function prestige(player: Owned): number {
  return player.cards.reduce((total, id) => total + CARDS[id].points, 0) +
    player.nobles.reduce((total, id) => total + NOBLES[id].points, 0);
}

// The tokens a purchase costs after bonuses: colored gems first, gold for whatever is short. Null when it cannot be paid.
export function payment(player: Pick<PlayerState, 'cards' | 'tokens'>, card: Card): Tokens | null {
  const owned = bonuses(player);
  const paid = emptyTokens();
  for (const gem of GEMS) {
    const due = Math.max(0, card.cost[gem] - owned[gem]);
    paid[gem] = Math.min(due, player.tokens[gem]);
    paid.gold += due - paid[gem];
  }
  return paid.gold <= player.tokens.gold ? paid : null;
}

export function qualifies(player: Pick<PlayerState, 'cards'>, noble: Noble): boolean {
  const owned = bonuses(player);
  return GEMS.every(gem => owned[gem] >= noble.cost[gem]);
}

// Take three asks for three different colors, or every color left when fewer than three remain
export function takeThreeCount(supply: Tokens): number {
  return Math.min(3, GEMS.filter(gem => supply[gem] > 0).length);
}

function emptyPlayer(): PlayerState {
  return { tokens: emptyTokens(), cards: [], reserved: [], nobles: [] };
}

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    supply: emptyTokens(),
    decks: { 1: [], 2: [], 3: [] },
    market: { 1: [], 2: [], 3: [] },
    nobles: [],
    players: {},
    pending: null,
    finalRound: false,
    lastMove: null,
    turnHolder: null
  };
}

// Before the first move, the table is laid out afresh for the current player count, and the lowest seat goes first
export function resetLobby(state: GameState, random: Random): GameState {
  const count = state.activePlayers.length;
  const each = gemsPerColor(count);
  const supply: Tokens = { white: each, blue: each, green: each, red: each, black: each, gold: GOLD_COUNT };
  const decks = { 1: [] as number[], 2: [] as number[], 3: [] as number[] };
  const market = { 1: [] as (number | null)[], 2: [] as (number | null)[], 3: [] as (number | null)[] };
  for (const level of LEVELS) {
    const deck = shuffle(CARDS.filter(card => card.level === level).map(card => card.id), random);
    market[level] = deck.splice(deck.length - MARKET_SIZE, MARKET_SIZE).reverse();
    decks[level] = deck;
  }
  const nobles = count >= 2 ? shuffle(NOBLES.map(noble => noble.id), random).slice(0, count + 1) : [];
  return {
    ...state,
    supply,
    decks,
    market,
    nobles,
    players: Object.fromEntries(state.activePlayers.map(seat => [seat, emptyPlayer()])),
    pending: null,
    finalRound: false,
    lastMove: null,
    turnHolder: state.currentPlayer
  };
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { decks, players, turnHolder: _turnHolder, ...view } = state;
  return {
    ...view,
    deckCounts: { 1: decks[1].length, 2: decks[2].length, 3: decks[3].length },
    players: Object.fromEntries(Object.entries(players).map(([key, player]) => {
      const seat = Number(key);
      const reserved = player.reserved.map(({ card, fromDeck }) => ({
        level: CARDS[card].level,
        card: fromDeck && viewer !== seat ? null : card
      }));
      return [seat, { ...player, reserved }];
    })),
    undoAvailable
  };
}

// Reading untrusted moves

function isGem(value: unknown): value is Gem {
  return GEMS.some(gem => gem === value);
}

function isToken(value: unknown): value is Token {
  return TOKENS.some(token => token === value);
}

function isIndex(value: unknown, size: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < size;
}

function parseLevel(value: unknown): Level | null {
  return LEVELS.find(level => level === value) ?? null;
}

function parseMarketSlot(input: Record<string, unknown>): MarketSlot | null {
  const level = parseLevel(input.level);
  return level !== null && isIndex(input.slot, MARKET_SIZE) ? { kind: 'market', level, slot: input.slot } : null;
}

function parseReserveSource(value: unknown): ReserveSource | null {
  const input = asRecord(value);
  if (input?.kind === 'market') return parseMarketSlot(input);
  const level = parseLevel(input?.level);
  return input?.kind === 'deck' && level !== null ? { kind: 'deck', level } : null;
}

function parseBuySource(value: unknown): BuySource | null {
  const input = asRecord(value);
  if (input?.kind === 'market') return parseMarketSlot(input);
  return input?.kind === 'reserved' && isIndex(input.index, MAX_RESERVED) ? { kind: 'reserved', index: input.index } : null;
}

function parseTokens(value: unknown): Tokens | null {
  const input = asRecord(value);
  if (!input) return null;
  const result = emptyTokens();
  for (const [key, count] of Object.entries(input)) {
    if (!isToken(key) || typeof count !== 'number' || !Number.isInteger(count) || count < 0) return null;
    result[key] = count;
  }
  return result;
}

function parseMove(value: unknown): Move | null {
  const input = asRecord(value);
  switch (input?.type) {
    case 'takeThree': {
      const colors = input.colors;
      if (!Array.isArray(colors) || colors.length < 1 || colors.length > 3 || !colors.every(isGem)) return null;
      return new Set(colors).size === colors.length ? { type: 'takeThree', colors } : null;
    }
    case 'takeTwo':
      return isGem(input.color) ? { type: 'takeTwo', color: input.color } : null;
    case 'reserve': {
      const source = parseReserveSource(input.source);
      return source ? { type: 'reserve', source } : null;
    }
    case 'buy': {
      const source = parseBuySource(input.source);
      return source ? { type: 'buy', source } : null;
    }
    case 'returnTokens': {
      const tokens = parseTokens(input.tokens);
      return tokens ? { type: 'returnTokens', tokens } : null;
    }
    case 'chooseNoble':
      return isIndex(input.noble, NOBLES.length) ? { type: 'chooseNoble', noble: input.noble } : null;
    case 'pass':
      return { type: 'pass' };
    default:
      return null;
  }
}

// The end of a turn

type Turn = { state: GameState; seat: Seat; lastMove: LastMove };

function updatePlayer(state: GameState, seat: Seat, change: Partial<PlayerState>): GameState {
  return { ...state, players: { ...state.players, [seat]: { ...state.players[seat], ...change } } };
}

function names(state: GameState, seats: Seat[]): string {
  return seats.map(seat => state.playerNames[seat]).join(' and ');
}

// Most prestige, then fewest development cards, then fewest reserved cards; a tie on all three is shared
function endGame(state: GameState): GameState {
  const best = (among: Seat[], measure: (player: PlayerState) => number): Seat[] => {
    const top = Math.max(...among.map(seat => measure(state.players[seat])));
    return among.filter(seat => measure(state.players[seat]) === top);
  };
  const byPrestige = best(state.activePlayers, prestige);
  const winners = best(best(byPrestige, player => -player.cards.length), player => -player.reserved.length);
  const points = prestige(state.players[winners[0]]);
  return {
    ...state,
    isGameOver: true,
    currentPlayer: null,
    turnHolder: null,
    pending: null,
    winners,
    gameStatus: winners.length === 1
      ? `${names(state, winners)} wins with ${points} prestige!`
      : `${names(state, winners)} share the win with ${points} prestige!`
  };
}

function passTurn(state: GameState, seat: Seat): GameState {
  const reached = prestige(state.players[seat]) >= winningPrestige(state);
  const finalRound = state.finalRound || reached;
  const next = nextActivePlayer(state, seat);
  // Turns go up the seats from the lowest, so a round is over when play wraps back down
  const roundOver = next === null || next <= seat;
  const passed: GameState = { ...state, finalRound, pending: null };
  if (finalRound && roundOver) return endGame(passed);
  const status = reached && !state.finalRound
    ? `${state.gameStatus}. ${state.playerNames[seat]} has ${prestige(state.players[seat])} prestige: the round finishes, then the game ends.`
    : state.gameStatus;
  return { ...passed, currentPlayer: next, turnHolder: next, gameStatus: status };
}

// After the action: tokens back down to 10, then a noble's visit, then the turn passes
function finishTurn({ state, seat, lastMove }: Turn): GameState {
  const player = state.players[seat];
  const excess = tokenTotal(player.tokens) - MAX_TOKENS;
  if (excess > 0) {
    return { ...state, lastMove, pending: { kind: 'returnTokens', count: excess },
      gameStatus: `${describe(state, lastMove)}. They return ${excess} token${excess === 1 ? '' : 's'}.` };
  }
  const visiting = state.nobles.filter(id => qualifies(player, NOBLES[id]));
  if (visiting.length > 1) {
    return { ...state, lastMove, pending: { kind: 'chooseNoble', nobles: visiting },
      gameStatus: `${describe(state, lastMove)}. They choose a noble.` };
  }
  if (visiting.length === 1) return visit(state, seat, visiting[0], lastMove);
  return passTurn({ ...state, lastMove, gameStatus: describe(state, lastMove) }, seat);
}

function visit(state: GameState, seat: Seat, noble: number, lastMove: LastMove): GameState {
  const player = state.players[seat];
  const visited = updatePlayer({ ...state, nobles: state.nobles.filter(id => id !== noble) }, seat, { nobles: [...player.nobles, noble] });
  const move = { ...lastMove, noble };
  return passTurn({ ...visited, lastMove: move, gameStatus: describe(state, move) }, seat);
}

// The status line's words for a move, also used by the history
export function describe(state: Pick<GameState, 'playerNames'>, move: LastMove): string {
  const name = state.playerNames[move.seat];
  const text = describeAction(name, move);
  return move.noble === null || move.type === 'chooseNoble' ? text : `${text}, and a noble visited`;
}

function cardName(id: number): string {
  const card = CARDS[id];
  return `a level ${card.level} ${card.bonus} card`;
}

export function listTokens(tokens: Tokens): string {
  const parts = TOKENS.filter(token => tokens[token] > 0).map(token => `${tokens[token]} ${token}`);
  return parts.length === 0 ? 'nothing' : parts.join(', ');
}

function describeAction(name: string, move: LastMove): string {
  switch (move.type) {
    case 'takeThree': return `${name} took ${move.colors.join(', ')}`;
    case 'takeTwo': return `${name} took 2 ${move.color}`;
    case 'reserve': {
      const what = move.card === null ? `the top level ${move.level} card` : cardName(move.card);
      return `${name} reserved ${what}${move.gold ? ' and took a gold' : ''}`;
    }
    case 'buy': return `${name} bought ${cardName(move.card)}${move.fromReserve ? ' from their reserve' : ''}${tokenTotal(move.paid) === 0 ? ' for free' : ` for ${listTokens(move.paid)}`}`;
    case 'returnTokens': return `${name} returned ${listTokens(move.tokens)}`;
    case 'chooseNoble': return `${name} chose a noble to visit`;
    case 'pass': return `${name} could not act and passed`;
  }
}

// The actions

function takeThree(state: GameState, seat: Seat, colors: Gem[]): Turn | { error: string } {
  if (colors.some(gem => state.supply[gem] === 0)) return { error: 'One of those colors has run out' };
  if (colors.length !== takeThreeCount(state.supply)) return { error: 'Take three different colors, or every color left if fewer remain' };
  const taken = emptyTokens();
  for (const gem of colors) taken[gem] = 1;
  return { state: gain(state, seat, taken), ...turn(seat, { type: 'takeThree', colors }) };
}

function takeTwo(state: GameState, seat: Seat, color: Gem): Turn | { error: string } {
  if (state.supply[color] < 4) return { error: 'Taking two needs at least 4 of that color left' };
  return { state: gain(state, seat, { ...emptyTokens(), [color]: 2 }), ...turn(seat, { type: 'takeTwo', color }) };
}

function turn(seat: Seat, action: DistributiveOmit<LastMove, 'seat' | 'noble'>): Omit<Turn, 'state'> {
  return { seat, lastMove: { seat, noble: null, ...action } as LastMove };
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

// Moves tokens from the supply to a player
function gain(state: GameState, seat: Seat, tokens: Tokens): GameState {
  const player = state.players[seat];
  return updatePlayer({ ...state, supply: addTokens(state.supply, tokens, -1) }, seat, { tokens: addTokens(player.tokens, tokens) });
}

// Takes the card out of a face-up slot and refills the slot from its deck, or leaves it empty
function takeFromMarket(state: GameState, { level, slot }: MarketSlot): { state: GameState; card: number } | { error: string } {
  const card = state.market[level][slot];
  if (card === null || card === undefined) return { error: 'There is no card there' };
  const deck = state.decks[level];
  const refill = deck.length > 0 ? deck[deck.length - 1] : null;
  return {
    card,
    state: {
      ...state,
      decks: { ...state.decks, [level]: deck.slice(0, -1) },
      market: { ...state.market, [level]: state.market[level].map((id, index) => (index === slot ? refill : id)) }
    }
  };
}

function reserve(state: GameState, seat: Seat, source: ReserveSource): Turn | { error: string } {
  const player = state.players[seat];
  if (player.reserved.length >= MAX_RESERVED) return { error: 'You already have 3 reserved cards' };
  let taken: GameState;
  let card: number;
  if (source.kind === 'deck') {
    const deck = state.decks[source.level];
    if (deck.length === 0) return { error: 'That deck is empty' };
    card = deck[deck.length - 1];
    taken = { ...state, decks: { ...state.decks, [source.level]: deck.slice(0, -1) } };
  } else {
    const result = takeFromMarket(state, source);
    if ('error' in result) return result;
    ({ card, state: taken } = result);
  }
  const fromDeck = source.kind === 'deck';
  const gold = state.supply.gold > 0;
  const reserved = updatePlayer(taken, seat, { reserved: [...player.reserved, { card, fromDeck }] });
  return {
    state: gold ? gain(reserved, seat, { ...emptyTokens(), gold: 1 }) : reserved,
    ...turn(seat, { type: 'reserve', level: CARDS[card].level, card: fromDeck ? null : card, gold })
  };
}

function buy(state: GameState, seat: Seat, source: BuySource): Turn | { error: string } {
  const player = state.players[seat];
  let taken: GameState;
  let card: number;
  if (source.kind === 'reserved') {
    const held = player.reserved[source.index];
    if (!held) return { error: 'You have no reserved card there' };
    card = held.card;
    taken = updatePlayer(state, seat, { reserved: player.reserved.filter((_, index) => index !== source.index) });
  } else {
    const result = takeFromMarket(state, source);
    if ('error' in result) return result;
    ({ card, state: taken } = result);
  }
  const paid = payment(player, CARDS[card]);
  if (!paid) return { error: 'You cannot afford that card' };
  const after = taken.players[seat];
  const bought = updatePlayer({ ...taken, supply: addTokens(taken.supply, paid) }, seat, {
    tokens: addTokens(after.tokens, paid, -1),
    cards: [...after.cards, card]
  });
  return { state: bought, ...turn(seat, { type: 'buy', card, fromReserve: source.kind === 'reserved', paid }) };
}

// True when the player has some action other than passing
export function canAct(state: Pick<GameState, 'supply' | 'decks' | 'market'> | Pick<PublicGameState, 'supply' | 'deckCounts' | 'market'>, player: Pick<PlayerState, 'cards' | 'tokens'> & { reserved: { card: number | null }[] }): boolean {
  if (takeThreeCount(state.supply) > 0) return true;
  const counts = 'decks' in state ? LEVELS.map(level => state.decks[level].length) : LEVELS.map(level => state.deckCounts[level]);
  const faceUp = LEVELS.flatMap(level => state.market[level]).filter((id): id is number => id !== null);
  if (player.reserved.length < MAX_RESERVED && (faceUp.length > 0 || counts.some(count => count > 0))) return true;
  const own = player.reserved.map(held => held.card).filter((id): id is number => id !== null);
  return [...faceUp, ...own].some(id => payment(player, CARDS[id]) !== null);
}

function returnTokens(state: GameState, seat: Seat, tokens: Tokens, count: number): Result<GameState> {
  const player = state.players[seat];
  if (tokenTotal(tokens) !== count) return { error: `Return exactly ${count} token${count === 1 ? '' : 's'}` };
  if (TOKENS.some(token => tokens[token] > player.tokens[token])) return { error: 'You do not have those tokens' };
  const returned = updatePlayer({ ...state, supply: addTokens(state.supply, tokens), pending: null }, seat, {
    tokens: addTokens(player.tokens, tokens, -1)
  });
  return { state: finishTurn({ state: returned, ...turn(seat, { type: 'returnTokens', tokens }) }) };
}

export function applyMove(state: GameState, seat: Seat, input: unknown): Result<GameState> {
  const move = parseMove(input);
  if (!move) return { error: 'Invalid move' };
  const { pending } = state;

  if (pending?.kind === 'returnTokens') {
    if (move.type !== 'returnTokens') return { error: 'Return tokens down to 10 first' };
    return returnTokens(state, seat, { ...emptyTokens(), ...move.tokens }, pending.count);
  }
  if (pending?.kind === 'chooseNoble') {
    if (move.type !== 'chooseNoble') return { error: 'Choose which noble visits first' };
    if (!pending.nobles.includes(move.noble)) return { error: 'That noble cannot visit you' };
    return { state: visit({ ...state, pending: null }, seat, move.noble, { seat, noble: null, type: 'chooseNoble' }) };
  }

  let result: Turn | { error: string };
  switch (move.type) {
    case 'takeThree': result = takeThree(state, seat, move.colors); break;
    case 'takeTwo': result = takeTwo(state, seat, move.color); break;
    case 'reserve': result = reserve(state, seat, move.source); break;
    case 'buy': result = buy(state, seat, move.source); break;
    case 'pass':
      if (canAct(state, state.players[seat])) return { error: 'You can still take an action' };
      result = { state, ...turn(seat, { type: 'pass' }) };
      break;
    default: return { error: 'There is nothing to return or choose' };
  }
  if ('error' in result) return result;
  return { state: finishTurn(result) };
}

// A dismissed player's tokens go back to the supply and their reserved cards leave the game; their bought cards stay on show.
// If it was their turn, its unfinished step is dropped, and a final round that this turn would have closed ends now.
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const player = state.players[seat];
  const supply = player ? addTokens(state.supply, player.tokens) : state.supply;
  let next: GameState = player ? updatePlayer({ ...state, supply }, seat, { tokens: emptyTokens(), reserved: [] }) : state;
  if (state.turnHolder !== seat) return next;
  next = { ...next, pending: null, turnHolder: next.currentPlayer };
  const wrapped = next.currentPlayer === null || next.currentPlayer < seat;
  return next.finalRound && wrapped ? endGame(next) : next;
}
