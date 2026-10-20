// The Crew rules shared by the browser (playable cards, mission text) and the server (validation).
//
// From Wikipedia's "The Crew (card game)" article and, where it is silent, the publisher's rulebook (Kosmos, 2019):
// - Deck: pink, blue, green and yellow cards 1 to 9 and rockets 1 to 4, 40 cards, dealt out evenly. With three
//   players one gets an extra card, which stays unplayed after the last trick.
// - The holder of the 4 rocket is the commander: they take the first task, lead the first trick and carry out the
//   mission's special rules.
// - Tasks: the mission's number of task cards (smaller copies of the color cards) are laid out, with any order tokens
//   on them from the first on, and taken one at a time in turn from the commander. A task is done when its owner wins
//   the trick holding its card; if anyone else wins that card, the mission fails at once. The mission is done when
//   every task is.
// - Tricks: follow the suit led if you can, else play anything; rockets are trump, the highest rocket wins, else the
//   highest card of the suit led. The winner leads the next trick.
// - Order tokens: 1 to 5 make a task the first to fifth done of all the tasks, the arrows order only the arrow tasks
//   among themselves, and omega makes a task the last done. Tasks with consecutive tokens done in one trick both count.
// - Communication: once per mission, between tricks (the first one included) and after the tasks are shared out, a
//   player may lay a color card face up with the radio token saying it is their highest, lowest or only card of that
//   color. It must be true when made. Rockets are never communicated.
// - Distress signal: before the first trick and before anyone communicates, the crew may send it: everyone passes one
//   card, never a rocket, to the same side. It stays active for the mission's retries and counts one more attempt.
// - The mission specials (commander's decision and distribution, dead spot, disruption and the rest) are in missions.ts.
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, connectedPlayers } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { canFollow, trickWinner } from '../../shared/tricks.ts';
import type { Random } from '../../shared/types.ts';
import { LAST_MISSION, allowsHandOver, missionOf } from './missions.ts';
import type {
  Card, Color, CommToken, Communication, Direction, GameState, LastMove, Mission, MissionSummary, Move, OrderToken,
  Play, PublicGameState, Result, Role, Rule, Seat, Suit, Task, Trick
} from './types.ts';

export const COLORS: Color[] = ['pink', 'blue', 'green', 'yellow'];
export const MIN_PLAYERS = 3;
const COMM_TOKENS: CommToken[] = ['highest', 'lowest', 'only'];

export function buildDeck(): Card[] {
  return [
    ...COLORS.flatMap(suit => [1, 2, 3, 4, 5, 6, 7, 8, 9].map(value => ({ suit, value }))),
    ...[1, 2, 3, 4].map(value => ({ suit: 'rocket' as const, value }))
  ];
}

// The task cards are the 36 color cards
export function taskDeck(): Card[] {
  return buildDeck().filter(card => card.suit !== 'rocket');
}

export const totalTricks = (players: number) => Math.floor(40 / players);
export const sameCard = (a: Card, b: Card) => a.suit === b.suit && a.value === b.value;
export const cardName = (card: Card) => `${card.suit} ${card.value}`;
export const tokenName = (token: OrderToken) => (token === 'omega' ? 'Ω' : String(token));
const suitOf = (card: Card): Suit => card.suit;
const isRocket = (card: Card) => card.suit === 'rocket';

// Play runs to the left: the next seat up, wrapping round
export function leftOf(state: Pick<GameState, 'activePlayers'>, seat: Seat): Seat {
  const seats = state.activePlayers;
  return seats[(seats.indexOf(seat) + 1) % seats.length];
}

export function rightOf(state: Pick<GameState, 'activePlayers'>, seat: Seat): Seat {
  const seats = state.activePlayers;
  return seats[(seats.indexOf(seat) + seats.length - 1) % seats.length];
}

export function canPlayCard(hand: Card[], card: Card, trick: Play[]): boolean {
  return canFollow(hand, card, trick, suitOf);
}

// The communication tokens a card could truthfully carry
export function trueTokens(hand: Card[], card: Card): CommToken[] {
  if (isRocket(card)) return [];
  const same = hand.filter(held => held.suit === card.suit);
  if (same.length === 1) return ['only'];
  const tokens: CommToken[] = [];
  if (same.every(held => held.value <= card.value)) tokens.push('highest');
  if (same.every(held => held.value >= card.value)) tokens.push('lowest');
  return tokens;
}

// The mission's special rules in words, for the screen and the scoring
export function missionRules(mission: Mission, players: number): string[] {
  const lines: string[] = [];
  const rule = mission.rule;
  if (mission.tasks > 0) {
    const tokens = mission.tokens.length > 0 ? `, order tokens ${mission.tokens.map(tokenName).join(' ')}` : '';
    lines.push(`${mission.tasks} ${mission.tasks === 1 ? 'task' : 'tasks'}${tokens}`);
  }
  if (rule) lines.push(ruleText(rule));
  if (mission.deadSpot) lines.push('Dead spot: a communicated card shows no radio token');
  if (mission.commsFrom) lines.push(`Disruption: nobody may communicate before trick ${mission.commsFrom}`);
  if (allowsHandOver(mission, players)) lines.push('Five players: before the first trick, one task may be handed to another crew member');
  return lines;
}

