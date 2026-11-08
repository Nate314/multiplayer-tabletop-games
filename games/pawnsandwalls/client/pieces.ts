import { svgUrl } from '../../../src/assets/svgCache.ts';
import { DISC_URL } from '../../../src/components/pieces.ts';

// The server drawings the board uses (games/pawnsandwalls/svg.ts and the shared disc), fetched when it opens
export const WALL_URL = svgUrl('pawnsandwalls-wall');
export const PAWNSANDWALLS_PIECES = [DISC_URL, WALL_URL];
