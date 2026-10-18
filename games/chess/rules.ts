// Chess rules shared by the browser (legal move hints, check) and the server (validation).
import { applyEndingAction, endGame, endingRefusal, lapseDrawOffer } from '../../shared/drawOffer.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import type {
  Board,
  BoardState,
  CastlingRights,
  Color,
  GameState,
  Piece,
  PieceType,
  PromotionType,
  PublicGameState,
  Result,
  Seat,
  Square
} from './types.ts';

export const BOARD_SIZE = 8;

export const PROMOTION_TYPES: PromotionType[] = ['queen', 'rook', 'bishop', 'knight'];

const BACK_RANK: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

const FILES = 'abcdefgh';

// Letters for notation and position keys; a pawn has no letter in notation
const LETTERS: Record<PieceType, string> = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' };

const HOME_ROW: Record<Color, number> = { white: 7, black: 0 };

const FORWARD: Record<Color, number> = { white: -1, black: 1 };

const KING_COL = 4;

type Step = [number, number]; // [row, col]

const ROOK_STEPS: Step[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_STEPS: Step[] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const KING_STEPS: Step[] = [...ROOK_STEPS, ...BISHOP_STEPS];
const KNIGHT_STEPS: Step[] = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

// Pieces that slide any distance along their steps; the king and knight take one step
const SLIDES: Partial<Record<PieceType, Step[]>> = { rook: ROOK_STEPS, bishop: BISHOP_STEPS, queen: KING_STEPS };

// Moves by each side without a capture or pawn move, in half-moves: fifty may be claimed, seventy-five ends the game
const FIFTY_MOVE_PLIES = 100;
const SEVENTY_FIVE_MOVE_PLIES = 150;

// Times the same position has stood: three may be claimed, five ends the game
const CLAIMED_REPETITIONS = 3;
const AUTOMATIC_REPETITIONS = 5;

// Seat 1 plays white and moves first
export function colorOf(seat: Seat): Color {
  return seat === 1 ? 'white' : 'black';
}

export function opponent(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

export function isSameSquare(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col;
}

function isOnBoard({ row, col }: Square): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function pieceAt(board: Board, { row, col }: Square): Piece | null {
  return board[row]?.[col] ?? null;
}

function isPiece(piece: Piece | null, color: Color, type: PieceType): boolean {
  return piece?.color === color && piece.type === type;
}

export function squareName({ row, col }: Square): string {
  return `${FILES[col]}${BOARD_SIZE - row}`;
}

const ALL_SQUARES: Square[] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({
  row: Math.floor(index / BOARD_SIZE),
  col: index % BOARD_SIZE
}));

function squaresOf(board: Board, color: Color): Square[] {
  return ALL_SQUARES.filter(square => pieceAt(board, square)?.color === color);
}

export function initialBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, (_, row) => Array.from({ length: BOARD_SIZE }, (_, col): Piece | null => {
    const color: Color = row < BOARD_SIZE / 2 ? 'black' : 'white';
    if (row === HOME_ROW[color]) return { color, type: BACK_RANK[col] };
    if (row === HOME_ROW[color] + FORWARD[color]) return { color, type: 'pawn' };
    return null;
  }));
}

// Squares the piece on `from` attacks: pawns only diagonally forward, sliders up to and including the first piece
function attackedSquares(board: Board, from: Square): Square[] {
  const piece = pieceAt(board, from);
  if (!piece) return [];
  const offset = ([row, col]: Step): Square => ({ row: from.row + row, col: from.col + col });

  if (piece.type === 'pawn') {
    return [offset([FORWARD[piece.color], -1]), offset([FORWARD[piece.color], 1])].filter(isOnBoard);
  }
  const slides = SLIDES[piece.type];
  if (!slides) {
    return (piece.type === 'knight' ? KNIGHT_STEPS : KING_STEPS).map(offset).filter(isOnBoard);
  }

  const squares: Square[] = [];
  for (const [dRow, dCol] of slides) {
    let square = { row: from.row + dRow, col: from.col + dCol };
    while (isOnBoard(square)) {
      squares.push(square);
      if (pieceAt(board, square)) break;
      square = { row: square.row + dRow, col: square.col + dCol };
    }
  }
  return squares;
}