export function ruleText(rule: Rule): string {
  switch (rule.kind) {
    case 'sick': return 'The commander names a sick crew member, who must not win a single trick';
    case 'oneWins': return rule.count === 1 ? 'A color card of value 1 must win a trick' : `${rule.count} tricks must each be won by a color card of value 1`;
    case 'mute': return 'The commander names another crew member, who may not communicate in this mission';
    case 'drawFromRight': return 'Right after the first trick, everyone draws a random card from the player on their right';
    case 'rocketsWin': return rule.ordered ? 'Each rocket must win a trick: first the 1, then the 2, the 3 and the 4' : 'Each rocket must win a trick';
    case 'noNines': return 'No trick may be won by a 9';
    case 'takesAll': return "Commander's decision: the tasks lie face down and the commander names another crew member, who takes them all";
    case 'distribution': return "Commander's distribution: the commander hands out the tasks one at a time; nobody may end with two more than another";
    case 'swapTokens': return 'Before the tasks are taken, the commander may swap two order tokens';
    case 'moveToken': return 'Before the tasks are taken, the commander may move one order token to a task without one';
    case 'balanced': return rule.commanderFirstLast
      ? 'Nobody may ever have won two tricks more than another, and the commander must win the first and the last trick'
      : 'Nobody may ever have won two tricks more than another';
    case 'exactlyOneTrick': return 'The commander names a crew member, who must win exactly one trick, and not with a rocket';
    case 'firstAndLastOnly': return 'The commander names a crew member, who must win only the first and the last trick, neither with a rocket';
    case 'allPink': return "The player to the left of the pink 9's holder must win every pink card";
    case 'omegaInLastTrick': return 'The Ω task must be won in the last trick';
    case 'relay': return 'The commander names who wins tricks 1 to 4 and nothing else, and who wins only the last trick; the others win every trick between';
  }
}

// Everything that lasts only for one attempt
const ATTEMPT_START = {
  passedThisAttempt: false,
  handedOver: false,
  phase: 'play',
  commander: null,
  tasks: [],
  chosen: [],
  communications: {},
  distress: null,
  trick: [],
  lastTrick: null,
  tricks: [],
  roundSummary: null,
  endVotes: {},
  lastMove: null
} satisfies Partial<GameState>;

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    ...ATTEMPT_START,
    startMission: 1,
    mission: 1,
    attempt: 1,
    lastCompleted: null,
    distressUsed: false,
    hands: {}
  };
}

const DECISIONS: Rule['kind'][] = ['sick', 'mute', 'takesAll', 'exactlyOneTrick', 'firstAndLastOnly', 'relay'];

// What comes after the deal, the token move or the commander's pick
function setupPhase(state: GameState): GameState['phase'] {
  const rule = missionOf(state.mission).rule;
  if (state.tasks.every(t => t.owner !== null)) return 'play';
  return rule?.kind === 'distribution' ? 'distribute' : 'choose';
}

// A fresh shuffle for this attempt: the cards dealt round the table, the tasks drawn and the commander found
export function dealMission(state: GameState, random: Random): GameState {
  const seats = state.activePlayers;
  const mission = missionOf(state.mission);
  const hands: Record<Seat, Card[]> = Object.fromEntries(seats.map(seat => [seat, []]));
  shuffle(buildDeck(), random).forEach((card, index) => hands[seats[index % seats.length]].push(card));
  const holder = (card: Card) => seats.find(seat => hands[seat].some(held => sameCard(held, card))) ?? seats[0];
  const commander = holder({ suit: 'rocket', value: 4 });
  const tasks: Task[] = shuffle(taskDeck(), random).slice(0, mission.tasks)
    .map((card, index) => ({ card, token: mission.tokens[index] ?? null, owner: null, done: false }));
  const dealt: GameState = {
    ...state, ...ATTEMPT_START, hands, commander, tasks, currentPlayer: commander,
    chosen: mission.rule?.kind === 'allPink' ? [leftOf(state, holder({ suit: 'pink', value: 9 }))] : []
  };
  const kind = mission.rule?.kind;
  const phase = kind === 'swapTokens' || kind === 'moveToken' ? 'tokens'
    : kind && DECISIONS.includes(kind) ? 'decision' : setupPhase(dealt);
  return { ...dealt, phase };
}

// Before the first move the mission is dealt afresh whenever someone joins or leaves, once three are seated
export function resetLobby(state: GameState, random: Random): GameState {
  const empty: GameState = {
    ...state, ...ATTEMPT_START, mission: state.startMission, attempt: 1, lastCompleted: null, distressUsed: false, hands: {}
  };
  return state.activePlayers.length < MIN_PLAYERS ? empty : dealMission(empty, random);
}

