import type { SvgAsset } from '../../shared/svg/svg.ts';
import { SYMBOL_ASSETS } from '../../shared/svg/symbols.ts';
import { ICON_ASSETS } from '../../shared/svg/icons.ts';
import { GAME_ICON_ASSETS } from '../../shared/svg/gameIcons.ts';
import { DICE_ASSETS } from '../../shared/svg/dice.ts';
import { PLAYING_CARD_ASSETS } from '../../shared/svg/playingCards.ts';
import { DISC_ASSETS } from '../../shared/svg/disc.ts';
import { CARD_ART_ASSETS } from '../../shared/svg/cardArt.ts';
import { CARCASSONNE_ASSETS } from '../../games/carcassonne/svg.ts';
import { RISK_ASSETS } from '../../games/risk/svg.ts';
import { TICKETTORIDE_ASSETS } from '../../games/tickettoride/svg.ts';
import { QUORIDOR_ASSETS } from '../../games/quoridor/svg.ts';
import { AZUL_ASSETS } from '../../games/azul/svg.ts';
import { CHESS_ASSETS } from '../../games/chess/svg.ts';
import { CHECKERS_ASSETS } from '../../games/checkers/svg.ts';
import { UNO_ASSETS } from '../../games/uno/svg.ts';
import { DOMINOES_ASSETS } from '../../games/dominoes/svg.ts';
import { CATAN_ASSETS } from '../../games/catan/svg.ts';
import { MONOPOLY_ASSETS } from '../../games/monopoly/svg.ts';

export type { SvgAsset };

// Every SVG the server draws: the routes and the /dev/svgs gallery both read this list. A generator file exports its
// assets next to the data it draws from, and is listed here once
export const SVG_ASSETS: SvgAsset[] = [
  ...SYMBOL_ASSETS,
  ...ICON_ASSETS,
  ...GAME_ICON_ASSETS,
  ...DICE_ASSETS,
  ...PLAYING_CARD_ASSETS,
  ...DISC_ASSETS,
  ...CARD_ART_ASSETS,
  ...CARCASSONNE_ASSETS,
  ...RISK_ASSETS,
  ...TICKETTORIDE_ASSETS,
  ...QUORIDOR_ASSETS,
  ...AZUL_ASSETS,
  ...CHESS_ASSETS,
  ...CHECKERS_ASSETS,
  ...UNO_ASSETS,
  ...DOMINOES_ASSETS,
  ...CATAN_ASSETS,
  ...MONOPOLY_ASSETS,
];

export function findSvg(name: string, assets: SvgAsset[] = SVG_ASSETS): SvgAsset | undefined {
  return assets.find(asset => asset.name === name);
}
