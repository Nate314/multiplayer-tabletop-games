// The guessing turn: one seat picks a word and draws or acts it while the rest guess in the chat.
// A game passes its words, house rules and texts; everything else (scoring, phases, chat audience, views) is here
import { houseRule, type ChoiceRule } from '../houseRules.ts';
import { asRecord } from '../messages.ts';
import { nextActivePlayer } from '../seating.ts';
import { shuffle } from '../shuffle.ts';
import { isClose, isCorrect, maskOf } from '../guess.ts';
import type { BaseGameState, Random, Result, Seat, Standing } from '../types.ts';
import { phaseDeadline, phaseMs } from './clock.ts';
import type { ChatLine, GuessLastMove, GuessPublic, GuessState } from './types.ts';

export const DRAWER_POINTS = 25;
const MAX_CHAT_LENGTH = 100;
const CHAT_LINES = 200;

export function guesserPoints(msLeft: number, turnMs: number): number {
  return 10 + Math.round(90 * msLeft / turnMs);
}

export type GuessConfig<S extends GuessState> = {
  words: readonly string[];
  turnSeconds: ChoiceRule<number>;
  choices: ChoiceRule<number>;
  turnsPerPlayer: ChoiceRule<number>;
  noun: string; // 'word' or 'prompt', in every text
  verb: string; // 'drawing' or 'acting', in the status
  freshTurn(state: S): Partial<S>; // the game's own fields cleared when a turn starts (a drawing game: its strokes)
};