// Face down: every task during a commander's decision, and the tasks after the one being handed out
function faceDownTasks(state: GameState): (index: number) => boolean {
  const firstOpen = state.tasks.findIndex(t => t.owner === null);
  const deciding = state.phase === 'decision' && missionOf(state.mission).rule?.kind === 'takesAll';
  return index => deciding || (state.phase === 'distribute' && state.tasks[index].owner === null && index !== firstOpen);
}

// After an undo the face-down tasks are drawn again from the task cards not on the table, keeping each place's order
// token, so undoing a commander's pick cannot show the crew what was face down
export function onUndo(state: GameState, random: Random): GameState {
  const faceDown = faceDownTasks(state);
  if (!state.tasks.some((_, index) => faceDown(index))) return state;
  const unused = shuffle(taskDeck().filter(card => !state.tasks.some(t => sameCard(t.card, card))), random);
  return { ...state, tasks: state.tasks.map((t, index) => (faceDown(index) ? { ...t, card: unused.pop() ?? t.card } : t)) };
}

export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  const { hands, tasks, tricks, distress, communications, ...view } = state;
  const faceDown = faceDownTasks(state);
  return {
    ...view,
    hand: viewer === null ? [] : hands[viewer] ?? [],
    handCounts: Object.fromEntries(Object.entries(hands).map(([seat, hand]) => [seat, hand.length])),
    tasks: tasks.map((t, index) => (faceDown(index) ? { ...t, card: null } : t)),
    trickWinners: tricks.map(t => t.winner),
    communications: Object.fromEntries(Object.entries(communications).map(([seat, said]) =>
      [seat, { ...said, held: (hands[Number(seat)] ?? []).some(card => sameCard(card, said.card)) }])),
    distress: distress && {
      direction: distress.direction,
      passed: Object.keys(distress.passes).map(Number),
      mine: viewer === null ? null : distress.passes[viewer] ?? null
    },
    undoAvailable
  };
}

function parseCard(value: unknown): Card | null {
  const input = asRecord(value);
  const suit = input?.suit;
  const card = buildDeck().find(held => held.suit === suit && held.value === input?.value);
  return card ?? null;
}

const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

// Reads a move as it arrives over the network, or null if it is not shaped like one
function parseMove(move: unknown): Move | null {
  const input = asRecord(move);
  switch (input?.type) {
    case 'takeTask':
      return isInteger(input.task) ? { type: 'takeTask', task: input.task } : null;
    case 'choosePlayer':
    case 'assignTask':
      return isInteger(input.seat) ? { type: input.type, seat: input.seat } : null;
    case 'moveToken':
      return isInteger(input.from) && isInteger(input.to) ? { type: 'moveToken', from: input.from, to: input.to } : null;
    case 'keepTokens':
      return { type: 'keepTokens' };
    case 'distress':
      return input.direction === 'left' || input.direction === 'right' ? { type: 'distress', direction: input.direction } : null;
    case 'handOverTask':
      return isInteger(input.task) && isInteger(input.to) ? { type: 'handOverTask', task: input.task, to: input.to } : null;
    case 'play': {
      const card = parseCard(input.card);
      return card ? { type: 'play', card } : null;
    }
    default:
      return null;
  }
}

const ROLE_TEXT: Record<Role, string> = {
  sick: 'as the sick crew member, who must not win a trick',
  mute: 'who may not communicate in this mission',
  takesAll: 'to take all the tasks',
  oneTrick: 'who must win exactly one trick, not with a rocket',
  firstLast: 'who must win only the first and the last trick, not with rockets',
  relayFirst: 'to win tricks 1 to 4',
  relayLast: 'to win the last trick'
};

// How the status line and the history describe a move, e.g. 'Alice took the task pink 3' or 'Bob played rocket 2'
export function describeMove(lastMove: LastMove, playerNames: Record<Seat, string>): string {
  const name = playerNames[lastMove.playerNumber];
  switch (lastMove.type) {
    case 'takeTask':
      return `${name} took the task ${cardName(lastMove.card)}${lastMove.token === null ? '' : `, order token ${tokenName(lastMove.token)}`}`;
    case 'choosePlayer': {
      const joiner = lastMove.role === 'sick' || lastMove.role.startsWith('relay') || lastMove.role === 'takesAll' ? ' ' : ', ';
      return `${name} chose ${playerNames[lastMove.seat]}${joiner}${ROLE_TEXT[lastMove.role]}`;
    }
    case 'assignTask':
      return `${name} gave ${playerNames[lastMove.seat]} the task ${cardName(lastMove.card)}`;
    case 'moveToken':
      return lastMove.swap
        ? `${name} swapped the order tokens of ${cardName(lastMove.from)} and ${cardName(lastMove.to)}`
        : `${name} moved the order token from ${cardName(lastMove.from)} to ${cardName(lastMove.to)}`;
    case 'keepTokens':
      return `${name} left the order tokens where they were`;
    case 'distress':
      return `${name} sent a distress signal: everyone passes a card to the ${lastMove.direction}`;
    case 'handOverTask':
      return `${playerNames[lastMove.from]} handed the task ${cardName(lastMove.card)} to ${playerNames[lastMove.to]}`;
    case 'play': {
      let text = `${name} played ${cardName(lastMove.card)}`;
      if (lastMove.trickWinner === lastMove.playerNumber) text += ' and won the trick';
      else if (lastMove.trickWinner !== null) text += `; ${playerNames[lastMove.trickWinner]} won the trick`;
      if (lastMove.result === 'success') text += '. Mission complete!';
      if (lastMove.result === 'failure') text += '. The mission failed';
      return text;
    }
  }
}