export function isAttacked(board: Board, square: Square, by: Color): boolean {
  return squaresOf(board, by).some(from => attackedSquares(board, from).some(target => isSameSquare(target, square)));
}

export function findKing(board: Board, color: Color): Square | undefined {
  return ALL_SQUARES.find(square => isPiece(pieceAt(board, square), color, 'king'));
}

export function isInCheck(board: Board, color: Color): boolean {
  const king = findKing(board, color);
  return king !== undefined && isAttacked(board, king, opponent(color));
}

function pawnMoves(state: BoardState, from: Square, color: Color): Square[] {
  const { board, enPassant } = state;
  const moves: Square[] = [];
  const one = { row: from.row + FORWARD[color], col: from.col };
  if (isOnBoard(one) && !pieceAt(board, one)) {
    moves.push(one);
    const two = { row: one.row + FORWARD[color], col: from.col };
    const onStartRow = from.row === HOME_ROW[color] + FORWARD[color];
    if (onStartRow && !pieceAt(board, two)) moves.push(two);
  }
  for (const target of attackedSquares(board, from)) {
    const isEnPassant = enPassant !== null && isSameSquare(target, enPassant) &&
      isPiece(pieceAt(board, { row: from.row, col: target.col }), opponent(color), 'pawn');
    if (pieceAt(board, target)?.color === opponent(color) || isEnPassant) moves.push(target);
  }
  return moves;
}

// The king steps two squares toward a rook with rights left, over empty squares, never out of, through or into check
function castlingMoves(state: BoardState, color: Color): Square[] {
  const { board, castling } = state;
  const row = HOME_ROW[color];
  const enemy = opponent(color);
  const sides: { allowed: boolean; between: number[]; kingPath: number[] }[] = [
    { allowed: castling[color].kingSide, between: [5, 6], kingPath: [4, 5, 6] },
    { allowed: castling[color].queenSide, between: [1, 2, 3], kingPath: [4, 3, 2] }
  ];
  return sides
    .filter(({ allowed, between, kingPath }) =>
      allowed &&
      between.every(col => !pieceAt(board, { row, col })) &&
      kingPath.every(col => !isAttacked(board, { row, col }, enemy)))
    .map(({ kingPath }) => ({ row, col: kingPath[2] }));
}

// Moves that follow the piece's movement, before checking whether they leave the mover's king attacked
function pseudoMoves(state: BoardState, from: Square): Square[] {
  const piece = pieceAt(state.board, from);
  if (!piece) return [];
  if (piece.type === 'pawn') return pawnMoves(state, from, piece.color);
  const moves = attackedSquares(state.board, from).filter(square => pieceAt(state.board, square)?.color !== piece.color);
  return piece.type === 'king' ? [...moves, ...castlingMoves(state, piece.color)] : moves;
}

// Rights last only while the king and that rook have never left their starting squares
function updateCastling(castling: CastlingRights, board: Board): CastlingRights {
  const keeps = (color: Color, rookCol: number) =>
    isPiece(board[HOME_ROW[color]][KING_COL], color, 'king') && isPiece(board[HOME_ROW[color]][rookCol], color, 'rook');
  const rightsFor = (color: Color) => ({
    kingSide: castling[color].kingSide && keeps(color, 7),
    queenSide: castling[color].queenSide && keeps(color, 0)
  });
  return { white: rightsFor('white'), black: rightsFor('black') };
}

// Plays a move that pseudoMoves allows, moving the rook when castling and removing the pawn taken en passant
function play(state: BoardState, from: Square, to: Square, promotion: PromotionType = 'queen'): { next: BoardState; captured: Piece | null } {
  const board = state.board.map(row => [...row]);
  const piece = board[from.row][from.col] as Piece; // pseudoMoves only returns moves for a piece
  let captured = board[to.row][to.col];
  board[from.row][from.col] = null;

  if (piece.type === 'pawn' && from.col !== to.col && !captured) {
    captured = board[from.row][to.col];
    board[from.row][to.col] = null;
  }
  if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) {
    const [rookFrom, rookTo] = to.col > from.col ? [7, 5] : [0, 3];
    board[from.row][rookTo] = board[from.row][rookFrom];
    board[from.row][rookFrom] = null;
  }
  const promotes = piece.type === 'pawn' && to.row === HOME_ROW[opponent(piece.color)];
  board[to.row][to.col] = promotes ? { color: piece.color, type: promotion } : piece;

  const enPassant = piece.type === 'pawn' && Math.abs(to.row - from.row) === 2
    ? { row: (from.row + to.row) / 2, col: from.col }
    : null;
  return { next: { board, castling: updateCastling(state.castling, board), enPassant }, captured };
}

