import type { SvgAsset } from '../../shared/svg/svg.ts';
import { SYMBOL_ASSETS } from '../../shared/svg/symbols.ts';
import { ICON_ASSETS } from '../../shared/svg/icons.ts';
import { DICE_ASSETS } from '../../shared/svg/dice.ts';
import { PLAYING_CARD_ASSETS } from '../../shared/svg/playingCards.ts';
import { CARCASSONNE_ASSETS } from '../../games/carcassonne/svg.ts';
import { RISK_ASSETS } from '../../games/risk/svg.ts';
import { TICKETTORIDE_ASSETS } from '../../games/tickettoride/svg.ts';

export type { SvgAsset };

// Every SVG the server draws: the routes and the /dev/svgs gallery both read this list. A generator file exports its
// assets next to the data it draws from, and is listed here once
export const SVG_ASSETS: SvgAsset[] = [
  ...SYMBOL_ASSETS,
  ...ICON_ASSETS,
  ...DICE_ASSETS,
  ...PLAYING_CARD_ASSETS,
  ...CARCASSONNE_ASSETS,
  ...RISK_ASSETS,
  ...TICKETTORIDE_ASSETS,
];

export function findSvg(name: string, assets: SvgAsset[] = SVG_ASSETS): SvgAsset | undefined {
  return assets.find(asset => asset.name === name);
}
