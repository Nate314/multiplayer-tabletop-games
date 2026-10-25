import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random, Result, Seat } from '../../shared/types.ts';
import { phaseDeadline, phaseMs } from './clock.ts';
import { DRAWS_PER_PLAYER, TURN_SECONDS, WORD_CHOICES } from './options.ts';
import { isCorrect, maskOf } from './text.ts';
import type { ChatLine, GameState, LastMove, PublicGameState } from './types.ts';
import { WORDS } from './words.ts';

export const DRAWER_POINTS = 25;
const MAX_CHAT_LENGTH = 100;

export function guesserPoints(msLeft: number, turnMs: number): number {
  return 10 + Math.round(90 * msLeft / turnMs);
}

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    phase: 'choosing',
    deck: [],
    wordChoices: [],
    word: null,
    drawer: null,
    phaseStartedAt: null,
    strokes: [],
    nextStrokeId: 1,
    guessed: [],
    scores: {},
    draws: {},
    chat: [],
    nextChatId: 1,
    lastMove: null
  };
}

// Deals the drawer's choices off the top. A short deck is topped up with every other word, reshuffled, so words
// not yet offered still come first
function deal(state: GameState, random: Random): Pick<GameState, 'deck' | 'wordChoices'> {
  const count = houseRule(state, WORD_CHOICES);
  const deck = state.deck.length >= count
    ? state.deck
    : [...state.deck, ...shuffle(WORDS.filter(word => !state.deck.includes(word)), random)];
  return { deck: deck.slice(count), wordChoices: deck.slice(0, count) };
}

// Before the first move: a fresh deck, everyone at zero, and seat 1 choosing with no clock running
export function resetLobby(state: GameState, random: Random): GameState {
  const zero = Object.fromEntries(state.activePlayers.map(seat => [seat, 0]));
  return {
    ...state,
    ...deal({ ...state, deck: shuffle(WORDS, random) }, random),
    phase: 'choosing',
    word: null,
    drawer: state.currentPlayer,
    phaseStartedAt: null,
    strokes: [],
    guessed: [],
    scores: zero,
    draws: { ...zero },
    chat: [],
    lastMove: null
  };
}

function addLine(state: GameState, line: Omit<ChatLine, 'id'>): Pick<GameState, 'chat' | 'nextChatId'> {
  return { chat: [...state.chat, { id: state.nextChatId, ...line }], nextChatId: state.nextChatId + 1 };
}

function reveal(state: GameState, reason: 'allGuessed' | 'timeUp' | 'drawerLeft', now: number): GameState {
  const word = state.word ?? '';
  const drawer = state.drawer as Seat;
  const lastMove: LastMove = { type: 'reveal', word, reason };
  return {
    ...state,
    ...addLine(state, { kind: 'system', seat: null, text: `The word was ${word}`, audience: 'all' }),
    phase: 'reveal',
    phaseStartedAt: now,
    draws: { ...state.draws, [drawer]: (state.draws[drawer] ?? 0) + 1 },
    lastMove,
    gameStatus: `The word was ${word}`
  };
}

function endGame(state: GameState): GameState {
  const top = Math.max(...state.activePlayers.map(seat => state.scores[seat] ?? 0));
  const winners = state.activePlayers.filter(seat => (state.scores[seat] ?? 0) === top);
  const names = winners.map(seat => state.playerNames[seat]).join(' and ');
  return { ...state, isGameOver: true, currentPlayer: null, winners, gameStatus: `${names} won with ${top} points` };
}

// The next seat after the drawer with draws left, or the end of the game when nobody has any
function nextTurn(state: GameState, now: number, random: Random): GameState {
  const limit = houseRule(state, DRAWS_PER_PLAYER);
  let seat = state.drawer as Seat;
  for (let i = 0; i < state.activePlayers.length; i++) {
    seat = nextActivePlayer(state, seat) as Seat;
    if ((state.draws[seat] ?? 0) < limit) {
      return {
        ...state,
        ...deal(state, random),
        phase: 'choosing',
        word: null,
        drawer: seat,
        currentPlayer: seat,
        phaseStartedAt: now,
        strokes: [],
        guessed: [],
        lastMove: { type: 'nextTurn', playerNumber: seat },
        gameStatus: `${state.playerNames[seat]} is choosing a word`
      };
    }
  }
  return endGame(state);
}

function startDrawing(state: GameState, index: number, now: number, lastMove: LastMove): GameState {
  const drawer = state.drawer as Seat;
  return {
    ...state,
    word: state.wordChoices[index],
    wordChoices: [],
    phase: 'drawing',
    phaseStartedAt: now,
    strokes: [],
    guessed: [],
    lastMove,
    gameStatus: `${state.playerNames[drawer]} is drawing`
  };
}

function guessers(state: GameState): Seat[] {
  return state.activePlayers.filter(seat => seat !== state.drawer);
}

const everyoneGuessed = (state: GameState) => guessers(state).every(seat => state.guessed.includes(seat));

