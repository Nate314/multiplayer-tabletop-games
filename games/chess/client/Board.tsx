import { useState } from 'react';
import PieceGlyph from './PieceGlyph';
import PromotionPicker from './PromotionPicker';
import ClaimPrompt from './ClaimPrompt';
import { pieceKey, squareKey } from './animateMove.ts';
import { BOARD_SIZE, claimableAfterMove, colorOf, findKing, isInCheck, isPromotion, isSameSquare, legalMoves, pieceAt } from '../rules.ts';
import type { Color, Move, PromotionType, PublicGameState, Seat, Square } from '../types.ts';

const INDEXES = Array.from({ length: BOARD_SIZE }, (_, index) => index);
const FILES = 'abcdefgh';
const COLORS: Color[] = ['white', 'black'];

// The piece picked up, the promotion square once a pawn is sent to the last rank, and the target of a move that
// would let the mover claim a draw. Kept with the move count it was made at, so a new move clears it without an effect.
type Selection = { from: Square; promotionTo: Square | null; claimTo: Square | null; moveCount: number };

type BoardProps = {
  gameState: PublicGameState;
  playerNumber: Seat; // 0 for nobody: the history board
  isMyTurn: boolean;
  onMove: (move: Move) => void;
};

export default function Board({ gameState, playerNumber, isMyTurn, onMove }: BoardProps) {
  const [stored, setSelection] = useState<Selection | null>(null);
  const { board, lastMove, isGameOver, moveCount } = gameState;
  const selection = isMyTurn && stored?.moveCount === moveCount ? stored : null;
  const destinations = selection ? legalMoves(gameState, selection.from) : [];
  // Black sees the board turned around so their pieces are at the bottom
  const flipped = playerNumber === 2;
  const rows = flipped ? [...INDEXES].reverse() : INDEXES;
  const cols = flipped ? [...INDEXES].reverse() : INDEXES;
  // Only one side can be in check, including at checkmate
  const checked = COLORS.find(color => isInCheck(board, color));
  const checkedKing = checked && findKing(board, checked);
  const lastSquares = lastMove ? [lastMove.from, lastMove.to] : [];

  function handleSquareClick(square: Square) {
    if (!isMyTurn) return;
    if (selection && destinations.some(target => isSameSquare(target, square))) {
      if (isPromotion(board, selection.from, square)) {
        setSelection({ ...selection, promotionTo: square });
        return;
      }
      if (claimableAfterMove(gameState, selection.from, square)) {
        setSelection({ ...selection, claimTo: square });
        return;
      }
      onMove({ type: 'move', from: selection.from, to: square });
      setSelection(null);
      return;
    }
    const isOwnPiece = pieceAt(board, square)?.color === colorOf(playerNumber);
    const reselect = isOwnPiece && !(selection && isSameSquare(selection.from, square));
    setSelection(reselect ? { from: square, promotionTo: null, claimTo: null, moveCount } : null);
  }

  function handlePromotion(promotion: PromotionType) {
    if (!selection?.promotionTo) return;
    onMove({ type: 'move', from: selection.from, to: selection.promotionTo, promotion });
    setSelection(null);
  }

  function handleClaim(claimDraw: boolean) {
    if (!selection?.claimTo) return;
    onMove({ type: 'move', from: selection.from, to: selection.claimTo, claimDraw });
    setSelection(null);
  }

  function squareClassName(square: Square): string {
    const target = destinations.some(destination => isSameSquare(destination, square));
    const classNames = ['square', (square.row + square.col) % 2 === 0 ? 'light' : 'dark'];
    if (lastSquares.some(last => isSameSquare(last, square))) classNames.push('last-move');
    if (selection && isSameSquare(selection.from, square)) classNames.push('selected');
    if (target) classNames.push(pieceAt(board, square) ? 'legal-capture' : 'legal-move');
    if (checkedKing && isSameSquare(checkedKing, square)) classNames.push('in-check');
    return classNames.join(' ');
  }

  return (
    <div className="board-frame">
      <div className={`board ${isMyTurn ? '' : 'not-your-turn'} ${isGameOver ? 'game-over' : ''}`}>
        {rows.map((row, rowIndex) => cols.map((col, colIndex) => {
          const square = { row, col };
          const piece = pieceAt(board, square);
          return (
            <div
              key={`${row}-${col}`}
              className={squareClassName(square)}
              data-anim-key={squareKey(square)}
              onClick={() => handleSquareClick(square)}
            >
              {colIndex === 0 && <span className="coord rank">{BOARD_SIZE - row}</span>}
              {rowIndex === BOARD_SIZE - 1 && <span className="coord file">{FILES[col]}</span>}
              {piece && <PieceGlyph color={piece.color} type={piece.type} animKey={pieceKey(square)} />}
            </div>
          );
        }))}
      </div>
      {selection?.promotionTo && (
        <PromotionPicker color={colorOf(playerNumber)} onPick={handlePromotion} onCancel={() => setSelection(null)} />
      )}
      {selection?.claimTo && (
        <ClaimPrompt
          claim={claimableAfterMove(gameState, selection.from, selection.claimTo) as string}
          onPlay={handleClaim}
          onCancel={() => setSelection(null)}
        />
      )}
    </div>
  );
}
