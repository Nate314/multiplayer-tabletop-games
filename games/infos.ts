import type { GameInfo } from '../shared/gameDefinition.ts';
import { palacewallsInfo } from './palacewalls/info.ts';
import { backgammonInfo } from './backgammon/info.ts';
import { roadsandfieldsInfo } from './roadsandfields/info.ts';
import { hexislandInfo } from './hexisland/info.ts';
import { charadesInfo } from './charades/info.ts';
import { checkersInfo } from './checkers/info.ts';
import { chinesecheckersInfo } from './chinesecheckers/info.ts';
import { chessInfo } from './chess/info.ts';
import { codebreakerInfo } from './codebreaker/info.ts';
import { fourinarowInfo } from './fourinarow/info.ts';
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
import { blocktowerInfo } from './blocktower/info.ts';
import { jigsawInfo } from './jigsaw/info.ts';
import { mancalaInfo } from './mancala/info.ts';
import { streetdeedsInfo } from './streetdeeds/info.ts';
import { navalInfo } from './naval/info.ts';
import { pachisiInfo } from './pachisi/info.ts';
import { stagerummyInfo } from './stagerummy/info.ts';
import { categoriesInfo } from './categories/info.ts';
import { drawandguessInfo } from './drawandguess/info.ts';
import { pawnsandwallsInfo } from './pawnsandwalls/info.ts';
import { inorderInfo } from './inorder/info.ts';
import { roadtoretirementInfo } from './roadtoretirement/info.ts';
import { riskInfo } from './risk/info.ts';
import { nestInfo } from './nest/info.ts';
import { rummytilesInfo } from './rummytiles/info.ts';
import { lettergridInfo } from './lettergrid/info.ts';
import { spiteandmaliceInfo } from './spiteandmalice/info.ts';
import { snakesladdersInfo } from './snakesladders/info.ts';
import { spadesInfo } from './spades/info.ts';
import { jewelguildInfo } from './jewelguild/info.ts';
import { steadyhandInfo } from './steadyhand/info.ts';
import { sudokuInfo } from './sudoku/info.ts';
import { thecrewInfo } from './thecrew/info.ts';
import { tictactoeInfo } from './tictactoe/info.ts';
import { railroutesInfo } from './railroutes/info.ts';
import { tradingfloorInfo } from './tradingfloor/info.ts';
import { ultimatetictactoeInfo } from './ultimatetictactoe/info.ts';
import { rainboweightsInfo } from './rainboweights/info.ts';
import { warInfo } from './war/info.ts';
import { whodunitInfo } from './whodunit/info.ts';
import { fivediceInfo } from './fivedice/info.ts';

// What the browser lists, in the order of GAMES in registry.ts, without any game's rules code
export const GAME_INFOS: GameInfo[] = [
  palacewallsInfo, backgammonInfo, roadsandfieldsInfo, hexislandInfo, charadesInfo, checkersInfo, chinesecheckersInfo, chessInfo, categoriesInfo, codebreakerInfo, fourinarowInfo, cornersInfo, dominoesInfo, euchreInfo, farkleInfo, fictionaryInfo,
  goInfo, gofishInfo, heartsInfo, hintgridInfo, blocktowerInfo, jigsawInfo, mancalaInfo, streetdeedsInfo, navalInfo, pachisiInfo, stagerummyInfo, drawandguessInfo, pawnsandwallsInfo, inorderInfo, roadtoretirementInfo, riskInfo, nestInfo, rummytilesInfo,
  lettergridInfo, spiteandmaliceInfo, snakesladdersInfo, spadesInfo, jewelguildInfo, steadyhandInfo, sudokuInfo, holdemInfo, thecrewInfo, tictactoeInfo, railroutesInfo, tradingfloorInfo, ultimatetictactoeInfo, rainboweightsInfo, warInfo, whodunitInfo, fivediceInfo
];