// Where the piece on `from` may move without leaving its own king in check
export function legalMoves(state: BoardState, from: Square): Square[] {
  const piece = pieceAt(state.board, from);
  if (!piece) return [];
  return pseudoMoves(state, from).filter(to => !isInCheck(play(state, from, to).next.board, piece.color));
}

export function hasLegalMove(state: BoardState, color: Color): boolean {
  return squaresOf(state.board, color).some(from => legalMoves(state, from).length > 0);
}

export function isPromotion(board: Board, from: Square, to: Square): boolean {
  const piece = pieceAt(board, from);
  return piece?.type === 'pawn' && to.row === HOME_ROW[opponent(piece.color)];
}

// Neither side can mate: kings alone, one minor piece, or only bishops that all stand on one square color
export function isInsufficientMaterial(board: Board): boolean {
  const others = ALL_SQUARES.filter(square => {
    const piece = pieceAt(board, square);
    return piece && piece.type !== 'king';
  });
  if (others.length <= 1) return others.every(square => ['bishop', 'knight'].includes(pieceAt(board, square)?.type ?? ''));
  return others.every(square => pieceAt(board, square)?.type === 'bishop') &&
    new Set(others.map(({ row, col }) => (row + col) % 2)).size === 1;
}

// Only kings and pawns, no pawn can ever move again and no king can ever take a pawn, so only the kings move from now on
// and neither can ever be checked. Unsure cases count as not dead: a king in check or an en passant capture on offer.
function isLockedPawnPosition(state: BoardState): boolean {
  const { board } = state;
  const pieces = ALL_SQUARES.filter(square => pieceAt(board, square));
  const pawns = pieces.filter(square => pieceAt(board, square)?.type === 'pawn');
  const kingsAndPawns = pieces.every(square => ['king', 'pawn'].includes((pieceAt(board, square) as Piece).type));
  if (pawns.length === 0 || !kingsAndPawns || state.enPassant !== null) return false;
  if (isInCheck(board, 'white') || isInCheck(board, 'black')) return false;

  // A pawn is stuck when a pawn stands right in front of it and no enemy pawn stands where it captures
  const stuck = pawns.every(from => {
    const { color } = pieceAt(board, from) as Piece;
    const ahead = pieceAt(board, { row: from.row + FORWARD[color], col: from.col });
    return ahead?.type === 'pawn' &&
      attackedSquares(board, from).every(square => !isPiece(pieceAt(board, square), opponent(color), 'pawn'));
  });
  return stuck && !kingCanReachPawn(board, 'white') && !kingCanReachPawn(board, 'black');
}

// Whether the king could ever walk onto an enemy pawn, never stepping onto a square an enemy pawn attacks.
// The enemy king is treated as no obstacle, which only lets the king reach more, so a false answer is certain.
function kingCanReachPawn(board: Board, color: Color): boolean {
  const enemy = opponent(color);
  const start = findKing(board, color);
  if (!start) return true;
  const guarded = new Set(squaresOf(board, enemy)
    .filter(from => pieceAt(board, from)?.type === 'pawn')
    .flatMap(from => attackedSquares(board, from).map(squareName)));
  const seen = new Set([squareName(start)]);
  const queue = [start];
  for (let square = queue.shift(); square; square = queue.shift()) {
    for (const [dRow, dCol] of KING_STEPS) {
      const next = { row: square.row + dRow, col: square.col + dCol };
      if (!isOnBoard(next) || seen.has(squareName(next)) || guarded.has(squareName(next))) continue;
      const piece = pieceAt(board, next);
      if (isPiece(piece, enemy, 'pawn')) return true;
      if (isPiece(piece, color, 'pawn')) continue;
      seen.add(squareName(next));
      queue.push(next);
    }
  }
  return false;
}

// No sequence of legal moves can end in checkmate: insufficient material, or locked pawns (see isLockedPawnPosition)
export function isDeadPosition(state: BoardState): boolean {
  return isInsufficientMaterial(state.board) || isLockedPawnPosition(state);
}

