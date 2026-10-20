import type { CSSProperties } from 'react';
import type { Card } from '../types.ts';

type TileProps = {
  card?: Card; // omitted for a face-down tile
  small?: boolean;
  selected?: boolean;
  label?: string;
  // Makes the tile a button
  onClick?: () => void;
  disabled?: boolean;
};

// A Rack-O card: its number on a color that runs through the rainbow, so a rack in order reads as a gradient
export default function Tile({ card, small = false, selected = false, label, onClick, disabled = false }: TileProps) {
  const classes = ['tile'];
  if (card === undefined) classes.push('tile-back');
  if (small) classes.push('tile-small');
  if (selected) classes.push('tile-selected');
  const style = card === undefined ? undefined : ({ '--hue': Math.round(((card - 1) / 60) * 300) } as CSSProperties);
  const name = label ?? (card === undefined ? 'Face-down card' : `Card ${card}`);
  if (!onClick && !disabled) return <span className={classes.join(' ')} style={style} aria-label={name} title={name}>{card}</span>;
  return (
    <button type="button" className={classes.join(' ')} style={style} aria-label={name} disabled={disabled} onClick={onClick}>
      {card}
    </button>
  );
}
