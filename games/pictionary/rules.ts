import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random, Result, Seat, Standing } from '../../shared/types.ts';
import { CANVAS_H, CANVAS_W, MAX_POINTS, PALETTE, phaseDeadline, phaseMs } from './clock.ts';
import { DRAWS_PER_PLAYER, TURN_SECONDS, WORD_CHOICES } from './options.ts';
import { isClose, isCorrect, maskOf } from './text.ts';
import type { ChatLine, GameState, LastMove, PublicGameState, Stroke, Tool } from './types.ts';
import { WORDS } from './words.ts';

export const DRAWER_POINTS = 25;
const MAX_CHAT_LENGTH = 100;
const CHAT_LINES = 200;

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
  return { chat: [...state.chat, { id: state.nextChatId, ...line }].slice(-CHAT_LINES), nextChatId: state.nextChatId + 1 };
}

function reveal(state: GameState, reason: 'allGuessed' | 'timeUp' | 'drawerLeft', now: number): GameState {
  const word = state.word ?? '';
  const drawer = state.drawer as Seat;
  const lastMove: LastMove = { type: 'reveal', word, reason };
  // The word is public now, and a later turn's `guessed` would otherwise decide who sees these lines
  const opened = { ...state, chat: state.chat.map(line => line.audience === 'guessed' ? { ...line, audience: 'all' as const } : line) };
  return {
    ...opened,
    ...addLine(opened, { kind: 'system', seat: null, text: `The word was ${word}`, audience: 'all' }),
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
    ...addLine(state, { kind: 'guessed', seat, text: `${name} guessed the word!`, audience: 'all' }),
    guessed: [...state.guessed, seat],
    scores: { ...state.scores, [seat]: (state.scores[seat] ?? 0) + points, [drawer]: (state.scores[drawer] ?? 0) + DRAWER_POINTS },
    lastMove: { type: 'guess', playerNumber: seat, points },
    gameStatus: `${name} guessed the word`
  };
  return everyoneGuessed(next) ? reveal(next, 'allGuessed', now) : next;
}

const MAX_ACTION_NUMBERS = 200;
const STROKE_ACTIONS = ['stroke', 'extend', 'fill', 'undoStroke', 'clear'];

const isColor = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) < PALETTE.length;
const isCoord = (value: unknown, max: number): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;

function validPoints(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 2 && value.length <= MAX_ACTION_NUMBERS && value.length % 2 === 0
    && value.every((n, i) => isCoord(n, i % 2 === 0 ? CANVAS_W : CANVAS_H));
}

const usedPoints = (strokes: Stroke[]) => strokes.reduce((sum, stroke) => sum + (stroke.kind === 'line' ? stroke.points.length : 2), 0);

// shortcut: every stroke action rewrites and broadcasts the whole state, so MAX_POINTS and the client's 100 ms batching keep it small, upgrade to a platform broadcast-only channel if drawings lag
function drawAction(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  if (state.phase !== 'drawing' || seat !== state.drawer || state.isGameOver) return { error: 'Only the drawer can draw' };
  const strokes = state.strokes;
  const last = strokes[strokes.length - 1];
  const add = (stroke: Stroke): Result<GameState> => ({ state: { ...state, strokes: [...strokes, stroke], nextStrokeId: state.nextStrokeId + 1 } });
  const full = (extra: number) => usedPoints(strokes) + extra > MAX_POINTS;
  const fullError = { error: 'The drawing is full; undo or clear to keep drawing' };
  switch (input.type) {
    case 'undoStroke': return { state: { ...state, strokes: strokes.slice(0, -1) } };
    case 'clear': return { state: { ...state, strokes: [] } };
    case 'fill':
      if (!isColor(input.color) || !isCoord(input.x, CANVAS_W) || !isCoord(input.y, CANVAS_H)) return { error: 'Invalid fill' };
      return full(2) ? fullError : add({ id: state.nextStrokeId, kind: 'fill', color: input.color, x: input.x, y: input.y });
    case 'extend': {
      if (last?.kind !== 'line' || input.id !== last.id || !validPoints(input.points)) return { error: 'Invalid stroke' };
      const points = input.points;
      if (full(points.length)) return fullError;
      return { state: { ...state, strokes: [...strokes.slice(0, -1), { ...last, points: [...last.points, ...points] }] } };
    }
    default: {
      const { tool, color, size, points } = input;
      if ((tool !== 'pen' && tool !== 'eraser') || !isColor(color) || (size !== 0 && size !== 1 && size !== 2) || !validPoints(points)) {
        return { error: 'Invalid stroke' };
      }
      return full(points.length) ? fullError : add({ id: state.nextStrokeId, kind: 'line', tool: tool as Tool, color, size, points });
    }
  }
}

