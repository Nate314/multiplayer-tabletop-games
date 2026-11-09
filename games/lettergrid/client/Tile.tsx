import { BLANK, tileValue } from '../rules.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { cardArtUrl } from '../../../src/components/pieces.ts';

type TileProps = {
  letter: string; // a letter, or BLANK for an unplayed blank
  blank?: boolean; // a played blank, shown in another color and worth 0
  className?: string;
  animKey?: string; // its data-anim-key, for the slides
};

// A letter tile with its value in the corner; sized by its container
export default function Tile({ letter, blank = false, className = '', animKey }: TileProps) {
  const value = blank ? 0 : tileValue(letter);
  const classes = ['tile', blank || letter === BLANK ? 'tile-blank' : '', className].filter(Boolean).join(' ');
  return (
    <span className={classes} data-anim-key={animKey}>
      <ServerSvg url={cardArtUrl('solid')} className="piece-art" />
      <span className="tile-letter">{letter === BLANK ? '' : letter}</span>
      {value > 0 && <span className="tile-value">{value}</span>}
    </span>
  );
}