// A lone king can never checkmate, and nobody can in a dead position
export function canEverCheckmate(state: BoardState, color: Color): boolean {
  const hasHelp = squaresOf(state.board, color).some(square => pieceAt(state.board, square)?.type !== 'king');
  return hasHelp && !isDeadPosition(state);
}

// Identifies a position for repetition: pieces, side to move, castling rights, and en passant only when it can be played
export function positionKey(state: BoardState, toMove: Color): string {
  const pieces = state.board.map(row => row.map(piece => {
    if (!piece) return '.';
    return piece.color === 'white' ? LETTERS[piece.type] : LETTERS[piece.type].toLowerCase();
  }).join('')).join('/');
  const { white, black } = state.castling;
  const rights = [white.kingSide && 'K', white.queenSide && 'Q', black.kingSide && 'k', black.queenSide && 'q']
    .filter(Boolean).join('');
  const target = state.enPassant;
  const capturable = target !== null && squaresOf(state.board, toMove).some(from =>
    pieceAt(state.board, from)?.type === 'pawn' && legalMoves(state, from).some(to => isSameSquare(to, target)));
  return `${pieces} ${toMove} ${rights || '-'} ${capturable ? squareName(target) : '-'}`;
}

function disambiguation(from: Square, rivals: Square[]): string {
  const name = squareName(from);
  if (rivals.length === 0) return '';
  if (rivals.every(rival => rival.col !== from.col)) return name[0];
  if (rivals.every(rival => rival.row !== from.row)) return name[1];
  return name;
}

// Standard algebraic notation without the check suffix, such as Nbd7, exd6, e8=Q or O-O
function notation(state: BoardState, from: Square, to: Square, promotion: PromotionType): string {
  const piece = pieceAt(state.board, from) as Piece;
  if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) return to.col > from.col ? 'O-O' : 'O-O-O';

  const isCapture = pieceAt(state.board, to) !== null || (piece.type === 'pawn' && from.col !== to.col);
  const takes = isCapture ? 'x' : '';
  if (piece.type === 'pawn') {
    const promoted = isPromotion(state.board, from, to) ? `=${LETTERS[promotion]}` : '';
    return `${isCapture ? FILES[from.col] : ''}${takes}${squareName(to)}${promoted}`;
  }

  // Name the file, the rank, or both when another piece of the same kind could also reach `to`
  const rivals = squaresOf(state.board, piece.color).filter(square =>
    !isSameSquare(square, from) &&
    pieceAt(state.board, square)?.type === piece.type &&
    legalMoves(state, square).some(target => isSameSquare(target, to)));
  return `${LETTERS[piece.type]}${disambiguation(from, rivals)}${takes}${squareName(to)}`;
}

export function createGameState(gameId: string): GameState {
  const position: BoardState = {
    board: initialBoard(),
    castling: { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } },
    enPassant: null
  };
  return {
    ...baseGameState(gameId),
    ...position,
    positions: [positionKey(position, 'white')],
    captured: { white: [], black: [] },
    lastMove: null,
    drawOffer: null
  };
}

