import type { GameDefinition } from '../shared/gameDefinition.ts';
import { quoridor } from './quoridor/index.ts';
import { azul } from './azul/index.ts';
import { chess } from './chess/index.ts';
import { checkers } from './checkers/index.ts';
import { backgammon } from './backgammon/index.ts';
import { mancala } from './mancala/index.ts';
import { parchisi } from './parchisi/index.ts';
import { scrabble } from './scrabble/index.ts';
import { uno } from './uno/index.ts';
import { phase10 } from './phase10/index.ts';

// Landing page order. Games differ in their state types, so the list holds them type-erased.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES: GameDefinition<any, any>[] = [
  quoridor, azul, chess, checkers, backgammon, mancala, parchisi, scrabble, uno, phase10
];
