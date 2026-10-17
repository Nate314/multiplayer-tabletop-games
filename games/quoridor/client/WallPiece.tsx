import type { Wall } from '../types.ts';

const SQUARE_SIZE = 52; // 50px square plus its 1px borders

type WallPieceProps = {
  wall: Wall;
  className: string;
  animKey?: string; // placed walls only, so a preview is never animated
};

export default function WallPiece({ wall, className, animKey }: WallPieceProps) {
  return (
    <div
      className={`${className} ${wall.orientation}`}
      data-anim-key={animKey}
      style={{
        top: `${(wall.row * SQUARE_SIZE) + 2}px`,
        left: `${(wall.col * SQUARE_SIZE) + 2}px`
      }}
    />
  );
}