// The board does not depend on who is seated: seat 1 is always white
export function resetLobby(state: GameState): GameState {
  return state;
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

function asSquare(value: unknown): Square | null {
  const input = asRecord(value);
  const square = { row: input?.row, col: input?.col };
  return Number.isInteger(square.row) && Number.isInteger(square.col) && isOnBoard(square as Square)
    ? square as Square
    : null;
}


// Both seats are filled whenever a move is allowed
function otherSeat(state: GameState, seat: Seat): Seat {
  return state.activePlayers.find(other => other !== seat) as Seat;
}

function repetitions(positions: string[]): number {
  const current = positions[positions.length - 1];
  return positions.filter(key => key === current).length;
}

// The draw the player to move may claim in this position, or null
export function claimableDraw({ positions }: Pick<GameState, 'positions'>): string | null {
  if (repetitions(positions) >= CLAIMED_REPETITIONS) return 'threefold repetition';
  if (positions.length > FIFTY_MOVE_PLIES) return 'the 50-move rule';
  return null;
}

// The draw that ends the game at once after a move that is not checkmate, or null while it goes on
function automaticDraw(next: GameState, toMove: Color): string | null {
  if (!hasLegalMove(next, toMove)) return 'Draw by stalemate';
  if (isInsufficientMaterial(next.board)) return 'Draw by insufficient material';
  if (isLockedPawnPosition(next)) return 'Draw by dead position: the pawns are locked and neither king can reach one';
  if (repetitions(next.positions) >= AUTOMATIC_REPETITIONS) return 'Draw by fivefold repetition';
  if (next.positions.length > SEVENTY_FIVE_MOVE_PLIES) return 'Draw by the 75-move rule';
  return null;
}

// The position keys once the legal move from `from` to `to` has produced `position`; a capture or pawn move starts them over
function positionsAfter(state: GameState, from: Square, to: Square, position: BoardState): string[] {
  const mover = pieceAt(state.board, from) as Piece;
  const key = positionKey(position, opponent(mover.color));
  const resetsCount = mover.type === 'pawn' || pieceAt(state.board, to) !== null;
  return resetsCount ? [key] : [...state.positions, key];
}

// The draw the mover may claim along with this legal move, for the position it produces, or null
export function claimableAfterMove(state: GameState, from: Square, to: Square): string | null {
  return claimableDraw({ positions: positionsAfter(state, from, to, play(state, from, to).next) });
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'move') return { error: 'Unknown move type' };

  const color = colorOf(seat);
  const from = asSquare(input.from);
  const to = asSquare(input.to);
  if (!from || !to || pieceAt(state.board, from)?.color !== color ||
    !legalMoves(state, from).some(square => isSameSquare(square, to))) {
    return { error: 'Invalid move' };
  }
  const promotes = isPromotion(state.board, from, to);
  const promotion = PROMOTION_TYPES.find(type => type === input.promotion);
  if (promotes && !promotion) return { error: 'Choose a piece to promote to' };

  const { next: position, captured } = play(state, from, to, promotion);
  const positions = positionsAfter(state, from, to, position);
  const claim = input.claimDraw === true ? claimableDraw({ positions }) : null;
  if (input.claimDraw === true && !claim) return { error: 'That move gives no draw to claim' };

  const toMove = opponent(color);
  const check = isInCheck(position.board, toMove);
  const mate = check && !hasLegalMove(position, toMove);
  const played = notation(state, from, to, promotion ?? 'queen') + (mate ? '#' : check ? '+' : '');
  const name = state.playerNames[seat];

  const next: GameState = lapseDrawOffer({
    ...state,
    ...position,
    positions,
    captured: captured ? { ...state.captured, [captured.color]: [...state.captured[captured.color], captured.type] } : state.captured,
    lastMove: { playerNumber: seat, from, to, notation: played },
    gameStatus: check
      ? `${name} played ${played}. ${state.playerNames[otherSeat(state, seat)]} is in check`
      : `${name} played ${played}`
  }, seat);

  // Checkmate wins even on the move that would draw by repetition or the 75-move rule
  if (mate) return { state: endGame(next, [seat], `Checkmate! ${name} wins!`) };
  const draw = automaticDraw(next, toMove);
  if (draw) return { state: endGame(next, [], draw) };
  if (claim) return { state: endGame(next, [], `${name} played ${played} and claimed a draw by ${claim}`) };
  return { state: { ...next, currentPlayer: nextActivePlayer(next, seat) } };
}

// A claim by the player to move, for the position on the board
function claimDraw(state: GameState, seat: Seat): Result<GameState> {
  const refusal = endingRefusal(state);
  if (refusal) return { error: refusal };
  if (state.currentPlayer !== seat) return { error: 'You can claim a draw only on your turn' };
  const claim = claimableDraw(state);
  if (!claim) return { error: 'There is no draw to claim' };
  return { state: endGame(state, [], `${state.playerNames[seat]} claimed a draw by ${claim}`) };
}

// Resigning is a draw when the opponent could never checkmate by any series of legal moves
function resignationDraws(state: GameState, seat: Seat): boolean {
  return !canEverCheckmate(state, opponent(colorOf(seat)));
}

// Claiming a draw is chess's own action; resigning and draw offers are the shared ending actions
export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  if (asRecord(action)?.type === 'claimDraw') return claimDraw(state, seat);
  return applyEndingAction(state, seat, action, resignationDraws);
}
