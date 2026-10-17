import type { GameDefinition } from '../shared/gameDefinition.ts';
import { quoridor } from './quoridor/index.ts';
import { azul } from './azul/index.ts';

// Landing page order. Games differ in their state types, so the list holds them type-erased.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES: GameDefinition<any, any>[] = [quoridor, azul];