export function guessGame<S extends GuessState>(config: GuessConfig<S>) {
  const { words, turnSeconds, choices, turnsPerPlayer, noun, verb, freshTurn } = config;

  function guessFields(): Omit<GuessState, keyof BaseGameState> {
    return {
      phase: 'choosing',
      deck: [],
      wordChoices: [],
      word: null,
      drawer: null,
      phaseStartedAt: null,
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
  function deal(state: S, random: Random): Pick<S, 'deck' | 'wordChoices'> {
    const count = houseRule(state, choices);
    const deck = state.deck.length >= count
      ? state.deck
      : [...state.deck, ...shuffle(words.filter(word => !state.deck.includes(word)), random)];
    return { deck: deck.slice(count), wordChoices: deck.slice(0, count) };
  }

  // Before the first move: a fresh deck, everyone at zero, and seat 1 choosing with no clock running
  function resetLobby(state: S, random: Random): S {
    const zero = Object.fromEntries(state.activePlayers.map(seat => [seat, 0]));
    return {
      ...state,
      ...deal({ ...state, deck: shuffle(words, random) }, random),
      phase: 'choosing',
      word: null,
      drawer: state.currentPlayer,
      phaseStartedAt: null,
      ...freshTurn(state),
      guessed: [],
      scores: zero,
      draws: { ...zero },
      chat: [],
      lastMove: null
    };
  }

  function addLine(state: S, line: Omit<ChatLine, 'id'>): Pick<S, 'chat' | 'nextChatId'> {
    return { chat: [...state.chat, { id: state.nextChatId, ...line }].slice(-CHAT_LINES), nextChatId: state.nextChatId + 1 };
  }

  function reveal(state: S, reason: 'allGuessed' | 'timeUp' | 'drawerLeft', now: number): S {
    const word = state.word ?? '';
    const drawer = state.drawer as Seat;
    const lastMove: GuessLastMove = { type: 'reveal', word, reason };
    // The word is public now, and a later turn's `guessed` would otherwise decide who sees these lines
    const opened = { ...state, chat: state.chat.map(line => line.audience === 'guessed' ? { ...line, audience: 'all' as const } : line) };
    return {
      ...opened,
      ...addLine(opened, { kind: 'system', seat: null, text: `The ${noun} was ${word}`, audience: 'all' }),
      phase: 'reveal',
      phaseStartedAt: now,
      draws: { ...state.draws, [drawer]: (state.draws[drawer] ?? 0) + 1 },
      lastMove,
      gameStatus: `The ${noun} was ${word}`
    };
  }

  function endGame(state: S): S {
    const top = Math.max(...state.activePlayers.map(seat => state.scores[seat] ?? 0));
    const winners = state.activePlayers.filter(seat => (state.scores[seat] ?? 0) === top);
    const names = winners.map(seat => state.playerNames[seat]).join(' and ');
    return { ...state, isGameOver: true, currentPlayer: null, winners, gameStatus: `${names} won with ${top} points` };
  }

  // The next seat after the drawer with turns left, or the end of the game when nobody has any
  function nextTurn(state: S, now: number, random: Random): S {
    const limit = houseRule(state, turnsPerPlayer);
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
          ...freshTurn(state),
          guessed: [],
          lastMove: { type: 'nextTurn', playerNumber: seat },
          gameStatus: `${state.playerNames[seat]} is choosing a ${noun}`
        };
      }
    }
    return endGame(state);
  }

  function startGuessing(state: S, index: number, now: number, lastMove: GuessLastMove): S {
    const drawer = state.drawer as Seat;
    return {
      ...state,
      word: state.wordChoices[index],
      wordChoices: [],
      phase: 'drawing',
      phaseStartedAt: now,
      ...freshTurn(state),
      guessed: [],
      lastMove,
      gameStatus: `${state.playerNames[drawer]} is ${verb}`
    };
  }

  function guessers(state: S): Seat[] {
    return state.activePlayers.filter(seat => seat !== state.drawer);
  }

  const everyoneGuessed = (state: S) => guessers(state).every(seat => state.guessed.includes(seat));

  function applyMove(state: S, seat: Seat, move: unknown, _random: Random, now: number): Result<S> {
    const input = asRecord(move);
    if (input?.type !== 'choose') return { error: 'Invalid move' };
    if (state.phase !== 'choosing' || seat !== state.drawer) return { error: `You can choose a ${noun} only at the start of your turn` };
    const index = input.index;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= state.wordChoices.length) {
      return { error: `Invalid ${noun} choice` };
    }
    return { state: startGuessing(state, index, now, { type: 'choose', playerNumber: seat }) };
  }

  function chatText(action: unknown): string | null {
    const input = asRecord(action);
    if (input?.type !== 'chat' || typeof input.text !== 'string') return null;
    const text = input.text.trim();
    return text.length > 0 && text.length <= MAX_CHAT_LENGTH ? text : null;
  }

  // A guess counts only from a guesser who has not got it yet, while the turn is on
  function isScoringGuess(state: S, seat: Seat, text: string): boolean {
    return state.phase === 'drawing' && state.word !== null && seat !== state.drawer && state.activePlayers.includes(seat)
      && !state.guessed.includes(seat) && isCorrect(text, state.word);
  }

  function recordsAction(state: S, seat: Seat, action: unknown): boolean {
    const text = chatText(action);
    return text !== null && !state.isGameOver && isScoringGuess(state, seat, text);
  }

  function scoreGuess(state: S, seat: Seat, now: number): S {
    const turnMs = phaseMs(state, turnSeconds);
    const msLeft = Math.min(turnMs, Math.max(0, (state.phaseStartedAt ?? now) + turnMs - now));
    const points = guesserPoints(msLeft, turnMs);
    const drawer = state.drawer as Seat;
    const name = state.playerNames[seat];
    const next: S = {
      ...state,
      ...addLine(state, { kind: 'guessed', seat, text: `${name} guessed the ${noun}!`, audience: 'all' }),
      guessed: [...state.guessed, seat],
      scores: { ...state.scores, [seat]: (state.scores[seat] ?? 0) + points, [drawer]: (state.scores[drawer] ?? 0) + DRAWER_POINTS },
      lastMove: { type: 'guess', playerNumber: seat, points },
      gameStatus: `${name} guessed the ${noun}`
    };
    return everyoneGuessed(next) ? reveal(next, 'allGuessed', now) : next;
  }

  // Chat doubles as guessing
  function chatAction(state: S, seat: Seat, action: unknown, now: number): Result<S> {
    const input = asRecord(action);
    if (input?.type !== 'chat') return { error: 'Invalid action' };
    const text = chatText(action);
    if (text === null) return { error: 'Messages are 1 to 100 characters' };
    if (state.isGameOver) return { error: 'The game is over' };
    if (isScoringGuess(state, seat, text)) return { state: scoreGuess(state, seat, now) };
    // While the turn is on, the drawer and those who guessed talk only among themselves, so they cannot give it away
    const knows = state.phase === 'drawing' && (seat === state.drawer || state.guessed.includes(seat));
    const close = state.phase === 'drawing' && !knows && state.word !== null && isClose(text, state.word);
    const line: Omit<ChatLine, 'id'> = close
      ? { kind: 'close', seat, text: `${text}: So close!`, audience: seat }
      : { kind: 'chat', seat, text, audience: knows ? 'guessed' : 'all' };
    return { state: { ...state, ...addLine(state, line) } };
  }

  function deadline(state: S): number | null {
    return phaseDeadline(state, turnSeconds);
  }

  function onDeadline(state: S, now: number, random: Random): S {
    if (state.phase === 'choosing') {
      const drawer = state.drawer as Seat;
      const index = Math.floor(random() * state.wordChoices.length);
      const chosen = startGuessing(state, index, now, { type: 'autoChoose', playerNumber: drawer });
      return { ...chosen, gameStatus: `${state.playerNames[drawer]} ran out of time, so a ${noun} was chosen for them` };
    }
    if (state.phase === 'drawing') {
      const reason = !state.activePlayers.includes(state.drawer as Seat) ? 'drawerLeft'
        : state.guessed.length > 0 && everyoneGuessed(state) ? 'allGuessed' : 'timeUp';
      return reveal(state, reason, now);
    }
    return nextTurn(state, now, random);
  }

  // Everyone agreed, an undo was approved, or the server restarted: the current phase gets its full time from `now`
  function resumeClock(state: S, now: number): S {
    return state.started && !state.isGameOver ? { ...state, phaseStartedAt: now } : state;
  }

  // No `now` reaches this hook. The drawer leaving moves the turn, so the platform's resumeClock times the reveal or
  // the next turn from now. A guesser leaving does not, so the turn's deadline is put in the past (0, since JSON
  // saves -Infinity as null) and onDeadline makes the reveal on the server clock
  function onPlayerLeft(state: S, seat: Seat, random: Random): S {
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

  function view(state: S, undoAvailable: boolean, viewer: Seat | null, knowsWord: boolean, seesChoices: boolean): Omit<GuessPublic<S>, 'moveCount'> {
    const { deck: _deck, wordChoices, word, chat, ...rest } = state;
    const open = state.phase === 'reveal' || state.isGameOver;
    // TypeScript cannot see through Omit on a generic state, so the shape is asserted here
    return {
      ...rest,
      undoAvailable,
      mask: word === null ? '' : maskOf(word),
      word: knowsWord || open ? word : null,
      wordChoices: seesChoices && state.phase === 'choosing' ? wordChoices : [],
      chat: visibleLines(chat, viewer, knowsWord)
    } as unknown as Omit<GuessPublic<S>, 'moveCount'>;
  }

  // A seat sees the word once it guessed it or while drawing it; `null` is the history and the table screen
  function toPublicState(state: S, undoAvailable: boolean, viewer: Seat | null): Omit<GuessPublic<S>, 'moveCount'> {
    const isDrawer = viewer !== null && viewer === state.drawer;
    return view(state, undoAvailable, viewer, isDrawer || (viewer !== null && state.guessed.includes(viewer)), isDrawer);
  }

  function privateSeatView(state: S, seat: Seat): Pick<GuessPublic<S>, 'word' | 'wordChoices' | 'chat'> {
    const { word, wordChoices, chat } = toPublicState(state, false, seat);
    return { word, wordChoices, chat };
  }

  // Spectators send no chat, so they may see the word and every seat's near-miss lines; a table screen is in view of the players and gets the blanks
  function spectatorState(state: S, undoAvailable: boolean, tableScreen: boolean): Omit<GuessPublic<S>, 'moveCount'> {
    return tableScreen ? toPublicState(state, undoAvailable, null) : { ...view(state, undoAvailable, null, true, true), chat: state.chat };
  }

  function finalStandings(state: S): Standing[] {
    // Winners first, so place 1 is exactly `winners` even when a dismissal ended the game without scoring
    const rank = (seat: Seat) => (state.winners.includes(seat) ? 1e9 : 0) + (state.scores[seat] ?? 0);
    const score = (seat: Seat) => state.scores[seat] ?? 0;
    return [...state.activePlayers].sort((a, b) => rank(b) - rank(a)).map(seat => ({
      seat,
      place: 1 + state.activePlayers.filter(other => rank(other) > rank(seat)).length,
      score: `${score(seat)} points`
    }));
  }

  return {
    guessFields, resetLobby, applyMove, chatAction, recordsAction, deadline, onDeadline, resumeClock, onPlayerLeft,
    toPublicState, privateSeatView, spectatorState, finalStandings
  };
}
