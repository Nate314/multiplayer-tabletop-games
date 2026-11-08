import type { GameInfo } from '../shared/gameDefinition.ts';
import { azulInfo } from './azul/info.ts';
import { backgammonInfo } from './backgammon/info.ts';
import { carcassonneInfo } from './carcassonne/info.ts';
import { catanInfo } from './catan/info.ts';
import { charadesInfo } from './charades/info.ts';
import { checkersInfo } from './checkers/info.ts';
import { chinesecheckersInfo } from './chinesecheckers/info.ts';
import { chessInfo } from './chess/info.ts';
import { codebreakerInfo } from './codebreaker/info.ts';
import { connectfourInfo } from './connectfour/info.ts';
import { cornersInfo } from './corners/info.ts';
import { dominoesInfo } from './dominoes/info.ts';
import { euchreInfo } from './euchre/info.ts';
import { farkleInfo } from './farkle/info.ts';
import { fictionaryInfo } from './fictionary/info.ts';
import { goInfo } from './go/info.ts';
import { gofishInfo } from './gofish/info.ts';
import { heartsInfo } from './hearts/info.ts';
import { hintgridInfo } from './hintgrid/info.ts';
import { holdemInfo } from './holdem/info.ts';
import { jengaInfo } from './jenga/info.ts';
import { jigsawInfo } from './jigsaw/info.ts';
import { mancalaInfo } from './mancala/info.ts';
import { streetdeedsInfo } from './streetdeeds/info.ts';
import { navalInfo } from './naval/info.ts';
import { parchisiInfo } from './parchisi/info.ts';
import { phase10Info } from './phase10/info.ts';
import { categoriesInfo } from './categories/info.ts';
import { pictionaryInfo } from './pictionary/info.ts';
import { quoridorInfo } from './quoridor/info.ts';
import { rackoInfo } from './racko/info.ts';
import { roadtoretirementInfo } from './roadtoretirement/info.ts';
import { riskInfo } from './risk/info.ts';
import { rookInfo } from './rook/info.ts';
import { rummikubInfo } from './rummikub/info.ts';
import { scrabbleInfo } from './scrabble/info.ts';
import { skipboInfo } from './skipbo/info.ts';
import { snakesladdersInfo } from './snakesladders/info.ts';
import { spadesInfo } from './spades/info.ts';
import { splendorInfo } from './splendor/info.ts';
import { steadyhandInfo } from './steadyhand/info.ts';
import { sudokuInfo } from './sudoku/info.ts';
import { thecrewInfo } from './thecrew/info.ts';
import { tictactoeInfo } from './tictactoe/info.ts';
import { railroutesInfo } from './railroutes/info.ts';
import { tradingfloorInfo } from './tradingfloor/info.ts';
import { ultimatetictactoeInfo } from './ultimatetictactoe/info.ts';
import { unoInfo } from './uno/info.ts';
import { warInfo } from './war/info.ts';
import { whodunitInfo } from './whodunit/info.ts';
import { yahtzeeInfo } from './yahtzee/info.ts';

// What the browser lists, in the order of GAMES in registry.ts, without any game's rules code
export const GAME_INFOS: GameInfo[] = [
  azulInfo, backgammonInfo, carcassonneInfo, catanInfo, charadesInfo, checkersInfo, chinesecheckersInfo, chessInfo, categoriesInfo, codebreakerInfo, connectfourInfo, cornersInfo, dominoesInfo, euchreInfo, farkleInfo, fictionaryInfo,
  goInfo, gofishInfo, heartsInfo, hintgridInfo, jengaInfo, jigsawInfo, mancalaInfo, navalInfo, parchisiInfo, phase10Info, pictionaryInfo, quoridorInfo, rackoInfo, railroutesInfo, roadtoretirementInfo, riskInfo, rookInfo, rummikubInfo,
  scrabbleInfo, skipboInfo, snakesladdersInfo, spadesInfo, splendorInfo, steadyhandInfo, streetdeedsInfo, sudokuInfo, holdemInfo, thecrewInfo, tictactoeInfo, tradingfloorInfo, ultimatetictactoeInfo, unoInfo, warInfo, whodunitInfo, yahtzeeInfo
];