// Chat doubles as guessing
export function applyAction(state: GameState, seat: Seat, action: unknown, _random: Random, now: number): Result<GameState> {
  const input = asRecord(action);
  if (typeof input?.type === 'string' && STROKE_ACTIONS.includes(input.type)) return drawAction(state, seat, input);
  if (input?.type !== 'chat') return { error: 'Invalid action' };
  const text = chatText(action);
  if (text === null) return { error: 'Messages are 1 to 100 characters' };
  if (state.isGameOver) return { error: 'The game is over' };
  if (isScoringGuess(state, seat, text)) return { state: scoreGuess(state, seat, now) };
  // While the drawing is on, the drawer and those who guessed talk only among themselves, so they cannot give it away
  const knows = state.phase === 'drawing' && (seat === state.drawer || state.guessed.includes(seat));
  const close = state.phase === 'drawing' && !knows && state.word !== null && isClose(text, state.word);
  const line: Omit<ChatLine, 'id'> = close
    ? { kind: 'close', seat, text: `${text}: So close!`, audience: seat }
    : { kind: 'chat', seat, text, audience: knows ? 'guessed' : 'all' };
  return { state: { ...state, ...addLine(state, line) } };
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
  if (state.phase === 'drawing') {
    const reason = !state.activePlayers.includes(state.drawer as Seat) ? 'drawerLeft'
      : state.guessed.length > 0 && everyoneGuessed(state) ? 'allGuessed' : 'timeUp';
    return reveal(state, reason, now);
  }
  return nextTurn(state, now, random);
}

// Everyone agreed, an undo was approved, or the server restarted: the current phase gets its full time from `now`
export function resumeClock(state: GameState, now: number): GameState {
  return state.started && !state.isGameOver ? { ...state, phaseStartedAt: now } : state;
}

// No `now` reaches this hook. The drawer leaving moves the turn, so the platform's resumeClock times the reveal or
// the next turn from now. A guesser leaving does not, so the drawing deadline is put in the past (0, since JSON
// saves -Infinity as null) and onDeadline makes the reveal on the server clock
export function onPlayerLeft(state: GameState, seat: Seat, random: Random): GameState {
  const now = state.phaseStartedAt ?? 0;
  if (seat === state.drawer) {
    if (state.phase === 'drawing') return reveal(state, 'drawerLeft', now);
    if (state.phase === 'choosing') return nextTurn(state, now, random);
    return state;
  }
  if (state.phase === 'drawing' && state.guessed.length > 0 && everyoneGuessed(state)) return { ...state, phaseStartedAt: 0 };
  return state;
}

// The one chat filter: 'guessed' lines go to those who know the word, a seat's own lines only to that seat
function visibleLines(chat: ChatLine[], viewer: Seat | null, knowsWord: boolean): ChatLine[] {
  return chat.filter(line => line.audience === 'all' || (line.audience === 'guessed' ? knowsWord : line.audience === viewer));
}

function view(state: GameState, undoAvailable: boolean, viewer: Seat | null, knowsWord: boolean, seesChoices: boolean): Omit<PublicGameState, 'moveCount'> {
  const { deck: _deck, wordChoices, word, chat, ...rest } = state;
  const open = state.phase === 'reveal' || state.isGameOver;
  return {
    ...rest,
    undoAvailable,
    mask: word === null ? '' : maskOf(word),
    word: knowsWord || open ? word : null,
    wordChoices: seesChoices && state.phase === 'choosing' ? wordChoices : [],
    chat: visibleLines(chat, viewer, knowsWord)
  };
}

// A seat sees the word once it guessed it or while drawing it; `null` is the history and the table screen
export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const isDrawer = viewer !== null && viewer === state.drawer;
  return view(state, undoAvailable, viewer, isDrawer || (viewer !== null && state.guessed.includes(viewer)), isDrawer);
}

export function privateSeatView(state: GameState, seat: Seat): Pick<PublicGameState, 'word' | 'wordChoices' | 'chat'> {
  const { word, wordChoices, chat } = toPublicState(state, false, seat);
  return { word, wordChoices, chat };
}

// Spectators send no chat, so they may see the word; a table screen is in view of the players and gets the blanks
export function spectatorState(state: GameState, undoAvailable: boolean, tableScreen: boolean): Omit<PublicGameState, 'moveCount'> {
  return tableScreen ? toPublicState(state, undoAvailable, null) : view(state, undoAvailable, null, true, true);
}

export function finalStandings(state: GameState): Standing[] {
  // Winners first, so place 1 is exactly `winners` even when a dismissal ended the game without scoring
  const rank = (seat: Seat) => (state.winners.includes(seat) ? 1e9 : 0) + (state.scores[seat] ?? 0);
  const score = (seat: Seat) => state.scores[seat] ?? 0;
  return [...state.activePlayers].sort((a, b) => rank(b) - rank(a)).map(seat => ({
    seat,
    place: 1 + state.activePlayers.filter(other => rank(other) > rank(seat)).length,
    score: `${score(seat)} points`
  }));
}
