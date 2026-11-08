import type { SvgAsset } from '../../shared/svg/svg.ts';
import { SYMBOL_ASSETS } from '../../shared/svg/symbols.ts';
import { ICON_ASSETS } from '../../shared/svg/icons.ts';
import { GAME_ICON_ASSETS } from '../../shared/svg/gameIcons.ts';
import { DICE_ASSETS } from '../../shared/svg/dice.ts';
import { QR_ASSETS } from '../../shared/svg/qr.ts';
import { PLAYING_CARD_ASSETS } from '../../shared/svg/playingCards.ts';
import { DISC_ASSETS } from '../../shared/svg/disc.ts';
import { CARD_ART_ASSETS } from '../../shared/svg/cardArt.ts';
import { ROADSANDFIELDS_ASSETS } from '../../games/roadsandfields/svg.ts';
import { TERRITORIES_ASSETS } from '../../games/territories/svg.ts';
import { RAILROUTES_ASSETS } from '../../games/railroutes/svg.ts';
import { PAWNSANDWALLS_ASSETS } from '../../games/pawnsandwalls/svg.ts';
import { PALACEWALLS_ASSETS } from '../../games/palacewalls/svg.ts';
import { CHESS_ASSETS } from '../../games/chess/svg.ts';
import { CHECKERS_ASSETS } from '../../games/checkers/svg.ts';
import { RAINBOWEIGHTS_ASSETS } from '../../games/rainboweights/svg.ts';
import { DOMINOES_ASSETS } from '../../games/dominoes/svg.ts';
import { HEXISLAND_ASSETS } from '../../games/hexisland/svg.ts';
import { STREETDEEDS_ASSETS } from '../../games/streetdeeds/svg.ts';
import { JIGSAW_ASSETS } from '../../games/jigsaw/svg.ts';
import { WHODUNIT_ASSETS } from '../../games/whodunit/svg.ts';

export type { SvgAsset };

// Every SVG the server draws: the routes and the /dev/svgs gallery both read this list. A generator file exports its
// assets next to the data it draws from, and is listed here once
export const SVG_ASSETS: SvgAsset[] = [
  ...SYMBOL_ASSETS,
  ...ICON_ASSETS,
  ...GAME_ICON_ASSETS,
  ...DICE_ASSETS,
  ...QR_ASSETS,
  ...PLAYING_CARD_ASSETS,
  ...DISC_ASSETS,
  ...CARD_ART_ASSETS,
  ...ROADSANDFIELDS_ASSETS,
  ...TERRITORIES_ASSETS,
  ...RAILROUTES_ASSETS,
  ...PAWNSANDWALLS_ASSETS,
  ...PALACEWALLS_ASSETS,
  ...CHESS_ASSETS,
  ...CHECKERS_ASSETS,
  ...RAINBOWEIGHTS_ASSETS,
  ...DOMINOES_ASSETS,
  ...HEXISLAND_ASSETS,
  ...STREETDEEDS_ASSETS,
  ...JIGSAW_ASSETS,
  ...WHODUNIT_ASSETS,
];

export function findSvg(name: string, assets: SvgAsset[] = SVG_ASSETS): SvgAsset | undefined {
  return assets.find(asset => asset.name === name);
}