function recorded(state: GameState, lastMove: LastMove, gameStatus = describeMove(lastMove, state.playerNames)): GameState {
  return { ...state, lastMove, gameStatus };
}

function takeTask(state: GameState, seat: Seat, index: number): Result<GameState> {
  const chosen = state.tasks[index];
  if (!chosen) return { error: 'There is no such task' };
  if (chosen.owner !== null) return { error: 'That task is taken' };
  const tasks = state.tasks.map((t, i) => (i === index ? { ...t, owner: seat } : t));
  const next: GameState = { ...state, tasks };
  const phase = setupPhase(next);
  const currentPlayer = phase === 'play' ? state.commander : leftOf(state, seat);
  return { state: recorded({ ...next, phase, currentPlayer }, { type: 'takeTask', playerNumber: seat, card: chosen.card, token: chosen.token }) };
}

function choosePlayer(state: GameState, seat: Seat, target: Seat): Result<GameState> {
  const rule = missionOf(state.mission).rule;
  if (!state.activePlayers.includes(target)) return { error: 'Choose a crew member at the table' };
  if ((rule?.kind === 'mute' || rule?.kind === 'takesAll') && target === state.commander) {
    return { error: 'Choose a crew member other than the commander' };
  }
  if (rule?.kind === 'relay' && state.chosen.includes(target)) return { error: 'Choose a different crew member for the last trick' };
  const chosen = [...state.chosen, target];
  const roles: Partial<Record<Rule['kind'], Role>> = {
    sick: 'sick', mute: 'mute', takesAll: 'takesAll', exactlyOneTrick: 'oneTrick', firstAndLastOnly: 'firstLast'
  };
  const role: Role = rule?.kind === 'relay' ? (chosen.length === 1 ? 'relayFirst' : 'relayLast') : roles[rule?.kind ?? 'sick'] ?? 'sick';
  const lastMove: LastMove = { type: 'choosePlayer', playerNumber: seat, seat: target, role };
  if (rule?.kind === 'relay' && chosen.length < 2) return { state: recorded({ ...state, chosen }, lastMove) };
  const tasks = rule?.kind === 'takesAll' ? state.tasks.map(t => ({ ...t, owner: target })) : state.tasks;
  const next: GameState = { ...state, chosen, tasks };
  return { state: recorded({ ...next, phase: setupPhase(next) }, lastMove) };
}

// The commander's distribution must leave nobody with two tasks more than another at the end
function assignTask(state: GameState, seat: Seat, target: Seat): Result<GameState> {
  if (!state.activePlayers.includes(target)) return { error: 'Choose a crew member at the table' };
  const index = state.tasks.findIndex(t => t.owner === null);
  const seats = state.activePlayers;
  const counts = (owner: Seat) => state.tasks.filter(t => t.owner === owner).length + (owner === target ? 1 : 0);
  const total = state.tasks.length;
  const floor = Math.floor(total / seats.length);
  const left = state.tasks.filter(t => t.owner === null).length - 1;
  const short = seats.reduce((sum, owner) => sum + Math.max(0, floor - counts(owner)), 0);
  if (counts(target) > Math.ceil(total / seats.length) || short > left) {
    return { error: 'Nobody may end up with two tasks more than another' };
  }
  const tasks = state.tasks.map((t, i) => (i === index ? { ...t, owner: target } : t));
  const next: GameState = { ...state, tasks };
  return { state: recorded({ ...next, phase: setupPhase(next) }, { type: 'assignTask', playerNumber: seat, seat: target, card: state.tasks[index].card }) };
}

function moveToken(state: GameState, seat: Seat, from: number, to: number): Result<GameState> {
  const swap = missionOf(state.mission).rule?.kind === 'swapTokens';
  const source = state.tasks[from];
  const target = state.tasks[to];
  if (!source || !target || from === to) return { error: 'Choose two different tasks' };
  if (source.token === null) return { error: 'That task has no order token' };
  if (swap && target.token === null) return { error: 'Swap two order tokens' };
  if (!swap && target.token !== null) return { error: 'Move the token to a task without one' };
  const tasks = state.tasks.map((t, i) => (i === from ? { ...t, token: target.token } : i === to ? { ...t, token: source.token } : t));
  return { state: recorded({ ...state, tasks, phase: setupPhase(state) }, { type: 'moveToken', playerNumber: seat, from: source.card, to: target.card, swap }) };
}

