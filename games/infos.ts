import type { GameInfo } from '../shared/gameDefinition.ts';
import { backgammonInfo } from './backgammon/info.ts';
import { blocktowerInfo } from './blocktower/info.ts';
import { categoriesInfo } from './categories/info.ts';
import { charadesInfo } from './charades/info.ts';
import { checkersInfo } from './checkers/info.ts';
import { chessInfo } from './chess/info.ts';
import { chinesecheckersInfo } from './chinesecheckers/info.ts';
import { codebreakerInfo } from './codebreaker/info.ts';
import { cornersInfo } from './corners/info.ts';
import { dominoesInfo } from './dominoes/info.ts';
import { drawandguessInfo } from './drawandguess/info.ts';
import { euchreInfo } from './euchre/info.ts';
import { farkleInfo } from './farkle/info.ts';
import { fictionaryInfo } from './fictionary/info.ts';
import { fivediceInfo } from './fivedice/info.ts';
import { fourinarowInfo } from './fourinarow/info.ts';
import { goInfo } from './go/info.ts';
import { gofishInfo } from './gofish/info.ts';
import { heartsInfo } from './hearts/info.ts';
import { hexislandInfo } from './hexisland/info.ts';
import { hintgridInfo } from './hintgrid/info.ts';
import { inorderInfo } from './inorder/info.ts';
import { jewelguildInfo } from './jewelguild/info.ts';
import { jigsawInfo } from './jigsaw/info.ts';
import { lettergridInfo } from './lettergrid/info.ts';
import { mancalaInfo } from './mancala/info.ts';
import { missiontricksInfo } from './missiontricks/info.ts';
import { navalInfo } from './naval/info.ts';
import { nestInfo } from './nest/info.ts';
import { pachisiInfo } from './pachisi/info.ts';
import { palacewallsInfo } from './palacewalls/info.ts';
import { pawnsandwallsInfo } from './pawnsandwalls/info.ts';
import { railroutesInfo } from './railroutes/info.ts';
import { rainboweightsInfo } from './rainboweights/info.ts';
import { roadtoretirementInfo } from './roadtoretirement/info.ts';
import { roadsandfieldsInfo } from './roadsandfields/info.ts';
import { rummytilesInfo } from './rummytiles/info.ts';
import { snakesladdersInfo } from './snakesladders/info.ts';
import { spadesInfo } from './spades/info.ts';
import { spiteandmaliceInfo } from './spiteandmalice/info.ts';
import { stagerummyInfo } from './stagerummy/info.ts';
import { steadyhandInfo } from './steadyhand/info.ts';
import { streetdeedsInfo } from './streetdeeds/info.ts';
import { sudokuInfo } from './sudoku/info.ts';
import { territoriesInfo } from './territories/info.ts';
import { holdemInfo } from './holdem/info.ts';
import { tictactoeInfo } from './tictactoe/info.ts';
import { tradingfloorInfo } from './tradingfloor/info.ts';
import { ultimatetictactoeInfo } from './ultimatetictactoe/info.ts';
import { warInfo } from './war/info.ts';
import { whodunitInfo } from './whodunit/info.ts';

// What the browser lists, in the order of GAMES in registry.ts, without any game's rules code
export const GAME_INFOS: GameInfo[] = [
  palacewallsInfo, backgammonInfo, roadsandfieldsInfo, hexislandInfo, charadesInfo, checkersInfo, chinesecheckersInfo, chessInfo, categoriesInfo, codebreakerInfo, fourinarowInfo, cornersInfo, dominoesInfo, euchreInfo, farkleInfo, fictionaryInfo,
  goInfo, gofishInfo, heartsInfo, hintgridInfo, blocktowerInfo, jigsawInfo, mancalaInfo, missiontricksInfo, streetdeedsInfo, navalInfo, pachisiInfo, stagerummyInfo, drawandguessInfo, pawnsandwallsInfo, inorderInfo, roadtoretirementInfo, nestInfo, rummytilesInfo,
  lettergridInfo, spiteandmaliceInfo, snakesladdersInfo, spadesInfo, jewelguildInfo, steadyhandInfo, sudokuInfo, territoriesInfo, holdemInfo, tictactoeInfo, railroutesInfo, tradingfloorInfo, ultimatetictactoeInfo, rainboweightsInfo, warInfo, whodunitInfo, fivediceInfo
];
