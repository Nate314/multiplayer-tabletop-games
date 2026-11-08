// Team and key logic, pure
import type { Random } from '../../shared/types.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { CardKind, Role, Seat, Team } from './types.ts';

export const TEAM_NAMES: Record<Team, string> = { red: 'Red', blue: 'Blue' };
const TEAMS: Team[] = ['red', 'blue'];

export const otherTeam = (team: Team): Team => (team === 'red' ? 'blue' : 'red');

export function dealKey(random: Random): { startingTeam: Team; key: CardKind[] } {
  const startingTeam: Team = random() < 0.5 ? 'red' : 'blue';
  const cards: CardKind[] = [
    ...Array<CardKind>(9).fill(startingTeam),
    ...Array<CardKind>(8).fill(otherTeam(startingTeam)),
    ...Array<CardKind>(7).fill('bystander'),
    'trap'
  ];
  return { startingTeam, key: shuffle(cards, random) };
}

type Roles = Partial<Record<Seat, Role>>;

export const clueGiverOf = (roles: Roles, team: Team): Seat | null => {
  const seat = Object.keys(roles)
    .map(Number)
    .find((s) => roles[s]?.team === team && roles[s].clueGiver);
  return seat ?? null;
};

export const guessersOf = (roles: Roles, team: Team, seats: Seat[]): Seat[] =>
  seats.filter((s) => roles[s]?.team === team && !roles[s].clueGiver).sort((a, b) => a - b);

export function teamsReady(roles: Roles, seats: Seat[]): boolean {
  if (!seats.every((s) => roles[s])) return false;
  return TEAMS.every((team) => {
    const clueGivers = seats.filter((s) => roles[s]?.team === team && roles[s].clueGiver);
    return clueGivers.length === 1 && guessersOf(roles, team, seats).length >= 1;
  });
}

export function evenOut(roles: Roles, seats: Seat[]): Roles {
  const sorted = [...seats].sort((a, b) => a - b);
  const result: Roles = {};
  for (const team of TEAMS) {
    const keeper = sorted.find((s) => roles[s]?.team === team && roles[s].clueGiver);
    if (keeper !== undefined) result[keeper] = { team, clueGiver: true };
  }
  const size = (team: Team) => Object.values(result).filter((r) => r?.team === team).length;
  for (const seat of sorted) {
    if (result[seat]) continue;
    result[seat] = { team: size('red') <= size('blue') ? 'red' : 'blue', clueGiver: false };
  }
  for (const team of TEAMS) {
    if (clueGiverOf(result, team) !== null) continue;
    const lowest = sorted.find((s) => result[s]?.team === team);
    if (lowest !== undefined) result[lowest] = { team, clueGiver: true };
  }
  return result;
}
