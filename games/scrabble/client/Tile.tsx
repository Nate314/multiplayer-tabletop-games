import { BLANK, tileValue } from '../rules.ts';

type TileProps = {
  letter: string; // a letter, or BLANK for an unplayed blank
  blank?: boolean; // a played blank, shown in another color and worth 0
  className?: string;
};

// A letter tile with its value in the corner; sized by its container
export default function Tile({ letter, blank = false, className = '' }: TileProps) {
  const value = blank ? 0 : tileValue(letter);
  const classes = ['tile', blank || letter === BLANK ? 'tile-blank' : '', className].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      <span className="tile-letter">{letter === BLANK ? '' : letter}</span>
      {value > 0 && <span className="tile-value">{value}</span>}
    </span>
  );
}
