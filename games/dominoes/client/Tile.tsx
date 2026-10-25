import { pipsName } from '../rules.ts';
import type { DragSourceProps } from '../../../src/drag/useDrag.ts';

// Which of the nine spots in a half-tile hold a pip, for 0 to 9 pips (rows of three, left to right)
const SPOTS: number[][] = [
  [], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8],
  [0, 2, 3, 4, 5, 6, 8], [0, 1, 2, 3, 5, 6, 7, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8]
];

function Half({ pips }: { pips: number }) {
  return (
    <span className="tile-half" aria-hidden="true">
      {Array.from({ length: 9 }, (_, spot) => <span key={spot} className={SPOTS[pips].includes(spot) ? 'pip' : 'pip pip-empty'} />)}
    </span>
  );
}

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
  const face = (
    <>
      <Half pips={pips[0]} />
      <span className="tile-divider" aria-hidden="true" />
      <Half pips={pips[1]} />
    </>
  );

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
