import type { ReactNode } from 'react';
import TileArt from './TileArt';
import { tileName } from '../tiles.ts';
import type { DragSourceProps } from '../../../src/drag/useDrag.ts';
import type { PublicGameState, TileType } from '../types.ts';

type TurnPanelProps = {
  gameState: PublicGameState;
  canMove: boolean;
  rotation: number;
  onRotate: (step: 1 | -1) => void;
  cellChosen: boolean;
  onPlace: () => void;
  meepleChosen: boolean;
  meepleSpots: number; // free spots on the placed tile
  meeplesLeft: number;
  onMeeple: (place: boolean) => void;
  tileDrag?: DragSourceProps; // lifts the tile picture onto a highlighted square
  meepleTray: ReactNode;      // the meeple to drag onto a circle, shown on the meeple step
};

function TilePicture({ tile, rotation, dragProps }: { tile: TileType; rotation: number; dragProps?: DragSourceProps }) {
  return (
    <svg className="cc-current-tile" {...dragProps} viewBox="-4 -4 108 108" role="img" aria-label={`The tile to place: ${tileName(tile)}`}>
      <TileArt type={tile} rotation={rotation} />
    </svg>
  );
}

// The tile being placed, shown to everyone, and the current player's controls for the step they are on
export default function TurnPanel(props: TurnPanelProps) {
  const { gameState, canMove, rotation, onRotate, cellChosen, onPlace, meepleChosen, meepleSpots, meeplesLeft, onMeeple, tileDrag, meepleTray } = props;
  const { currentTile, currentPlayer, placed, playerNames, tilesLeft, discarded, isGameOver } = gameState;
  const mover = currentPlayer === null ? '' : playerNames[currentPlayer];

  let hint: string;
  if (isGameOver) hint = 'The game is over';
  else if (!canMove) hint = placed ? `${mover} is choosing where to put a meeple` : `${mover} is placing this tile`;
  else if (placed && meeplesLeft === 0) hint = 'All your meeples are on the board';
  else if (placed && meepleSpots === 0) hint = 'No free feature on this tile for a meeple';
  else if (placed) hint = 'Click a circle on your tile to put a meeple there, or place none';
  else hint = cellChosen ? 'Turn the tile if you like, then place it' : 'Click a highlighted square to put the tile there';

  return (
    <section className="cc-panel cc-turn" aria-label="Turn">
      <div className="cc-turn-body">
        {currentTile && !placed && <TilePicture tile={currentTile} rotation={canMove ? rotation : 0} dragProps={tileDrag} />}
        <div className="cc-turn-text">
          <div className="cc-hint">{hint}</div>
          <div className="cc-tiles-left">
            Tiles left: {tilesLeft}{discarded.length > 0 && ` (${discarded.length} set aside)`}
          </div>
        </div>
      </div>
      {canMove && !placed && (
        <div className="cc-buttons">
          <button type="button" onClick={() => onRotate(-1)} aria-label="Turn left">⟲ Turn</button>
          <button type="button" onClick={() => onRotate(1)} aria-label="Turn right">Turn ⟳</button>
          <button type="button" className="cc-primary" disabled={!cellChosen} onClick={onPlace}>Place tile</button>
        </div>
      )}
      {canMove && placed && meepleTray}
      {canMove && placed && (
        <div className="cc-buttons">
          <button type="button" className="cc-primary" disabled={!meepleChosen} onClick={() => onMeeple(true)}>Place meeple</button>
          <button type="button" onClick={() => onMeeple(false)}>No meeple</button>
        </div>
      )}
    </section>
  );
}
