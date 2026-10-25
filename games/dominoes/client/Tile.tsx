import { pipsName } from '../rules.ts';
import type { DragSourceProps } from '../../../src/drag/useDrag.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { svgUrl } from '../../../src/assets/svgCache.ts';

type TileProps = {
  pips: [number, number]; // left and right, as laid
  animKey?: string; // for move animations
  highlighted?: boolean; // the tile the last move played, in the history dialog
  // Given only for a tile in your hand; without it the tile is not a button
  onClick?: () => void;
  playable?: boolean;
  selected?: boolean;
  dragProps?: DragSourceProps;
};

export default function Tile({ pips, animKey, highlighted = false, onClick, playable = false, selected = false, dragProps }: TileProps) {
  const classes = ['tile'];
  if (pips[0] === pips[1]) classes.push('tile-double');
  if (highlighted) classes.push('tile-highlighted');
  if (selected) classes.push('tile-selected');
  // The pips are the server drawing (games/dominoes/svg.ts); the face and edge stay on this element
  const face = <ServerSvg url={svgUrl('domino', pips[0], pips[1])} className="piece-art" />;

  if (!onClick) {
    return <span className={classes.join(' ')} title={pipsName(pips)} data-anim-key={animKey}>{face}</span>;
  }
  classes.push(playable ? 'tile-playable' : 'tile-unplayable');
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-label={pipsName(pips)}
      title={pipsName(pips)}
      data-anim-key={animKey}
      disabled={!playable}
      onClick={onClick}
      {...dragProps}
    >
      {face}
    </button>
  );
}
