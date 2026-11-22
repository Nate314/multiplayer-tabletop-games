import type { DragSourceProps } from '../../../src/drag/useDrag.ts';
import { TILES } from '../tiles.ts';
import { TriangleArt } from './Board';

const ORIGIN = { x: 0, y: 0, up: true };

// A tile as it is held: point up, its numbers clockwise from the top
function TileFace({ tile }: { tile: number }) {
  return (
    <svg className="hand-tile-art" viewBox="-0.55 -0.05 1.1 0.97" aria-hidden="true">
      <TriangleArt cell={ORIGIN} corners={TILES[tile]} />
    </svg>
  );
}

type HandProps = {
  hand: number[];
  label: string;
  waiting?: boolean;
  // Given only for your own hand on the live table; without onTile the tiles are not buttons
  playable?: (tile: number) => boolean;
  selected?: number | null;
  onTile?: (tile: number) => void;
  dragSource?: (tile: number) => DragSourceProps | undefined;
};

export default function Hand({ hand, label, waiting = false, playable, selected = null, onTile, dragSource }: HandProps) {
  return (
    <section className={waiting ? 'hand hand-waiting' : 'hand'} aria-label={label}>
      <header className="hand-header">{label} ({hand.length})</header>
      <div className="hand-tiles">
        {hand.map(tile => {
          const name = TILES[tile].join('-');
          if (!onTile) return <span key={tile} className="hand-tile" title={name}><TileFace tile={tile} /></span>;
          const canPlay = playable?.(tile) ?? false;
          const classes = ['hand-tile', canPlay ? 'hand-tile-playable' : 'hand-tile-unplayable'];
          if (selected === tile) classes.push('hand-tile-selected');
          return (
            <button
              key={tile}
              type="button"
              className={classes.join(' ')}
              aria-label={name}
              aria-pressed={selected === tile}
              title={name}
              disabled={!canPlay}
              onClick={() => onTile(tile)}
              {...(canPlay ? dragSource?.(tile) : undefined)}
            >
              <TileFace tile={tile} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
