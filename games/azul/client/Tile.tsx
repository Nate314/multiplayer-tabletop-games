import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import usePreloadSvgs from '../../../src/assets/usePreloadSvgs.ts';
import { svgUrl } from '../../../src/assets/svgCache.ts';
import usePreferences from '../../../src/hooks/usePreferences.ts';
import type { FloorItem } from '../types.ts';

const tileUrl = (kind: FloorItem, plain: boolean) => svgUrl('azul-tile', kind, plain ? 'plain' : 'mark');
const KINDS: FloorItem[] = ['blue', 'yellow', 'red', 'black', 'cyan', 'first'];
const AZUL_PIECES = KINDS.flatMap(kind => [tileUrl(kind, false), tileUrl(kind, true)]);

type TileProps = {
  kind: FloorItem;
  faded?: boolean;
  selected?: boolean;
  animKey?: string; // the slot the tile fills, for move animations
};

// A tile drawn by the server (games/azul/svg.ts) with its color's own mark; with Color-blind symbols on, the shared
// shape takes the mark's place
export default function Tile({ kind, faded = false, selected = false, animKey }: TileProps) {
  usePreloadSvgs(AZUL_PIECES);
  const { colorSymbols } = usePreferences();
  const symbol = colorSymbols && kind !== 'first';
  const classes = ['tile', `tile-${kind}`];
  if (faded) classes.push('tile-faded');
  if (selected) classes.push('tile-selected');
  return (
    <span className={classes.join(' ')} title={kind === 'first' ? 'first player marker' : kind} data-anim-key={animKey}>
      <ServerSvg url={tileUrl(kind, symbol)} className="piece-art" />
      {symbol && <ColorSymbol color={kind} />}
    </span>
  );
}
