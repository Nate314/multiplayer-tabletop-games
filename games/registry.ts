import type { GameDefinition } from '../shared/gameDefinition.ts';
import { pawnsandwalls } from './pawnsandwalls/index.ts';
import { rummikub } from './rummikub/index.ts';
import { palacewalls } from './palacewalls/index.ts';
import { roadsandfields } from './roadsandfields/index.ts';
import { chess } from './chess/index.ts';
import { checkers } from './checkers/index.ts';
import { chinesecheckers } from './chinesecheckers/index.ts';
import { codebreaker } from './codebreaker/index.ts';
import { fourinarow } from './fourinarow/index.ts';
import { corners } from './corners/index.ts';
import { euchre } from './euchre/index.ts';
import { backgammon } from './backgammon/index.ts';
import { hexisland } from './hexisland/index.ts';
import { charades } from './charades/index.ts';
import { mancala } from './mancala/index.ts';
import { monopoly } from './monopoly/index.ts';
import { naval } from './naval/index.ts';
import { pachisi } from './pachisi/index.ts';
import { scrabble } from './scrabble/index.ts';
import { uno } from './uno/index.ts';
import { phase10 } from './phase10/index.ts';
import { categories } from './categories/index.ts';
import { pictionary } from './pictionary/index.ts';
import { skipbo } from './skipbo/index.ts';
import { go } from './go/index.ts';
import { snakesladders } from './snakesladders/index.ts';
import { gofish } from './gofish/index.ts';
import { hearts } from './hearts/index.ts';
import { hintgrid } from './hintgrid/index.ts';
import { blocktower } from './blocktower/index.ts';
import { jigsaw } from './jigsaw/index.ts';
import { war } from './war/index.ts';
import { risk } from './risk/index.ts';
import { racko } from './racko/index.ts';
import { roadtoretirement } from './roadtoretirement/index.ts';
import { rook } from './rook/index.ts';
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
  palacewalls, backgammon, roadsandfields, hexisland, charades, checkers, chinesecheckers, chess, categories, codebreaker, fourinarow, corners, dominoes, euchre, farkle, fictionary, go, gofish, hearts, hintgrid, blocktower, jigsaw, mancala, monopoly, naval, pachisi, phase10, pictionary,
  pawnsandwalls, racko, roadtoretirement, risk, rook, rummikub, scrabble, skipbo, snakesladders, spades, splendor, steadyhand, sudoku, holdem, thecrew, tictactoe, tickettoride, tradingfloor, ultimatetictactoe, uno, war, whodunit, yahtzee
];
