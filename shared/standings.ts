import type { GameDefinition } from './gameDefinition.ts';
import { plural } from './text.ts';
import type { BaseGameState, Seat, Standing } from './types.ts';

export function rankStandings(
  state: Pick<BaseGameState, 'activePlayers' | 'winners'>,
  compare: (a: Seat, b: Seat) => number,
  score?: (seat: Seat) => string | undefined,
): Standing[] {
  const rows: Standing[] = [];
  const add = (seat: Seat, place: number) => {
    const text = score?.(seat);
    rows.push(text === undefined ? { seat, place } : { seat, place, score: text });
  };
  state.winners.forEach((seat) => add(seat, 1));
  const rest = state.activePlayers.filter((seat) => !state.winners.includes(seat)).sort((a, b) => compare(a, b) || a - b);
  let place = state.winners.length ? 1 : 0;
  rest.forEach((seat, i) => {
    if (i === 0 || compare(rest[i - 1], seat) !== 0) place++;
    add(seat, place);
  });
  return rows.sort((a, b) => a.place - b.place || a.seat - b.seat);
}

export function standingsOf(definition: Pick<GameDefinition, 'finalStandings'>, state: BaseGameState): Standing[] {
  try {
    if (definition.finalStandings) return definition.finalStandings(state);
  } catch (error) {
    console.error('finalStandings failed, using the fallback', error);
  }
  return rankStandings(state, () => 0);
}

export const pointsText = (points: number): string =>
  plural(points, 'point').replace(/^-?[\d.]+/, points.toLocaleString('en-US'));
