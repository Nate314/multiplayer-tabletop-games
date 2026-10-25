import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { tileUrl } from './pieces.ts';
import type { TileType } from '../types.ts';

// A tile drawn by the server (games/carcassonne/svg.ts), 100 units square at the origin, turned about its center
export default function TileArt({ type, rotation }: { type: TileType; rotation: number }) {
  return <ServerSvg url={tileUrl(type, rotation)} inSvg svgProps={{ width: 100, height: 100 }} />;
}
