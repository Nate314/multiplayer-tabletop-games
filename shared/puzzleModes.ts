import { houseRule, type ChoiceRule } from './houseRules.ts';
import type { BaseGameState, Seat } from './types.ts';

export type PuzzleMode = 'solo' | 'together' | 'race';
export type ModeChoice<M extends string> = { value: M; label: string; offered(seats: number): boolean };

const BASE_CHOICES: ModeChoice<PuzzleMode>[] = [
  { value: 'solo', label: 'Solo', offered: seats => seats === 1 },
  { value: 'together', label: 'Together', offered: seats => seats >= 2 },
  { value: 'race', label: 'Race', offered: seats => seats >= 2 }
];

// The Mode rule: Solo at 1 seat, Together and Race at 2+, plus `extra` choices; `standardAt` overrides the standard per seat count
export function modeRule<M extends string = never>(extra: ModeChoice<M>[] = [], standardAt?: (seats: number) => PuzzleMode | M): ChoiceRule<PuzzleMode | M> {
  const choices: ModeChoice<PuzzleMode | M>[] = [...BASE_CHOICES, ...extra];
  return {
    id: 'mode', label: 'Mode', kind: 'choice',
    help: 'Solo with one player. Together shares one board; Race gives everyone the same puzzle.',
    // Static fallback; standardFor decides per seat count
    standard: 'together',
    standardFor: standardAt ?? (seats => seats === 1 ? 'solo' : 'together'),
    choices: choices.map(choice => ({ value: choice.value, label: choice.label, offered: seats => choice.offered(seats) }))
  };
}

export const MODE_RULE: ChoiceRule<PuzzleMode> = modeRule();

export function modeOf<M extends string>(state: Pick<BaseGameState, 'houseRules'>, rule: ChoiceRule<PuzzleMode | M>): PuzzleMode | M {
  return houseRule(state, rule);
}

// Together and race: moves are actions, any seat, any time
export function playsAtOnce(mode: string): boolean {
  return mode === 'together' || mode === 'race';
}

export type RaceBoards<B> = Partial<Record<Seat, B>>;
export type RaceProgress = Partial<Record<Seat, number>>; // 0 to 100, whole numbers

// The boards a viewer may see: during play only their own (none for null); once over, all
export function visibleBoards<B>(boards: RaceBoards<B>, viewer: Seat | null, isGameOver: boolean): RaceBoards<B> {
  if (isGameOver) return boards;
  return viewer !== null && viewer in boards ? { [viewer]: boards[viewer] } : {};
}

export function raceProgress<B>(boards: RaceBoards<B>, percent: (board: B) => number): RaceProgress {
  return Object.fromEntries(Object.entries(boards).map(([seat, board]) => [seat, Math.round(percent(board as B))]));
}

// Counts per seat of placed pieces or entries, for the Together end screen
export type Contributions = Partial<Record<Seat, number>>;
export function addContribution(counts: Contributions, seat: Seat, by = 1): Contributions {
  return { ...counts, [seat]: (counts[seat] ?? 0) + by };
}
