import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import usePreferences from '../../../src/hooks/usePreferences.ts';
import type { FloorItem } from '../types.ts';

// Each color has its own mark, so colors are not told apart by hue alone; with Color-blind symbols on, the shared shape takes its place
const MARKS: Record<FloorItem, string> = {
  blue: '◆',
  yellow: '●',
  red: '▲',
  black: '■',
  cyan: '✚',
  first: '1'
};

type TileProps = {
  kind: FloorItem;
  faded?: boolean;
  selected?: boolean;
  animKey?: string; // the slot the tile fills, for move animations
};

export default function Tile({ kind, faded = false, selected = false, animKey }: TileProps) {
  const { colorSymbols } = usePreferences();
  const classes = ['tile', `tile-${kind}`];
  if (faded) classes.push('tile-faded');
  if (selected) classes.push('tile-selected');
  return (
    <span className={classes.join(' ')} title={kind === 'first' ? 'first player marker' : kind} data-anim-key={animKey}>
      {colorSymbols && kind !== 'first' ? <ColorSymbol color={kind} /> : MARKS[kind]}
    </span>
  );
}
