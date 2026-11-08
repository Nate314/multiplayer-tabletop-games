import type { GameDefinition } from '../shared/gameDefinition.ts';
import { backgammon } from './backgammon/index.ts';
import { blocktower } from './blocktower/index.ts';
import { categories } from './categories/index.ts';
import { charades } from './charades/index.ts';
import { checkers } from './checkers/index.ts';
import { chess } from './chess/index.ts';
import { chinesecheckers } from './chinesecheckers/index.ts';
import { codebreaker } from './codebreaker/index.ts';
import { corners } from './corners/index.ts';
import { dominoes } from './dominoes/index.ts';
import { drawandguess } from './drawandguess/index.ts';
import { euchre } from './euchre/index.ts';
import { farkle } from './farkle/index.ts';
import { fictionary } from './fictionary/index.ts';
import { fivedice } from './fivedice/index.ts';
import { fourinarow } from './fourinarow/index.ts';
import { go } from './go/index.ts';
import { gofish } from './gofish/index.ts';
import { hearts } from './hearts/index.ts';
import { hexisland } from './hexisland/index.ts';
import { hintgrid } from './hintgrid/index.ts';
import { inorder } from './inorder/index.ts';
import { jewelguild } from './jewelguild/index.ts';
import { jigsaw } from './jigsaw/index.ts';
import { lettergrid } from './lettergrid/index.ts';
import { mancala } from './mancala/index.ts';
import { missiontricks } from './missiontricks/index.ts';
import { naval } from './naval/index.ts';
import { nest } from './nest/index.ts';
import { pachisi } from './pachisi/index.ts';
import { palacewalls } from './palacewalls/index.ts';
import { pawnsandwalls } from './pawnsandwalls/index.ts';
import { railroutes } from './railroutes/index.ts';
import { rainboweights } from './rainboweights/index.ts';
import { roadtoretirement } from './roadtoretirement/index.ts';
import { roadsandfields } from './roadsandfields/index.ts';
import { rummytiles } from './rummytiles/index.ts';
import { snakesladders } from './snakesladders/index.ts';
import { spades } from './spades/index.ts';
import { spiteandmalice } from './spiteandmalice/index.ts';
import { stagerummy } from './stagerummy/index.ts';
import { steadyhand } from './steadyhand/index.ts';
import { streetdeeds } from './streetdeeds/index.ts';
import { sudoku } from './sudoku/index.ts';
import { territories } from './territories/index.ts';
import { holdem } from './holdem/index.ts';
import { tictactoe } from './tictactoe/index.ts';
import { tradingfloor } from './tradingfloor/index.ts';
import { ultimatetictactoe } from './ultimatetictactoe/index.ts';
import { war } from './war/index.ts';
import { whodunit } from './whodunit/index.ts';

// Registry order, alphabetical by name; the landing page groups them by category. Games differ in their state types, so the list holds them type-erased.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES: GameDefinition<any, any>[] = [
  palacewalls, backgammon, roadsandfields, hexisland, charades, checkers, chinesecheckers, chess, categories, codebreaker, fourinarow, corners, dominoes, euchre, farkle, fictionary, go, gofish, hearts, hintgrid, blocktower, jigsaw, mancala, missiontricks, streetdeeds, naval, pachisi, stagerummy, drawandguess,
  pawnsandwalls, inorder, roadtoretirement, nest, rummytiles, lettergrid, spiteandmalice, snakesladders, spades, jewelguild, steadyhand, sudoku, territories, holdem, tictactoe, railroutes, tradingfloor, ultimatetictactoe, rainboweights, war, whodunit, fivedice
];