// Before the first trick: no card played yet in this attempt
const beforeFirstTrick = (state: GameState) => state.phase === 'play' && state.tricks.length === 0 && state.trick.length === 0;

function distress(state: GameState, seat: Seat, direction: Direction): Result<GameState> {
  if (!beforeFirstTrick(state)) return { error: 'Send the distress signal before the first trick' };
  if (state.passedThisAttempt) return { error: 'The distress signal was already used in this attempt' };
  if (Object.keys(state.communications).length > 0) return { error: 'Send the distress signal before anyone communicates' };
  const next: GameState = { ...state, phase: 'distress', distressUsed: true, distress: { direction, passes: {} } };
  return { state: recorded(next, { type: 'distress', playerNumber: seat, direction }) };
}

function handOverTask(state: GameState, seat: Seat, index: number, to: Seat): Result<GameState> {
  if (!allowsHandOver(missionOf(state.mission), state.activePlayers.length)) {
    return { error: 'A task may be handed over only with five players, from mission 25 on' };
  }
  if (!beforeFirstTrick(state)) return { error: 'Hand over a task before the first trick' };
  if (state.handedOver) return { error: 'Only one task may be handed over in each attempt' };
  const handed = state.tasks[index];
  if (!handed || handed.owner === null) return { error: 'There is no such task' };
  if (!state.activePlayers.includes(to) || to === handed.owner) return { error: 'Hand the task to another crew member' };
  const tasks = state.tasks.map((t, i) => (i === index ? { ...t, owner: to } : t));
  const lastMove: LastMove = { type: 'handOverTask', playerNumber: seat, from: handed.owner, to, card: handed.card };
  return { state: recorded({ ...state, tasks, handedOver: true }, lastMove) };
}

// Whether the tasks done in this trick can be put in an order their tokens allow, after the ones done before
function inOrder(tasks: Task[], fresh: number[], lastTrick: boolean, omegaInLastTrick: boolean): boolean {
  const total = tasks.length;
  const reserved = (position: number) => tasks.findIndex(t => t.token === position || (t.token === 'omega' && position === total));
  const arrows = (t: Task) => (typeof t.token === 'string' && t.token.startsWith('>') ? t.token.length : 0);
  function place(done: Set<number>, rest: number[]): boolean {
    if (rest.length === 0) return true;
    return rest.some(index => {
      const t = tasks[index];
      const position = done.size + 1;
      const holder = reserved(position);
      if (holder !== -1 && holder !== index) return false;
      if (typeof t.token === 'number' && t.token !== position) return false;
      if (t.token === 'omega' && (position !== total || (omegaInLastTrick && !lastTrick))) return false;
      if (arrows(t) > 0 && tasks.some((other, i) => arrows(other) > 0 && arrows(other) < arrows(t) && !done.has(i))) return false;
      return place(new Set([...done, index]), rest.filter(other => other !== index));
    });
  }
  return place(new Set(tasks.flatMap((t, i) => (t.done ? [i] : []))), fresh);
}

const winningCard = (t: Trick) => t.plays.find(play => play.seat === t.winner)?.card ?? { suit: 'pink', value: 0 };

// The special rule after a trick: a failure, or whether it needs nothing more for the mission to succeed
function checkRule(state: GameState, mission: Mission, tricks: Trick[], last: boolean): { failure?: string; met: boolean } {
  const rule = mission.rule;
  const names = state.playerNames;
  const latest = tricks[tricks.length - 1];
  const wins = (seat: Seat) => tricks.filter(t => t.winner === seat).length;
  const [target, second] = state.chosen;
  switch (rule?.kind) {
    case 'sick':
      return wins(target) > 0 ? { failure: `${names[target]} is sick and must not win a trick`, met: false } : { met: last };
    case 'oneWins':
      return { met: tricks.filter(t => winningCard(t).suit !== 'rocket' && winningCard(t).value === 1).length >= rule.count };
    case 'rocketsWin': {
      const won = tricks.map(winningCard).filter(isRocket).map(card => card.value);
      if (latest.plays.some(play => isRocket(play.card) && !sameCard(play.card, winningCard(latest)))) {
        return { failure: 'Every rocket must win a trick', met: false };
      }
      if (rule.ordered && won.some((value, index) => value !== index + 1)) {
        return { failure: 'The rockets must win in order: 1, 2, 3, then 4', met: false };
      }
      return { met: won.length === 4 };
    }
    case 'noNines': {
      const card = winningCard(latest);
      if (card.suit !== 'rocket' && card.value === 9) return { failure: 'A 9 won a trick', met: false };
      return { met: mission.tasks > 0 || last };
    }
    case 'balanced': {
      const counts = state.activePlayers.map(wins);
      if (Math.max(...counts) - Math.min(...counts) > 1) return { failure: 'Nobody may win two tricks more than another', met: false };
      if (rule.commanderFirstLast && (tricks[0].winner !== state.commander || (last && latest.winner !== state.commander))) {
        return { failure: 'The commander must win the first and the last trick', met: false };
      }
      return { met: last };
    }
    case 'exactlyOneTrick':
      if (wins(target) > 1 || (latest.winner === target && isRocket(winningCard(latest))) || (last && wins(target) === 0)) {
        return { failure: `${names[target]} must win exactly one trick, and not with a rocket`, met: false };
      }
      return { met: last };
    case 'firstAndLastOnly': {
      const end = tricks.length === 1 || last;
      if (end ? latest.winner !== target || isRocket(winningCard(latest)) : latest.winner === target) {
        return { failure: `${names[target]} must win only the first and the last trick, neither with a rocket`, met: false };
      }
      return { met: last };
    }
    case 'allPink': {
      const pinks = latest.plays.filter(play => play.card.suit === 'pink').length;
      if (pinks > 0 && latest.winner !== target) {
        return { failure: `${names[latest.winner]} won a pink card, but only ${names[target]} may`, met: false };
      }
      const taken = tricks.filter(t => t.winner === target).flatMap(t => t.plays).filter(play => play.card.suit === 'pink').length;
      return { met: taken === 9 };
    }
    case 'relay': {
      const number = tricks.length;
      const right = number <= 4 ? latest.winner === target : last ? latest.winner === second : !state.chosen.includes(latest.winner);
      if (!right) {
        return {
          failure: `${names[target]} must win only tricks 1 to 4, ${names[second]} only the last trick, and the others every trick between`,
          met: false
        };
      }
      return { met: last };
    }
    default:
      return { met: true };
  }
}