export function applyMove(state: GameState, seat: Seat, move: unknown, _random: Random, now: number): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'choose') return { error: 'Invalid move' };
  if (state.phase !== 'choosing' || seat !== state.drawer) return { error: 'You can choose a word only at the start of your turn' };
  const index = input.index;
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= state.wordChoices.length) {
    return { error: 'Invalid word choice' };
  }
  return { state: startDrawing(state, index, now, { type: 'choose', playerNumber: seat }) };
}

function chatText(action: unknown): string | null {
  const input = asRecord(action);
  if (input?.type !== 'chat' || typeof input.text !== 'string') return null;
  const text = input.text.trim();
  return text.length > 0 && text.length <= MAX_CHAT_LENGTH ? text : null;
}

// A guess counts only from a guesser who has not got it yet, while the drawing is on
function isScoringGuess(state: GameState, seat: Seat, text: string): boolean {
  return state.phase === 'drawing' && state.word !== null && seat !== state.drawer && state.activePlayers.includes(seat)
    && !state.guessed.includes(seat) && isCorrect(text, state.word);
}

export function recordsAction(state: GameState, seat: Seat, action: unknown): boolean {
  const text = chatText(action);
  return text !== null && !state.isGameOver && isScoringGuess(state, seat, text);
}

function scoreGuess(state: GameState, seat: Seat, now: number): GameState {
  const turnMs = phaseMs(state);
  const msLeft = Math.min(turnMs, Math.max(0, (state.phaseStartedAt ?? now) + turnMs - now));
  const points = guesserPoints(msLeft, turnMs);
  const drawer = state.drawer as Seat;
  const name = state.playerNames[seat];
  const next: GameState = {
    ...state,
    ...addLine(state, { kind: 'guessed', seat, text: `${name} guessed the word`, audience: 'all' }),
    guessed: [...state.guessed, seat],
    scores: { ...state.scores, [seat]: (state.scores[seat] ?? 0) + points, [drawer]: (state.scores[drawer] ?? 0) + DRAWER_POINTS },
    lastMove: { type: 'guess', playerNumber: seat, points },
    gameStatus: `${name} guessed the word`
  };
  return everyoneGuessed(next) ? reveal(next, 'allGuessed', now) : next;
}

// Chat doubles as guessing. Task 3 adds "So close!" lines and the full audience rules
export function applyAction(state: GameState, seat: Seat, action: unknown, _random: Random, now: number): Result<GameState> {
  const text = chatText(action);
  if (text === null) return { error: 'Invalid action' };
  if (state.isGameOver) return { error: 'The game is over' };
  if (isScoringGuess(state, seat, text)) return { state: scoreGuess(state, seat, now) };
  // While the drawing is on, the drawer and those who guessed talk only among themselves, so they cannot give it away
  const knows = state.phase === 'drawing' && (seat === state.drawer || state.guessed.includes(seat));
  return { state: { ...state, ...addLine(state, { kind: 'chat', seat, text, audience: knows ? 'guessed' : 'all' }) } };
}

export function deadline(state: GameState): number | null {
  return phaseDeadline(state);
}

export function onDeadline(state: GameState, now: number, random: Random): GameState {
  if (state.phase === 'choosing') {
    const drawer = state.drawer as Seat;
    const index = Math.floor(random() * state.wordChoices.length);
    const chosen = startDrawing(state, index, now, { type: 'autoChoose', playerNumber: drawer });
    return { ...chosen, gameStatus: `${state.playerNames[drawer]} ran out of time, so a word was chosen for them` };
  }
  if (state.phase === 'drawing') return reveal(state, 'timeUp', now);
  return nextTurn(state, now, random);
}

// Everyone agreed, an undo was approved, or the server restarted: the current phase gets its full time from `now`
export function resumeClock(state: GameState, now: number): GameState {
  return state.started && !state.isGameOver ? { ...state, phaseStartedAt: now } : state;
}

// shortcut: no `now` reaches this hook, so a reveal made here keeps the old phaseStartedAt and its pause can be cut
// short; the drawer leaving moves the turn, and the platform then calls resumeClock, which restarts it
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const now = state.phaseStartedAt ?? 0;
  if (seat === state.drawer) {
    if (state.phase === 'drawing') return reveal(state, 'drawerLeft', now);
    if (state.phase === 'choosing') return nextTurn(state, now, random);
    return state;
  }
  if (state.phase === 'drawing' && state.guessed.length > 0 && everyoneGuessed(state)) return reveal(state, 'allGuessed', now);
  return state;
}

// shortcut: a minimal safe view; Task 3 finalizes the audiences, spectators and history
export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { deck: _deck, wordChoices, word, chat, ...view } = state;
  const isDrawer = viewer !== null && viewer === state.drawer;
  const knows = isDrawer || (viewer !== null && state.guessed.includes(viewer));
  const open = state.phase === 'reveal' || state.isGameOver;
  return {
    ...view,
    undoAvailable,
    mask: word === null ? '' : maskOf(word),
    word: knows || open ? word : null,
    wordChoices: isDrawer && state.phase === 'choosing' ? wordChoices : [],
    chat: chat.filter(line => line.audience === 'all' || (line.audience === 'guessed' ? knows : line.audience === viewer))
  };
}
