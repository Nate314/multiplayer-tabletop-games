// The 50 missions. The mechanics follow the published game's 50 missions: task counts and special rules from its
// mission book, order tokens from two independent mission tables, which agree on every mission (see the README).
// The titles and stories are this project's own: the courier ship Longhaul on one fifty-stop delivery route.
import type { Mission, OrderToken, Rule } from './types.ts';

const ARROWS_2: OrderToken[] = ['>', '>>'];
const ARROWS_3: OrderToken[] = ['>', '>>', '>>>'];

const SICK: Rule = { kind: 'sick' };
const NO_NINES: Rule = { kind: 'noNines' };
const TAKES_ALL: Rule = { kind: 'takesAll' };
const DISTRIBUTION: Rule = { kind: 'distribution' };

type Extra = Omit<Mission, 'number' | 'title' | 'story' | 'tasks' | 'tokens'>;

function m(number: number, title: string, story: string, tasks: number, tokens: OrderToken[] = [], extra: Extra = {}): Mission {
  return { number, title, story, tasks, tokens, ...extra };
}

export const MISSIONS: Mission[] = [
  m(1, 'Leaving the Dock', 'The courier ship Longhaul clears the dock with one parcel in the hold. Whoever signs for it has to see it delivered.', 1),
  m(2, 'Two Drops on the Inner Ring', 'Two parcels this time, both for stations on the inner ring. Split the paperwork and get each one where it belongs.', 2),
  m(3, 'Priority Mail', 'Two parcels are stamped first and second. The first must reach its door before the second, or the client sends both back.', 2, [1, 2]),
  m(4, 'A Fuller Hold', 'Three parcels ride along to the ore belt. The route only gets harder from here, so learn each other\'s habits now.', 3),
  m(5, 'Sick Bay', 'The commander sends one of you to sick bay. The others cover the shift, and the patient must not win a single trick.', 0, [], { rule: SICK }),
  m(6, 'Static on the Line', 'Three parcels, two of them marked with arrows for their order. A solar storm scrambles the radio, so a signal never says whether a card is high, low or the only one.', 3, ARROWS_2, { deadSpot: true }),
  m(7, 'Last Crate Out', 'Three parcels, and the one marked omega has to be the final delivery of the run. Save it for last.', 3, ['omega']),
  m(8, 'Strict Timetable', 'Three parcels carry numbered slots, one, two and three. The dock master checks the order on arrival.', 3, [1, 2, 3]),
  m(9, 'Low Fuel', 'The tanks are nearly dry and only the smallest burn will do. One trick has to be won by a 1.', 0, [], { rule: { kind: 'oneWins', count: 1 } }),
  m(10, 'Four Doors', 'Four parcels for four airlocks along the long station. Plan the route before the first knock.', 4),
  m(11, 'Broken Headset', 'Four parcels, one marked first. The commander names another member whose headset has failed, and that member sends no signal this run.', 4, [1], { rule: { kind: 'mute' } }),
  m(12, 'Changing Watch', 'Four parcels, the omega one last. After the first trick the watch rotates, and everyone draws a random card from the player on their right.', 4, ['omega'], { rule: { kind: 'drawFromRight' } }),
  m(13, 'Engine Test', 'No parcels, only a shakedown of the drives. Each of the four rockets has to win a trick before the test is over.', 0, [], { rule: { kind: 'rocketsWin', ordered: false } }),
  m(14, 'Storm Front', 'Four parcels, three of them in arrow order, and the storm is back. Signals reach the bridge without their tokens.', 4, ARROWS_3, { deadSpot: true }),
  m(15, 'Rush Hour', 'Four parcels numbered one to four, each due before the next. Traffic at the junction leaves no room for slips.', 4, [1, 2, 3, 4]),
  m(16, 'Overheating', 'The nines run hot and the cooling is down. No trick may be won by a 9.', 0, [], { rule: NO_NINES }),
  m(17, 'Still Running Hot', 'Two parcels aboard and the coolant still leaks. Deliver them both without a 9 ever taking a trick.', 2, [], { rule: NO_NINES }),
  m(18, 'Blackout', 'Five parcels, and the comms array reboots at launch. Nobody can signal until the first trick is done.', 5, [], { commsFrom: 2 }),
  m(19, 'Long Reboot', 'Five parcels, one marked first. The array needs two full tricks to warm up before anyone can signal.', 5, [1], { commsFrom: 3 }),
  m(20, 'Sealed Orders', 'Two parcels come aboard in sealed crates. The commander hands them, unseen, to one other member, who must deliver every one.', 2, [], { rule: TAKES_ALL }),
  m(21, 'Ion Haze', 'Five parcels, the first two numbered. Ion haze strips the token off every signal.', 5, [1, 2], { deadSpot: true }),
  m(22, 'Chain of Custody', 'Five parcels, four of them in arrow order. Each arrow must be handed over before the next one in line.', 5, ['>', '>>', '>>>', '>>>>']),
  m(23, 'Clerical Error', 'Five parcels numbered one to five, but the labels may be wrong. Before anyone signs, two number tokens may trade places.', 5, [1, 2, 3, 4, 5], { rule: { kind: 'swapTokens' } }),
  m(24, 'Quartermaster', 'Six parcels, and the commander assigns them one at a time, sharing them out evenly.', 6, [], { rule: DISTRIBUTION }),
  m(25, 'Asteroid Field', 'Six parcels with two arrows, and the rocks block every radio token. Steer carefully.', 6, ARROWS_2, { deadSpot: true }),
  m(26, 'Feather Touch', 'The docking clamps need the gentlest pressure. Two tricks must be won by a 1.', 0, [], { rule: { kind: 'oneWins', count: 2 } }),
  m(27, 'Locked Manifest', 'Three parcels sit in a locked crate. The commander picks another member to carry them all without seeing what they are.', 3, [], { rule: TAKES_ALL }),
  m(28, 'Delayed Relay', 'Six parcels, one marked first and one omega for last. No signals until two tricks have passed.', 6, [1, 'omega'], { commsFrom: 3 }),
  m(29, 'Even Shifts', 'No parcels, just a long watch shared fairly. Nobody may ever be two tricks ahead of anyone else, and signals arrive without tokens.', 0, [], { deadSpot: true, rule: { kind: 'balanced', commanderFirstLast: false } }),
  m(30, 'Late Signal', 'Six parcels, three of them in arrow order. The radio stays dark until the first trick is done.', 6, ARROWS_3, { commsFrom: 2 }),
  m(31, 'Tight Schedule', 'Six parcels, the first three numbered. Hold to the order and the station opens its doors.', 6, [1, 2, 3]),
  m(32, 'Inventory Day', 'Seven parcels, handed out one at a time by the commander, evenly across the ship.', 7, [], { rule: DISTRIBUTION }),
  m(33, 'One Day Off', 'The commander picks one member who must win exactly one trick, and not with a rocket. Everyone else carries the rest.', 0, [], { rule: { kind: 'exactlyOneTrick' } }),
  m(34, 'Commander\'s Watch', 'No parcels, only a fair rota. Nobody may be two tricks ahead of another, and the commander must win the first and the last tricks.', 0, [], { rule: { kind: 'balanced', commanderFirstLast: true } }),
  m(35, 'Convoy', 'Seven parcels, three in arrow order. Other couriers fall in behind, watching how it is done.', 7, ARROWS_3),
  m(36, 'Assigned Priorities', 'Seven parcels, two of them numbered. The commander hands them out one at a time and evenly.', 7, [1, 2], { rule: DISTRIBUTION }),
  m(37, 'Blind Cargo', 'Four crates arrive face down. The commander chooses another member to take them all, sight unseen.', 4, [], { rule: TAKES_ALL }),
  m(38, 'Dark Side Approach', 'Eight parcels and the far side of the moon. Radio contact returns only after two tricks.', 8, [], { commsFrom: 3 }),
  m(39, 'Deep Static', 'Eight parcels, three in arrow order, and the nebula eats every radio token.', 8, ARROWS_3, { deadSpot: true }),
  m(40, 'Relabeling', 'Eight parcels, three numbered. Before anyone signs, one number token may move to a parcel without one.', 8, [1, 2, 3], { rule: { kind: 'moveToken' } }),
  m(41, 'Bookends', 'The commander names one member who must win the first and the last tricks and no others, neither with a rocket. Everything between belongs to the others.', 0, [], { rule: { kind: 'firstAndLastOnly' } }),
  m(42, 'Full Manifest', 'Nine parcels fill the hold to the hatch. Every member will be signing for something.', 9),
  m(43, 'Fair Shares', 'Nine parcels, and the commander hands them out one at a time, evenly.', 9, [], { rule: DISTRIBUTION }),
  m(44, 'Ignition Sequence', 'The engines fire one after another. The rockets must win tricks in order: the 1, then the 2, then the 3, then the 4.', 0, [], { rule: { kind: 'rocketsWin', ordered: true } }),
  m(45, 'Narrow Window', 'Nine parcels, three of them in arrow order. The station opens its bay for a short window only.', 9, ARROWS_3),
  m(46, 'Pink Consignment', 'Every pink card is consigned to one receiver: the member to the left of whoever holds the pink 9. That member must win them all.', 0, [], { rule: { kind: 'allPink' } }),
  m(47, 'Heavy Load', 'Ten parcels weigh the Longhaul down. Every delivery counts.', 10),
  m(48, 'Final Seal', 'Three parcels, and the one marked omega must be won in the very last trick of the run.', 3, ['omega'], { rule: { kind: 'omegaInLastTrick' } }),
  m(49, 'Approach Corridor', 'Ten parcels, three in arrow order, on the crowded final approach.', 10, ARROWS_3),
  m(50, 'Home Port', 'The last stop is home. The commander chooses two members: the first must win tricks 1 to 4 and no others, the second only the last trick, and the rest every trick between.', 0, [], { rule: { kind: 'relay' } })
];

export const LAST_MISSION = MISSIONS.length;

export function missionOf(number: number): Mission {
  return MISSIONS[number - 1];
}

// With five players, from mission 25 on, a mission with tasks lets one crew member hand a task to another
export function allowsHandOver(mission: Mission, players: number): boolean {
  return players === 5 && mission.number >= 25 && mission.tasks > 0;
}
