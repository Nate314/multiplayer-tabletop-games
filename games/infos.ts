import type { GameInfo } from '../shared/gameDefinition.ts';
import { azulInfo } from './azul/info.ts';
import { backgammonInfo } from './backgammon/info.ts';
import { carcassonneInfo } from './carcassonne/info.ts';
import { catanInfo } from './catan/info.ts';
import { checkersInfo } from './checkers/info.ts';
import { chessInfo } from './chess/info.ts';
import { connectfourInfo } from './connectfour/info.ts';
import { dominoesInfo } from './dominoes/info.ts';
import { euchreInfo } from './euchre/info.ts';
import { farkleInfo } from './farkle/info.ts';
import { goInfo } from './go/info.ts';
import { gofishInfo } from './gofish/info.ts';
import { heartsInfo } from './hearts/info.ts';
import { holdemInfo } from './holdem/info.ts';
import { jengaInfo } from './jenga/info.ts';
import { mancalaInfo } from './mancala/info.ts';
import { monopolyInfo } from './monopoly/info.ts';
import { parchisiInfo } from './parchisi/info.ts';
import { phase10Info } from './phase10/info.ts';
import { pictionaryInfo } from './pictionary/info.ts';
import { quoridorInfo } from './quoridor/info.ts';
import { rackoInfo } from './racko/info.ts';
import { riskInfo } from './risk/info.ts';
import { rookInfo } from './rook/info.ts';
import { rummikubInfo } from './rummikub/info.ts';
import { scrabbleInfo } from './scrabble/info.ts';
import { skipboInfo } from './skipbo/info.ts';
import { spadesInfo } from './spades/info.ts';
import { splendorInfo } from './splendor/info.ts';
import { thecrewInfo } from './thecrew/info.ts';
import { tickettorideInfo } from './tickettoride/info.ts';
import { unoInfo } from './uno/info.ts';
import { warInfo } from './war/info.ts';
import { yahtzeeInfo } from './yahtzee/info.ts';

// What the browser lists, in the order of GAMES in registry.ts, without any game's rules code
export const GAME_INFOS: GameInfo[] = [
  azulInfo, backgammonInfo, carcassonneInfo, catanInfo, checkersInfo, chessInfo, connectfourInfo, dominoesInfo, euchreInfo, farkleInfo,
  goInfo, gofishInfo, heartsInfo, jengaInfo, mancalaInfo, monopolyInfo, parchisiInfo, phase10Info, pictionaryInfo, quoridorInfo, rackoInfo, riskInfo, rookInfo, rummikubInfo,
  scrabbleInfo, skipboInfo, spadesInfo, splendorInfo, holdemInfo, thecrewInfo, tickettorideInfo, unoInfo, warInfo, yahtzeeInfo
];
