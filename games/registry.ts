import type { GameDefinition } from '../shared/gameDefinition.ts';
import { quoridor } from './quoridor/index.ts';
import { rummikub } from './rummikub/index.ts';
import { azul } from './azul/index.ts';
import { carcassonne } from './carcassonne/index.ts';
import { chess } from './chess/index.ts';
import { checkers } from './checkers/index.ts';
import { chinesecheckers } from './chinesecheckers/index.ts';
import { codebreaker } from './codebreaker/index.ts';
import { connectfour } from './connectfour/index.ts';
import { corners } from './corners/index.ts';
import { euchre } from './euchre/index.ts';
import { backgammon } from './backgammon/index.ts';
import { catan } from './catan/index.ts';
import { charades } from './charades/index.ts';
import { mancala } from './mancala/index.ts';
import { monopoly } from './monopoly/index.ts';
import { naval } from './naval/index.ts';
import { parchisi } from './parchisi/index.ts';
import { scrabble } from './scrabble/index.ts';
import { uno } from './uno/index.ts';
import { stagerummy } from './stagerummy/index.ts';
import { categories } from './categories/index.ts';
import { drawandguess } from './drawandguess/index.ts';
import { skipbo } from './skipbo/index.ts';
import { go } from './go/index.ts';
import { snakesladders } from './snakesladders/index.ts';
import { gofish } from './gofish/index.ts';
import { hearts } from './hearts/index.ts';
import { hintgrid } from './hintgrid/index.ts';
import { jenga } from './jenga/index.ts';
import { jigsaw } from './jigsaw/index.ts';
import { war } from './war/index.ts';
import { risk } from './risk/index.ts';
import { inorder } from './inorder/index.ts';
import { roadtoretirement } from './roadtoretirement/index.ts';
import { nest } from './nest/index.ts';
import { spades } from './spades/index.ts';
import { splendor } from './splendor/index.ts';
import { steadyhand } from './steadyhand/index.ts';
import { sudoku } from './sudoku/index.ts';
import { farkle } from './farkle/index.ts';
import { fictionary } from './fictionary/index.ts';
import { holdem } from './holdem/index.ts';
import { tickettoride } from './tickettoride/index.ts';
import { tradingfloor } from './tradingfloor/index.ts';
import { dominoes } from './dominoes/index.ts';
import { whodunit } from './whodunit/index.ts';
import { yahtzee } from './yahtzee/index.ts';
import { thecrew } from './thecrew/index.ts';
import { tictactoe } from './tictactoe/index.ts';
import { ultimatetictactoe } from './ultimatetictactoe/index.ts';

// Registry order, alphabetical by name; the landing page groups them by category. Games differ in their state types, so the list holds them type-erased.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES: GameDefinition<any, any>[] = [
  azul, backgammon, carcassonne, catan, charades, checkers, chinesecheckers, chess, categories, codebreaker, connectfour, corners, dominoes, euchre, farkle, fictionary, go, gofish, hearts, hintgrid, jenga, jigsaw, mancala, monopoly, naval, parchisi, stagerummy, drawandguess,
  quoridor, inorder, roadtoretirement, risk, nest, rummikub, scrabble, skipbo, snakesladders, spades, splendor, steadyhand, sudoku, holdem, thecrew, tictactoe, tickettoride, tradingfloor, ultimatetictactoe, uno, war, whodunit, yahtzee
];
