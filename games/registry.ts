import type { GameDefinition } from '../shared/gameDefinition.ts';
import { quoridor } from './quoridor/index.ts';
import { rummikub } from './rummikub/index.ts';
import { azul } from './azul/index.ts';
import { carcassonne } from './carcassonne/index.ts';
import { chess } from './chess/index.ts';
import { checkers } from './checkers/index.ts';
import { connectfour } from './connectfour/index.ts';
import { euchre } from './euchre/index.ts';
import { backgammon } from './backgammon/index.ts';
import { catan } from './catan/index.ts';
import { mancala } from './mancala/index.ts';
import { monopoly } from './monopoly/index.ts';
import { parchisi } from './parchisi/index.ts';
import { scrabble } from './scrabble/index.ts';
import { uno } from './uno/index.ts';
import { phase10 } from './phase10/index.ts';
import { skipbo } from './skipbo/index.ts';
import { gofish } from './gofish/index.ts';
import { hearts } from './hearts/index.ts';
import { war } from './war/index.ts';
import { risk } from './risk/index.ts';
import { racko } from './racko/index.ts';
import { rook } from './rook/index.ts';
import { splendor } from './splendor/index.ts';
import { farkle } from './farkle/index.ts';
import { tickettoride } from './tickettoride/index.ts';
import { dominoes } from './dominoes/index.ts';

// Landing page order, alphabetical by name. Games differ in their state types, so the list holds them type-erased.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES: GameDefinition<any, any>[] = [
  azul, backgammon, carcassonne, catan, checkers, chess, connectfour, gofish, mancala, monopoly, parchisi, phase10, quoridor, risk, rook, rummikub, scrabble, skipbo, splendor, tickettoride, uno, war
  azul, backgammon, carcassonne, catan, checkers, chess, dominoes, gofish, mancala, monopoly, parchisi, phase10, quoridor, risk, rook, rummikub, scrabble, skipbo, splendor, tickettoride, uno, war
  azul, backgammon, carcassonne, catan, checkers, chess, euchre, gofish, mancala, monopoly, parchisi, phase10, quoridor, risk, rook, rummikub, scrabble, skipbo, splendor, tickettoride, uno, war
  azul, backgammon, carcassonne, catan, checkers, chess, farkle, gofish, mancala, monopoly, parchisi, phase10, quoridor, risk, rook, rummikub, scrabble, skipbo, splendor, tickettoride, uno, war
  azul, backgammon, carcassonne, catan, checkers, chess, gofish, hearts, mancala, monopoly, parchisi, phase10, quoridor, risk, rook, rummikub, scrabble, skipbo, splendor, tickettoride, uno, war
  azul, backgammon, carcassonne, catan, checkers, chess, gofish, mancala, monopoly, parchisi, phase10, quoridor, racko, risk, rook, rummikub, scrabble, skipbo, splendor, tickettoride, uno, war
];
