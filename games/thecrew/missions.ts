// The 50 missions of the logbook of The Crew: The Quest for Planet Nine, mechanics only (see the README for the sources).
// Task counts and special rules are from the official logbook; order tokens from two independent mission tables,
// which agree on every mission.
import type { Mission, OrderToken, Rule } from './types.ts';

const ARROWS_2: OrderToken[] = ['>', '>>'];
const ARROWS_3: OrderToken[] = ['>', '>>', '>>>'];

const SICK: Rule = { kind: 'sick' };
const NO_NINES: Rule = { kind: 'noNines' };
const TAKES_ALL: Rule = { kind: 'takesAll' };
const DISTRIBUTION: Rule = { kind: 'distribution' };

function m(number: number, tasks: number, tokens: OrderToken[] = [], extra: Omit<Mission, 'number' | 'tasks' | 'tokens'> = {}): Mission {
  return { number, tasks, tokens, ...extra };
}

export const MISSIONS: Mission[] = [
  m(1, 1),
  m(2, 2),
  m(3, 2, [1, 2]),
  m(4, 3),
  m(5, 0, [], { rule: SICK }),
  m(6, 3, ARROWS_2, { deadSpot: true }),
  m(7, 3, ['omega']),
  m(8, 3, [1, 2, 3]),
  m(9, 0, [], { rule: { kind: 'oneWins', count: 1 } }),
  m(10, 4),
  m(11, 4, [1], { rule: { kind: 'mute' } }),
  m(12, 4, ['omega'], { rule: { kind: 'drawFromRight' } }),
  m(13, 0, [], { rule: { kind: 'rocketsWin', ordered: false } }),
  m(14, 4, ARROWS_3, { deadSpot: true }),
  m(15, 4, [1, 2, 3, 4]),
  m(16, 0, [], { rule: NO_NINES }),
  m(17, 2, [], { rule: NO_NINES }),
  m(18, 5, [], { commsFrom: 2 }),
  m(19, 5, [1], { commsFrom: 3 }),
  m(20, 2, [], { rule: TAKES_ALL }),
  m(21, 5, [1, 2], { deadSpot: true }),
  m(22, 5, ['>', '>>', '>>>', '>>>>']),
  m(23, 5, [1, 2, 3, 4, 5], { rule: { kind: 'swapTokens' } }),
  m(24, 6, [], { rule: DISTRIBUTION }),
  m(25, 6, ARROWS_2, { deadSpot: true }),
  m(26, 0, [], { rule: { kind: 'oneWins', count: 2 } }),
  m(27, 3, [], { rule: TAKES_ALL }),
  m(28, 6, [1, 'omega'], { commsFrom: 3 }),
  m(29, 0, [], { deadSpot: true, rule: { kind: 'balanced', commanderFirstLast: false } }),
  m(30, 6, ARROWS_3, { commsFrom: 2 }),
  m(31, 6, [1, 2, 3]),
  m(32, 7, [], { rule: DISTRIBUTION }),
  m(33, 0, [], { rule: { kind: 'exactlyOneTrick' } }),
  m(34, 0, [], { rule: { kind: 'balanced', commanderFirstLast: true } }),
  m(35, 7, ARROWS_3),
  m(36, 7, [1, 2], { rule: DISTRIBUTION }),
  m(37, 4, [], { rule: TAKES_ALL }),
  m(38, 8, [], { commsFrom: 3 }),
  m(39, 8, ARROWS_3, { deadSpot: true }),
  m(40, 8, [1, 2, 3], { rule: { kind: 'moveToken' } }),
  m(41, 0, [], { rule: { kind: 'firstAndLastOnly' } }),
  m(42, 9),
  m(43, 9, [], { rule: DISTRIBUTION }),
  m(44, 0, [], { rule: { kind: 'rocketsWin', ordered: true } }),
  m(45, 9, ARROWS_3),
  m(46, 0, [], { rule: { kind: 'allPink' } }),
  m(47, 10),
  m(48, 3, ['omega'], { rule: { kind: 'omegaInLastTrick' } }),
  m(49, 10, ARROWS_3),
  m(50, 0, [], { rule: { kind: 'relay' } })
];

export const LAST_MISSION = MISSIONS.length;

export function missionOf(number: number): Mission {
  return MISSIONS[number - 1];
}

// With five players, from mission 25 on, a mission with tasks lets one crew member hand a task to another
export function allowsHandOver(mission: Mission, players: number): boolean {
  return players === 5 && mission.number >= 25 && mission.tasks > 0;
}
