import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { tileName, tileOf } from '../rules.ts';
import { tileKey } from './animateMove.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { cardArtUrl } from '../../../src/components/pieces.ts';

type TileProps = {
  id: number;
  standsFor?: string; // for a joker on the table, e.g. 'red 5'
  highlighted?: boolean;
  drawn?: boolean; // outlined as a tile you just drew
};

// One tile face: a colored number, or a joker. data-anim-key follows the tile wherever it is drawn.
export default function Tile({ id, standsFor, highlighted, drawn }: TileProps) {
  const tile = tileOf(id);
  const classes = ['rk-tile', tile.kind === 'joker' ? 'rk-joker' : `rk-${tile.color}`, highlighted ? 'rk-tile-highlighted' : '', drawn ? 'newly-drawn' : ''];
  const title = tile.kind === 'joker' && standsFor ? `Joker as ${standsFor}` : tileName(id);
  return (
    <span className={classes.filter(Boolean).join(' ')} data-anim-key={tileKey(id)} title={title}>
      <ServerSvg url={cardArtUrl('solid')} className="piece-art" />
      {tile.kind === 'joker' ? <span aria-hidden="true">☺</span> : (
        <>
          <ColorSymbol color={tile.color} className="rk-symbol" />
          {tile.value}
        </>
      )}
    </span>
  );
}