// One attempt is over. Mission 50 done ends the game with the whole crew as winners.
function endMission(state: GameState, success: boolean, reason: string): GameState {
  const summary: MissionSummary = {
    mission: state.mission, attempt: state.attempt, success, reason, distress: state.distressUsed, acknowledged: []
  };
  const ended: GameState = {
    ...state, phase: 'missionOver', currentPlayer: null, roundSummary: summary, endVotes: {},
    lastCompleted: success ? state.mission : state.lastCompleted
  };
  if (!success) return { ...ended, gameStatus: `Mission ${state.mission} failed: ${reason}` };
  if (state.mission === LAST_MISSION) {
    return { ...ended, isGameOver: true, winners: [...state.activePlayers], gameStatus: `Mission ${LAST_MISSION} complete! The crew has finished the logbook` };
  }
  return { ...ended, gameStatus: `Mission ${state.mission} complete!${state.distressUsed ? ' The distress signal counts one more attempt' : ''}` };
}

// Right after the first trick of mission 12, everyone at once draws a random card from the player on their right
function drawFromRight(state: GameState, random: Random): GameState {
  const drawn = Object.fromEntries(state.activePlayers.map(seat => {
    const from = state.hands[rightOf(state, seat)];
    return [seat, from[Math.floor(random() * from.length)]];
  }));
  const hands = Object.fromEntries(state.activePlayers.map(seat => {
    const lost = drawn[leftOf(state, seat)];
    return [seat, [...state.hands[seat].filter(card => !sameCard(card, lost)), drawn[seat]]];
  }));
  return { ...state, hands };
}

function play(state: GameState, seat: Seat, card: Card, random: Random): Result<GameState> {
  const hand = state.hands[seat];
  if (!hand.some(held => sameCard(held, card))) return { error: 'You do not have that card' };
  if (!canPlayCard(hand, card, state.trick)) return { error: `Follow suit: play ${state.trick[0].card.suit}` };
  const trick = [...state.trick, { seat, card }];
  const played: GameState = { ...state, hands: { ...state.hands, [seat]: hand.filter(held => !sameCard(held, card)) }, trick };
  if (trick.length < state.activePlayers.length) {
    return { state: recorded({ ...played, currentPlayer: leftOf(state, seat) }, { type: 'play', playerNumber: seat, card, trickWinner: null, result: null }) };
  }

  const winner = trickWinner(trick, suitOf, c => c.value, 'rocket');
  const tricks = [...state.tricks, { plays: trick, winner }];
  const last = tricks.length === totalTricks(state.activePlayers.length);
  const mission = missionOf(state.mission);
  const taken: GameState = { ...played, trick: [], lastTrick: { plays: trick, winner }, tricks, currentPlayer: winner };
  const lastMove = (result: 'success' | 'failure' | null): LastMove => ({ type: 'play', playerNumber: seat, card, trickWinner: winner, result });
  const fail = (reason: string) => ({ state: { ...endMission(taken, false, reason), lastMove: lastMove('failure') } });

  const fresh = state.tasks.flatMap((t, i) => (!t.done && trick.some(p => sameCard(p.card, t.card)) ? [i] : []));
  const stolen = fresh.find(i => state.tasks[i].owner !== winner);
  if (stolen !== undefined) {
    const t = state.tasks[stolen];
    return fail(`${state.playerNames[winner]} won ${cardName(t.card)}, which was ${state.playerNames[t.owner ?? winner]}'s task`);
  }
  if (!inOrder(state.tasks, fresh, last, mission.rule?.kind === 'omegaInLastTrick')) {
    return fail('The tasks were not done in the order their tokens give');
  }
  const tasks = state.tasks.map((t, i) => (fresh.includes(i) ? { ...t, done: true } : t));
  const rule = checkRule(state, mission, tricks, last);
  if (rule.failure) return fail(rule.failure);
  const next: GameState = { ...taken, tasks };
  if (rule.met && tasks.every(t => t.done)) return { state: { ...endMission(next, true, ''), lastMove: lastMove('success') } };
  if (last) return fail('The tricks ran out before the mission was done');
  const drawn = mission.rule?.kind === 'drawFromRight' && tricks.length === 1 ? drawFromRight(next, random) : next;
  return { state: recorded(drawn, lastMove(null)) };
}

