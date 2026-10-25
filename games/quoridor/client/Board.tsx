import { useState } from 'react';
import Pawn from './Pawn';
import WallPiece from './WallPiece';
import { squareKey, wallKey } from './animateMove.ts';
import { squareId, squareMove, squareOf, wallSlots } from './walls.ts';
import { BOARD_SIZE, getValidMoves } from '../rules.ts';
import type { Drag } from '../../../src/drag/useDrag.ts';
import type { Move, PlacedWall, Position, PublicGameState, Seat, Wall } from '../types.ts';
import type { Action } from './types.ts';

const INDEXES = Array.from({ length: BOARD_SIZE }, (_, index) => index);

type BoardProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  isMyTurn: boolean;
  selectedAction: Action;
  showLastMove?: boolean;
  onMove: (move: Move) => void;
  drag?: Drag; // the live board only: own pawn is a drag source ('pawn') and every square a target ("<row>-<col>")
};

function isSamePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export default function Board({ gameState, playerNumber, isMyTurn, selectedAction, showLastMove = false, onMove, drag }: BoardProps) {
  const [hoveredSquare, setHoveredSquare] = useState<Position | null>(null);
  const { pawns, walls, playerNames, lastMove, isGameOver } = gameState;
  const seats = Object.keys(pawns).map(Number); // a dismissed player's pawn is off the board
  const validMoves = isMyTurn ? getValidMoves(gameState, playerNumber) : [];
  const placingWall = isMyTurn && selectedAction !== 'move';
  const slots = new Set(isMyTurn ? wallSlots(gameState, playerNumber, selectedAction) : []);
  // While a wall is dragged the preview follows the legal square under the pointer (a finger has no hover)
  const previewSquare = drag?.dragging === 'wall' ? (drag.over ? squareOf(drag.over) : null) : hoveredSquare;
  const wallPreview: Wall | null = placingWall && previewSquare && slots.has(squareId(previewSquare))
    ? { ...previewSquare, orientation: selectedAction === 'wall-h' ? 'horizontal' : 'vertical' }
    : null;

  function isValidMove(position: Position): boolean {
    return validMoves.some(move => isSamePosition(move, position));
  }

  function handleSquareClick(position: Position) {
    if (!isMyTurn) return;
    const move = squareMove(gameState, playerNumber, selectedAction, position);
    if (move) onMove(move);
  }

  function pawnAt(position: Position): Seat | undefined {
    return seats.find(seat => isSamePosition(pawns[seat], position));
  }

  function getSquareClassName(position: Position): string {
    const classNames = ['square'];
    if (isValidMove(position)) classNames.push('valid-move');
    if (slots.has(squareId(position))) classNames.push('wall-slot');
    if (showLastMove && lastMove?.type === 'move') {
      if (isSamePosition(lastMove.from, position)) classNames.push('last-move-from');
      if (isSamePosition(lastMove.to, position)) classNames.push('last-move-to');
    }
    return classNames.join(' ');
  }

  function isLastMoveWall(wall: PlacedWall): boolean {
    return showLastMove && lastMove?.type === 'wall' &&
      isSamePosition(lastMove, wall) && lastMove.orientation === wall.orientation;
  }

  return (
    <div className={`board-frame ${seats.map(seat => `goal-edge${seat}`).join(' ')}`}>
      <div className={`board ${isMyTurn ? '' : 'not-your-turn'} ${isGameOver ? 'game-over' : ''}`}>
        {INDEXES.map(row => (
          <div key={row} className="board-row">
            {INDEXES.map(col => {
              const position = { row, col };
              const seat = pawnAt(position);
              return (
                <div
                  key={col}
                  className={getSquareClassName(position)}
                  data-anim-key={squareKey(position)}
                  data-drop={drag && squareId(position)}
                  onClick={() => handleSquareClick(position)}
                  onMouseEnter={() => setHoveredSquare(position)}
                  onMouseLeave={() => setHoveredSquare(null)}
                >
                  {seat && <Pawn seat={seat} name={playerNames[seat]} dragProps={seat === playerNumber ? drag?.source('pawn') : undefined} />}
                </div>
              );
            })}
          </div>
        ))}
        <div className="wall-overlay">
          {walls.map((wall, index) => (
            <WallPiece key={index} wall={wall} className={isLastMoveWall(wall) ? 'wall last-move' : 'wall'} animKey={wallKey(wall)} />
          ))}
        </div>
        {wallPreview && <WallPiece wall={wallPreview} className="wall-preview" />}
      </div>
    </div>
  );
}
