import { svgUrl } from '../../../src/assets/svgCache.ts';
import { TILES } from '../tiles.ts';
import type { Seat, TileType } from '../types.ts';

// The server drawings of games/carcassonne/svg.ts
export const tileUrl = (type: TileType, rotation: number) => svgUrl('carcassonne-tile', type, ((rotation % 4) + 4) % 4);
export const meepleUrl = (seat: Seat, lying = false) => svgUrl('carcassonne-meeple', seat, lying ? 'lying' : 'standing');

// Every tile in every turn, and each seat's meeple, fetched when the board opens
export const CARCASSONNE_PIECES = [
  ...(Object.keys(TILES) as TileType[]).flatMap(type => [0, 1, 2, 3].map(rotation => tileUrl(type, rotation))),
  ...([1, 2, 3, 4, 5] as Seat[]).flatMap(seat => [meepleUrl(seat), meepleUrl(seat, true)]),
];