const PHASE_ERRORS: Record<GameState['phase'], string> = {
  tokens: 'The commander may move an order token first',
  decision: 'Wait for the commander\'s decision',
  distribute: 'Wait for the commander to hand out the tasks',
  choose: 'Take the tasks first',
  distress: 'Wait for everyone to pass a card',
  play: 'The tasks are already shared out',
  missionOver: 'The mission is over'
};

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const parsed = parseMove(move);
  if (!parsed) return { error: 'Invalid move' };
  switch (parsed.type) {
    case 'moveToken':
    case 'keepTokens':
      if (state.phase !== 'tokens') return { error: 'Order tokens are moved only before the tasks are taken, where the mission allows it' };
      return parsed.type === 'keepTokens'
        ? { state: recorded({ ...state, phase: setupPhase(state) }, { type: 'keepTokens', playerNumber: seat }) }
        : moveToken(state, seat, parsed.from, parsed.to);
    case 'choosePlayer':
      if (state.phase !== 'decision') return { error: 'The mission has no commander\'s decision now' };
      return choosePlayer(state, seat, parsed.seat);
    case 'assignTask':
      if (state.phase !== 'distribute') return { error: 'The commander hands out tasks only in a commander\'s distribution' };
      return assignTask(state, seat, parsed.seat);
    case 'takeTask':
      if (state.phase !== 'choose') return { error: PHASE_ERRORS[state.phase] };
      return takeTask(state, seat, parsed.task);
    case 'distress':
      if (state.phase !== 'play') return { error: PHASE_ERRORS[state.phase] };
      return distress(state, seat, parsed.direction);
    case 'handOverTask':
      if (state.phase !== 'play') return { error: 'Hand over a task before the first trick' };
      return handOverTask(state, seat, parsed.task, parsed.to);
    case 'play':
      if (state.phase !== 'play') return { error: PHASE_ERRORS[state.phase] };
      return play(state, seat, parsed.card, random);
  }
}

function communicate(state: GameState, seat: Seat, action: Record<string, unknown>): Result<GameState> {
  const mission = missionOf(state.mission);
  const card = parseCard(action.card);
  const token = COMM_TOKENS.find(t => t === action.token);
  if (!card || (action.token !== undefined && !token) || (!token && !mission.deadSpot)) return { error: 'Invalid communication' };
  if (state.phase !== 'play') return { error: 'Communicate after the tasks are shared out, while the mission is on' };
  if (state.trick.length > 0) return { error: 'Communicate between tricks, not during one' };
  if (state.communications[seat]) return { error: 'You have already communicated in this mission' };
  if (mission.rule?.kind === 'mute' && state.chosen[0] === seat) return { error: 'You may not communicate in this mission' };
  const upcoming = state.tricks.length + 1;
  if (mission.commsFrom && upcoming < mission.commsFrom) return { error: `Communication is disrupted until trick ${mission.commsFrom}` };
  if (isRocket(card)) return { error: 'Rockets are never communicated' };
  const hand = state.hands[seat] ?? [];
  if (!hand.some(held => sameCard(held, card))) return { error: 'You do not have that card' };
  const truths = trueTokens(hand, card);
  if (token && !mission.deadSpot && !truths.includes(token)) {
    return { error: `That is not true: ${cardName(card)} is not your ${token} ${card.suit}` };
  }
  if (truths.length === 0) return { error: `${cardName(card)} is not your highest, lowest or only ${card.suit}` };
  const said: Communication = { card, token: mission.deadSpot ? null : token ?? null, beforeTrick: upcoming };
  const words = said.token ? `: their ${said.token} ${card.suit}` : '';
  return {
    state: {
      ...state,
      communications: { ...state.communications, [seat]: said },
      gameStatus: `${state.playerNames[seat]} communicated ${cardName(card)}${words}`
    }
  };
}

