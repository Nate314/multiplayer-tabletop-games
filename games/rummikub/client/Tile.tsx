import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { tileName, tileOf } from '../rules.ts';
import { tileKey } from './animateMove.ts';

type TileProps = {
  id: number;
  standsFor?: string; // for a joker on the table, e.g. 'red 5'
  highlighted?: boolean;
};

// One tile face: a colored number, or a joker. data-anim-key follows the tile wherever it is drawn.
export default function Tile({ id, standsFor, highlighted }: TileProps) {
  const tile = tileOf(id);
  const classes = ['rk-tile', tile.kind === 'joker' ? 'rk-joker' : `rk-${tile.color}`, highlighted ? 'rk-tile-highlighted' : ''];
  const title = tile.kind === 'joker' && standsFor ? `Joker as ${standsFor}` : tileName(id);
  return (
    <span className={classes.filter(Boolean).join(' ')} data-anim-key={tileKey(id)} title={title}>
      {tile.kind === 'joker' ? <span aria-hidden="true">☺</span> : (
        <>
          <ColorSymbol color={tile.color} className="rk-symbol" />
          {tile.value}
        </>
      )}
    </span>
  );
}
