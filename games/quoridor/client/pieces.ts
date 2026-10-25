import { svgUrl } from '../../../src/assets/svgCache.ts';
import { DISC_URL } from '../../../src/components/pieces.ts';

// The server drawings the board uses (games/quoridor/svg.ts and the shared disc), fetched when it opens
export const WALL_URL = svgUrl('quoridor-wall');
export const QUORIDOR_PIECES = [DISC_URL, WALL_URL];