function passCard(state: GameState, seat: Seat, value: unknown): Result<GameState> {
  const distressing = state.distress;
  if (state.phase !== 'distress' || !distressing) return { error: 'Pass a card only after a distress signal' };
  const card = parseCard(value);
  if (!card) return { error: 'Invalid card' };
  if (distressing.passes[seat]) return { error: 'You have already passed a card' };
  if (isRocket(card)) return { error: 'Rockets are never passed' };
  if (!state.hands[seat]?.some(held => sameCard(held, card))) return { error: 'You do not have that card' };
  const passes = { ...distressing.passes, [seat]: card };
  const waiting: GameState = { ...state, distress: { ...distressing, passes }, gameStatus: `${state.playerNames[seat]} chose a card to pass` };
  if (!state.activePlayers.every(s => passes[s])) return { state: waiting };
  const from = (seat: Seat) => (distressing.direction === 'left' ? rightOf(state, seat) : leftOf(state, seat));
  const hands = Object.fromEntries(state.activePlayers.map(s =>
    [s, [...state.hands[s].filter(held => !sameCard(held, passes[s])), passes[from(s)]]]));
  return {
    state: {
      ...state, hands, phase: 'play', distress: null, passedThisAttempt: true,
      gameStatus: `Everyone passed a card to the ${distressing.direction}`
    }
  };
}

// Deals the next attempt once every connected player has acknowledged the mission's end: the next mission after a
// success, the same one again after a failure
function startNextIfReady(state: GameState, random: Random): GameState {
  const summary = state.roundSummary;
  if (!summary || state.isGameOver) return state;
  if (!connectedPlayers(state).every(seat => summary.acknowledged.includes(seat))) return state;
  const next: GameState = summary.success
    ? { ...state, mission: state.mission + 1, attempt: 1, distressUsed: false }
    : { ...state, attempt: state.attempt + 1 };
  return { ...dealMission(next, random), gameStatus: `Mission ${next.mission}, attempt ${next.attempt}` };
}

// The crew may stop between missions: the game ends once every connected player has voted yes
function endIfVoted(state: GameState): GameState {
  if (state.phase !== 'missionOver' || state.isGameOver) return state;
  if (!connectedPlayers(state).every(seat => state.endVotes[seat] === true)) return state;
  const done = state.lastCompleted === null
    ? 'The crew ended the game before completing a mission'
    : `The crew ended the game. Last mission completed: ${state.lastCompleted}`;
  return { ...state, isGameOver: true, winners: [...state.activePlayers], gameStatus: done };
}

function chooseMission(state: GameState, seat: Seat, mission: unknown, random: Random): Result<GameState> {
  if (state.started) return { error: 'The mission is chosen before the first move' };
  if (!state.activePlayers.includes(seat)) return { error: 'Only a seated player can choose the mission' };
  if (!isInteger(mission) || mission < 1 || mission > LAST_MISSION) return { error: `Choose a mission from 1 to ${LAST_MISSION}` };
  const next = resetLobby({ ...state, startMission: mission }, random);
  return { state: { ...next, gameStatus: `${state.playerNames[seat]} chose mission ${mission}` } };
}

export function applyAction(state: GameState, seat: Seat, action: unknown, random: Random): Result<GameState> {
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.undoVote) return { error: 'An undo vote is in progress' };
  if (state.dismissVote) return { error: 'A dismiss vote is in progress' };
  const input = asRecord(action);
  switch (input?.type) {
    case 'chooseMission':
      return chooseMission(state, seat, input.mission, random);
    case 'communicate':
      return communicate(state, seat, input);
    case 'passCard':
      return passCard(state, seat, input.card);
    case 'acknowledgeRound': {
      const summary = state.roundSummary;
      if (!summary) return { error: 'Nothing to continue' };
      if (summary.acknowledged.includes(seat)) return { state };
      const next: GameState = {
        ...state,
        roundSummary: { ...summary, acknowledged: [...summary.acknowledged, seat] },
        gameStatus: `${state.playerNames[seat]} is ready for the next mission`
      };
      return { state: startNextIfReady(next, random) };
    }
    case 'voteEnd': {
      if (typeof input.yes !== 'boolean') return { error: 'Invalid vote' };
      if (state.phase !== 'missionOver') return { error: 'Vote to end only between missions' };
      const next: GameState = {
        ...state,
        endVotes: { ...state.endVotes, [seat]: input.yes },
        gameStatus: `${state.playerNames[seat]} voted ${input.yes ? 'to end the game' : 'to play on'}`
      };
      return { state: endIfVoted(next) };
    }
    default:
      return { error: 'Unknown action' };
  }
}

// The deal depends on the crew size, so a player leaving ends the game the same way as an end vote
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const done = state.lastCompleted === null ? 'No mission was completed' : `Last mission completed: ${state.lastCompleted}`;
  return {
    ...state,
    isGameOver: true,
    currentPlayer: null,
    winners: [...state.activePlayers],
    undoVote: null,
    gameStatus: `${state.playerNames[seat]} left, so the crew cannot go on. ${done}`
  };
}

// The next attempt or the end vote may have been waiting only for the player who disconnected
export function onPlayerDisconnected(state: GameState, _seat: Seat, random: Random): GameState {
  return endIfVoted(startNextIfReady(state, random));
}
