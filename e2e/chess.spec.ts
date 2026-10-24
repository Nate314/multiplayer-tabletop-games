import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat, type Table } from './fixtures.ts';
import { positionKey } from '../games/chess/rules.ts';
import type { Board, BoardState, CastlingRights, PieceType } from '../games/chess/types.ts';

// One test per rule and control in games/chess/README.md. Seat 1 (Alice) plays white, seat 2 (Bob) black.
// Squares are named as in chess, 'e4'; the page finds a square by its row and column, whichever way the board is turned.

function rowCol(name: string): { row: number; col: number } {
  return { row: 8 - Number(name[1]), col: name.charCodeAt(0) - 'a'.charCodeAt(0) };
}

const TYPES: Record<string, PieceType> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

// Uppercase letters are white pieces and lowercase black, e.g. { e1: 'K', e8: 'k' }
function boardOf(pieces: Record<string, string>): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const [name, letter] of Object.entries(pieces)) {
    const { row, col } = rowCol(name);
    board[row][col] = { color: letter === letter.toUpperCase() ? 'white' : 'black', type: TYPES[letter.toUpperCase()] };
  }
  return board;
}

const NO_CASTLING: CastlingRights = { white: { kingSide: false, queenSide: false }, black: { kingSide: false, queenSide: false } };
const WHITE_CASTLING: CastlingRights = { white: { kingSide: true, queenSide: true }, black: { kingSide: false, queenSide: false } };

// The key of a position for repetition counts
function keyOf(pieces: Record<string, string>, toMove: 1 | 2, castling = NO_CASTLING): string {
  const state: BoardState = { board: boardOf(pieces), castling, enPassant: null };
  return positionKey(state, toMove === 1 ? 'white' : 'black');
}

// Keys that never repeat, to stand for earlier moves
const filler = (count: number) => Array.from({ length: count }, (_, index) => `earlier ${index}`);

type SetUp = { toMove?: 1 | 2; castling?: CastlingRights; history?: string[] };

// Puts only the given pieces on the board, the game already started; `history` holds position keys before this one
async function setUp(table: Table, pieces: Record<string, string>, { toMove = 1, castling = NO_CASTLING, history = [] }: SetUp = {}) {
  await table.patch({
    board: boardOf(pieces),
    castling,
    enPassant: null,
    positions: [...history, keyOf(pieces, toMove, castling)],
    captured: { white: [], black: [] },
    lastMove: null,
    currentPlayer: toMove,
    started: true
  });
}

const square = (page: Page, name: string) => {
  const { row, col } = rowCol(name);
  return page.locator(`[data-anim-key="square-${row}-${col}"]`);
};
// The piece standing on a square, by its label such as 'white king'
const piece = (page: Page, name: string) => square(page, name).getByRole('img');
const marks = (page: Page) => page.locator('.square.legal-move, .square.legal-capture');
const status = (page: Page) => page.locator('.game-status');

// Clicks the squares in turn
async function clicks(page: Page, ...names: string[]) {
  for (const name of names) await square(page, name).click();
}

// Picks up the piece on `from` and checks exactly `targets` are marked, then puts it down again
async function expectMoves(page: Page, from: string, targets: string[]) {
  await square(page, from).click();
  await expect(square(page, from)).toHaveClass(/selected/);
  await expect(marks(page)).toHaveCount(targets.length);
  for (const target of targets) await expect(square(page, target)).toHaveClass(/legal-(move|capture)/);
  await square(page, from).click();
  await expect(page.locator('.square.selected')).toHaveCount(0);
}

async function start(seat: Seat) {
  const table = await seat('chess', ['Alice', 'Bob']);
  const [alice, bob] = table.pages;
  return { table, alice, bob };
}

// Locked pawns across the whole board (from the unit tests); no king can cross them
const WALL = {
  a3: 'P', b4: 'P', c3: 'P', d4: 'P', e3: 'P', f4: 'P', g3: 'P', h4: 'P',
  a4: 'p', b5: 'p', c4: 'p', d5: 'p', e4: 'p', f5: 'p', g4: 'p', h5: 'p'
};

test.describe('Chess rules', () => {
  test('each piece moves the standard way: king, queen, rook, bishop, jumping knight, and the pawn', async ({ seat }) => {
    const { table, alice } = await start(seat);
    // On an empty board from d4, with the kings out of the way on a2 and h7
    await setUp(table, { a2: 'K', h7: 'k', d4: 'Q' });
    await expect(marks(alice)).toHaveCount(0);
    await square(alice, 'd4').click();
    await expect(marks(alice)).toHaveCount(27);
    await expect(square(alice, 'h8')).toHaveClass(/legal-move/);
    await expect(square(alice, 'd8')).toHaveClass(/legal-move/);
    await square(alice, 'd4').click();

    await setUp(table, { a2: 'K', h7: 'k', d4: 'R' });
    await square(alice, 'd4').click();
    await expect(marks(alice)).toHaveCount(14);
    for (const target of ['d1', 'd8', 'a4', 'h4']) await expect(square(alice, target)).toHaveClass(/legal-move/);
    await expect(square(alice, 'e5')).not.toHaveClass(/legal/);
    await square(alice, 'd4').click();

    await setUp(table, { a2: 'K', h7: 'k', d4: 'B' });
    await square(alice, 'd4').click();
    await expect(marks(alice)).toHaveCount(13);
    await expect(square(alice, 'd5')).not.toHaveClass(/legal/);
    await square(alice, 'd4').click();

    await setUp(table, { a2: 'K', h7: 'k', d4: 'N' });
    await expectMoves(alice, 'd4', ['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5']);

    await setUp(table, { d4: 'K', h7: 'k' });
    await expectMoves(alice, 'd4', ['c3', 'c4', 'c5', 'd3', 'd5', 'e3', 'e4', 'e5']);

    // From the start: the knight jumps over the pawns, a pawn may go one or two, and captures diagonally
    await setUp(table, {
      a1: 'R', b1: 'N', e1: 'K', a2: 'P', b2: 'P', c2: 'P', d2: 'P', e2: 'P', e8: 'k'
    });
    await expectMoves(alice, 'b1', ['a3', 'c3']);
    await expectMoves(alice, 'e2', ['e3', 'e4']);
    await setUp(table, { e1: 'K', e8: 'k', e4: 'P', e5: 'p', d5: 'p' });
    await expectMoves(alice, 'e4', ['d5']);
  });

  test('castling moves the king two squares and the rook to its other side, only when every condition holds', async ({ seat }) => {
    const { table, alice } = await start(seat);
    const rooks = { a1: 'R', e1: 'K', h1: 'R', a8: 'k' };
    await setUp(table, rooks, { castling: WHITE_CASTLING });
    await square(alice, 'e1').click();
    await expect(square(alice, 'g1')).toHaveClass(/legal-move/);
    await expect(square(alice, 'c1')).toHaveClass(/legal-move/);
    await square(alice, 'g1').click();
    await expect(piece(alice, 'g1')).toHaveAccessibleName('white king');
    await expect(piece(alice, 'f1')).toHaveAccessibleName('white rook');
    await expect(square(alice, 'h1').getByRole('img')).toHaveCount(0);

    const canCastle = async (pieces: Record<string, string>, castling: CastlingRights, kingSide: boolean, queenSide: boolean) => {
      await setUp(table, pieces, { castling });
      await square(alice, 'e1').click();
      await expect(square(alice, 'e1')).toHaveClass(/selected/);
      for (const [target, allowed] of [['g1', kingSide], ['c1', queenSide]] as const) {
        if (allowed) await expect(square(alice, target)).toHaveClass(/legal-move/);
        else await expect(square(alice, target)).not.toHaveClass(/legal/);
      }
      await square(alice, 'e1').click();
    };
    // The h1 rook has moved: no right left on that side
    await canCastle(rooks, { ...WHITE_CASTLING, white: { kingSide: false, queenSide: true } }, false, true);
    // A piece between king and rook
    await canCastle({ ...rooks, b1: 'N' }, WHITE_CASTLING, true, false);
    // The king is in check
    await canCastle({ ...rooks, e5: 'r' }, WHITE_CASTLING, false, false);
    // f1 is attacked, so the king would pass through check
    await canCastle({ ...rooks, f5: 'r' }, WHITE_CASTLING, false, true);
    // g1 is attacked, so the king would land in check
    await canCastle({ ...rooks, g5: 'r' }, WHITE_CASTLING, false, true);
  });

  test('en passant takes a pawn that just moved two squares, but only on the very next move', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, { e1: 'K', e8: 'k', e5: 'P', d7: 'p', h7: 'p' }, { toMove: 2 });
    await clicks(bob, 'd7', 'd5');
    await square(alice, 'e5').click();
    await expect(square(alice, 'd6')).toHaveClass(/legal-move/);
    await square(alice, 'd6').click();
    await expect(piece(alice, 'd6')).toHaveAccessibleName('white pawn');
    await expect(square(alice, 'd5').getByRole('img')).toHaveCount(0);
    await expect(alice.getByLabel('Pieces Alice captured').getByRole('img', { name: 'black pawn' })).toBeVisible();

    // A move later the chance is gone
    const late = await start(seat);
    await setUp(late.table, { e1: 'K', e8: 'k', e5: 'P', d7: 'p', h7: 'p' }, { toMove: 2 });
    await clicks(late.bob, 'd7', 'd5');
    await clicks(late.alice, 'e1', 'f1');
    await clicks(late.bob, 'h7', 'h6');
    await square(late.alice, 'e5').click();
    await expect(marks(late.alice)).toHaveCount(1);
    await expect(square(late.alice, 'e6')).toHaveClass(/legal-move/);
    await expect(square(late.alice, 'd6')).not.toHaveClass(/legal/);
  });

  test('a pawn on the far rank becomes the queen, rook, bishop or knight its player picks', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, { e1: 'K', h5: 'k', a7: 'P' });
    await clicks(alice, 'a7', 'a8');
    await expect(alice.getByText('Promote to')).toBeVisible();
    for (const type of ['queen', 'rook', 'bishop', 'knight']) {
      await expect(alice.getByRole('button', { name: `white ${type}` })).toBeVisible();
    }
    await alice.getByRole('button', { name: 'white knight' }).click();
    await expect(piece(bob, 'a8')).toHaveAccessibleName('white knight');
    await expect(square(bob, 'a7').getByRole('img')).toHaveCount(0);
  });

  test('a move may never leave your own king in check', async ({ seat }) => {
    const { table, alice } = await start(seat);
    // The bishop is pinned to the king by the rook on e8
    await setUp(table, { e1: 'K', e2: 'B', e8: 'r', a8: 'k' });
    await square(alice, 'e2').click();
    await expect(square(alice, 'e2')).toHaveClass(/selected/);
    await expect(marks(alice)).toHaveCount(0);
    // With a rook on d8 too, the king may not step onto the d-file
    await setUp(table, { e1: 'K', e2: 'B', e8: 'r', d8: 'r', a8: 'k' });
    await expectMoves(alice, 'e1', ['f1', 'f2']);
  });

  test('checkmate wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    // Fool's mate, played from the start
    await clicks(alice, 'f2', 'f3');
    await clicks(bob, 'e7', 'e5');
    await clicks(alice, 'g2', 'g4');
    await clicks(bob, 'd8', 'h4');
    await expect(status(alice)).toHaveText('Checkmate! Bob wins!');
    await expect(alice.getByText('Game Over')).toBeVisible();
  });

  test('a player may resign on either turn and the opponent wins, but it is a draw when the opponent has only a king', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, 'e2', 'e4');
    // It is Bob's turn and Alice resigns
    await alice.getByRole('button', { name: 'Resign' }).click();
    await alice.getByRole('button', { name: 'Confirm resign' }).click();
    await expect(bob.locator('.game-status')).toHaveText('Alice resigned. Bob wins!');

    const drawn = await start(seat);
    await setUp(drawn.table, { e1: 'K', d1: 'Q', e8: 'k' });
    await drawn.alice.getByRole('button', { name: 'Resign' }).click();
    await drawn.alice.getByRole('button', { name: 'Confirm resign' }).click();
    await expect(status(drawn.bob)).toHaveText('Alice resigned, but Bob could never checkmate. Draw.');
  });

  test('a draw offer may be made at any time and lapses when declined or when the opponent moves', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, 'e2', 'e4');
    // Offered on Bob's turn, then declined
    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(status(alice)).toHaveText('Bob declined the draw');
    await expect(alice.getByRole('button', { name: 'Offer draw' })).toBeEnabled();

    // Offered again, and Bob moves instead of answering
    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toBeVisible();
    await clicks(bob, 'e7', 'e5');
    await expect(alice.getByRole('button', { name: 'Offer draw' })).toBeEnabled();
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toHaveCount(0);

    // Accepted
    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await bob.getByRole('button', { name: 'Accept draw' }).click();
    await expect(status(alice)).toHaveText('Draw by agreement');
  });

  test('stalemate, a dead position, fivefold repetition and the 75-move rule draw at once, but a mate on that move still wins', async ({ seat }) => {
    const stalemate = await start(seat);
    await setUp(stalemate.table, { a8: 'k', b6: 'K', c1: 'Q' });
    await clicks(stalemate.alice, 'c1', 'c7');
    await expect(status(stalemate.bob)).toHaveText('Draw by stalemate');

    const dead = await start(seat);
    await setUp(dead.table, { d4: 'K', d5: 'p', h8: 'k' });
    await clicks(dead.alice, 'd4', 'd5');
    await expect(status(dead.bob)).toHaveText('Draw by insufficient material');

    // Nf3 brings back a position that stood four times before
    const knights = { e1: 'K', g1: 'N', e8: 'k', g8: 'n' };
    const afterNf3 = keyOf({ e1: 'K', f3: 'N', e8: 'k', g8: 'n' }, 2);
    const fivefold = await start(seat);
    await setUp(fivefold.table, knights, { history: [afterNf3, 'a', afterNf3, 'b', afterNf3, 'c', afterNf3, 'd'] });
    await clicks(fivefold.alice, 'g1', 'f3');
    await fivefold.alice.getByRole('button', { name: 'Just move' }).click();
    await expect(status(fivefold.bob)).toHaveText('Draw by fivefold repetition');

    // 149 moves without a capture or pawn move, and this is the 150th
    const seventyFive = await start(seat);
    await setUp(seventyFive.table, knights, { history: filler(149) });
    await clicks(seventyFive.alice, 'g1', 'f3');
    await seventyFive.alice.getByRole('button', { name: 'Just move' }).click();
    await expect(status(seventyFive.bob)).toHaveText('Draw by the 75-move rule');

    const mate = await start(seat);
    await setUp(mate.table, { h8: 'k', g6: 'K', a1: 'R' }, { history: filler(149) });
    await clicks(mate.alice, 'a1', 'a8');
    await mate.alice.getByRole('button', { name: 'Just move' }).click();
    await expect(status(mate.bob)).toHaveText('Checkmate! Alice wins!');
  });

  test('threefold repetition and the 50-move rule are claimed by the player to move, on the board or with the move, and play goes on until then', async ({ seat }) => {
    const knights = { e1: 'K', g1: 'N', e8: 'k', g8: 'n' };
    // The position on the board has stood three times
    const threefold = await start(seat);
    const here = keyOf(knights, 1);
    await setUp(threefold.table, knights, { history: [here, 'a', here, 'b'] });
    await expect(threefold.bob.getByRole('button', { name: 'Claim draw' })).toHaveCount(0);
    await threefold.alice.getByRole('button', { name: 'Claim draw' }).click();
    await expect(status(threefold.bob)).toHaveText('Alice claimed a draw by threefold repetition');

    // Nf3 makes the third repetition and is claimed with the move
    const withMove = await start(seat);
    const afterNf3 = keyOf({ e1: 'K', f3: 'N', e8: 'k', g8: 'n' }, 2);
    await setUp(withMove.table, knights, { history: [afterNf3, 'a', afterNf3, 'b'] });
    await clicks(withMove.alice, 'g1', 'f3');
    await withMove.alice.getByRole('button', { name: 'Move and claim draw' }).click();
    await expect(status(withMove.bob)).toHaveText('Alice played Nf3 and claimed a draw by threefold repetition');

    // Fifty moves each have passed; Alice plays on, and then Bob claims
    const fifty = await start(seat);
    await setUp(fifty.table, knights, { history: filler(100) });
    await expect(fifty.alice.getByRole('button', { name: 'Claim draw' })).toBeVisible();
    await clicks(fifty.alice, 'g1', 'f3');
    await fifty.alice.getByRole('button', { name: 'Just move' }).click();
    await expect(fifty.bob.getByText("Bob's turn")).toBeVisible();
    await fifty.bob.getByRole('button', { name: 'Claim draw' }).click();
    await expect(status(fifty.alice)).toHaveText('Bob claimed a draw by the 50-move rule');
  });

  test('dead positions are found for bare kings, a lone minor piece, same-colored bishops and locked pawns', async ({ seat }) => {
    // Each capture or move leaves a dead position
    const cases: [Record<string, string>, string, string, string][] = [
      [{ e1: 'K', c1: 'B', h6: 'p', e8: 'k' }, 'c1', 'h6', 'Draw by insufficient material'],
      [{ e1: 'K', g1: 'N', h3: 'p', e8: 'k' }, 'g1', 'h3', 'Draw by insufficient material'],
      // Both bishops end on dark squares
      [{ e1: 'K', c1: 'B', e3: 'p', f8: 'b', a8: 'k' }, 'c1', 'e3', 'Draw by insufficient material'],
      [{ ...WALL, d1: 'K', e8: 'k' }, 'd1', 'e1', 'Draw by dead position: the pawns are locked and neither king can reach one']
    ];
    for (const [pieces, from, to, result] of cases) {
      const { table, alice, bob } = await start(seat);
      await setUp(table, pieces);
      await clicks(alice, from, to);
      await expect(status(bob)).toHaveText(result);
    }

    // Bishops on squares of both colors can still mate, so play goes on
    const { table, alice, bob } = await start(seat);
    await setUp(table, { e1: 'K', c1: 'B', e3: 'p', c8: 'b', a8: 'k' });
    await clicks(alice, 'c1', 'e3');
    await expect(status(bob)).toHaveText('Alice played Bxe3');
    await expect(bob.getByText("Bob's turn")).toBeVisible();
  });

  test('a player who disconnects is waited for, and if dismissed the other player wins', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, 'e2', 'e4');
    await leave(bob);
    await expect(alice.getByText('Waiting for Bob to reconnect')).toBeVisible();
    await expect(alice.getByText('Game Over')).toHaveCount(0);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test('an undo needs the other player\'s approval', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, 'e2', 'e4');
    await expect(piece(alice, 'e4')).toHaveAccessibleName('white pawn');

    await alice.getByRole('button', { name: 'Undo' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(piece(alice, 'e4')).toHaveAccessibleName('white pawn');

    await undo(alice, bob);
    await expect(piece(alice, 'e2')).toHaveAccessibleName('white pawn');
    await expect(square(alice, 'e4').getByRole('img')).toHaveCount(0);
    await expect(alice.getByText("Alice's turn")).toBeVisible();
  });
});

test.describe('Chess controls', () => {
  test('the first player plays white and each player sees their own pieces at the bottom', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.getByText('Alice (White) (you)')).toBeVisible();
    await expect(bob.getByText('Bob (Black) (you)')).toBeVisible();
    // The last square drawn is the bottom right: h1 for white, a8 for black
    await expect(alice.locator('.square').last()).toHaveAttribute('data-anim-key', 'square-7-7');
    await expect(bob.locator('.square').last()).toHaveAttribute('data-anim-key', 'square-0-0');
    await expect(alice.locator('.square').last().getByRole('img')).toHaveAccessibleName('white rook');
    await expect(bob.locator('.square').last().getByRole('img')).toHaveAccessibleName('black rook');
  });

  test('clicking your piece marks its moves, a dot for an empty square and a ring for a capture, and a marked square moves it', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, { e1: 'K', e8: 'k', e4: 'P', d5: 'p' });
    await square(alice, 'e4').click();
    await expect(square(alice, 'e5')).toHaveClass(/legal-move/);
    await expect(square(alice, 'd5')).toHaveClass(/legal-capture/);
    const after = await square(alice, 'e5').evaluate(element => getComputedStyle(element, '::after').borderRadius);
    expect(after).toBe('50%');
    await square(alice, 'd5').click();
    await expect(piece(bob, 'd5')).toHaveAccessibleName('white pawn');
  });

  test('clicking the piece again or an unmarked square puts it down, and clicking another piece picks that one', async ({ seat }) => {
    const { alice } = await start(seat);
    await square(alice, 'e2').click();
    await expect(marks(alice)).toHaveCount(2);
    await square(alice, 'e2').click();
    await expect(marks(alice)).toHaveCount(0);

    await square(alice, 'e2').click();
    await square(alice, 'e6').click();
    await expect(marks(alice)).toHaveCount(0);
    await expect(alice.locator('.square.selected')).toHaveCount(0);

    await square(alice, 'e2').click();
    await square(alice, 'g1').click();
    await expect(square(alice, 'g1')).toHaveClass(/selected/);
    await expect(square(alice, 'f3')).toHaveClass(/legal-move/);
    await expect(square(alice, 'e4')).not.toHaveClass(/legal/);
  });

  test('a pawn reaching the far rank opens a box to choose its piece, and Cancel takes the move back', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await setUp(table, { e1: 'K', h5: 'k', a7: 'P' });
    await clicks(alice, 'a7', 'a8');
    await expect(alice.locator('.board-prompt')).toBeVisible();
    await alice.getByRole('button', { name: 'Cancel' }).click();
    await expect(alice.locator('.board-prompt')).toHaveCount(0);
    await expect(piece(alice, 'a7')).toHaveAccessibleName('white pawn');
    await expect(alice.getByText("Alice's turn")).toBeVisible();

    await clicks(alice, 'a7', 'a8');
    await alice.getByRole('button', { name: 'white queen' }).click();
    await expect(piece(alice, 'a8')).toHaveAccessibleName('white queen');
  });

  test('the last move\'s squares are tinted and a king in check stands on a red square', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await clicks(alice, 'e2', 'e4');
    await expect(bob.locator('.square.last-move')).toHaveCount(2);
    await expect(square(bob, 'e2')).toHaveClass(/last-move/);
    await expect(square(bob, 'e4')).toHaveClass(/last-move/);

    await setUp(table, { e1: 'K', a1: 'R', e8: 'k' });
    await clicks(alice, 'a1', 'a8');
    await expect(square(bob, 'e8')).toHaveClass(/in-check/);
    await expect(bob.locator('.square.in-check')).toHaveCount(1);
    const image = await square(bob, 'e8').evaluate(element => getComputedStyle(element).backgroundImage);
    expect(image).toContain('radial-gradient');
    expect(image).toContain('rgb(255, 59, 48)');
    await expect(bob.getByText("Bob's turn (in check)")).toBeVisible();
  });

  test('the side panel shows the status, whose turn it is, each player\'s color and their captures', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await setUp(table, { e1: 'K', e8: 'k', e4: 'P', d5: 'p' });
    await expect(alice.getByText("Alice's turn")).toBeVisible();
    await expect(bob.getByText('Alice (White)')).toBeVisible();
    await expect(bob.getByText('Bob (Black) (you)')).toBeVisible();
    await expect(bob.getByLabel('Pieces Alice captured')).toHaveText('No captures');
    await clicks(alice, 'e4', 'd5');
    await expect(status(bob)).toHaveText('Alice played exd5');
    await expect(bob.getByText("Bob's turn")).toBeVisible();
    await expect(bob.getByLabel('Pieces Alice captured').getByRole('img')).toHaveAccessibleName('black pawn');
    await expect(bob.getByLabel('Pieces Bob captured')).toHaveText('No captures');
  });

  test('the board is dimmed when it is not your turn', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(alice.locator('.board')).not.toHaveClass(/not-your-turn/);
    await expect(bob.locator('.board')).toHaveClass(/not-your-turn/);
    await expect.poll(() => bob.locator('.board').evaluate(element => getComputedStyle(element).opacity)).toBe('0.75');
  });

  test('Resign asks to Confirm resign, and Keep playing changes your mind', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, 'e2', 'e4');
    await bob.getByRole('button', { name: 'Resign' }).click();
    await bob.getByRole('button', { name: 'Keep playing' }).click();
    await expect(bob.getByRole('button', { name: 'Confirm resign' })).toHaveCount(0);
    await expect(bob.getByRole('button', { name: 'Resign' })).toBeVisible();
    await expect(bob.getByText("Bob's turn")).toBeVisible();

    await bob.getByRole('button', { name: 'Resign' }).click();
    await bob.getByRole('button', { name: 'Confirm resign' }).click();
    await expect(status(alice)).toHaveText('Bob resigned. Alice wins!');
  });

  test('Offer draw reads Draw offered until answered, and the opponent sees Accept draw and Decline', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, 'e2', 'e4');
    await alice.getByRole('button', { name: 'Offer draw' }).click();
    await expect(alice.getByRole('button', { name: 'Draw offered' })).toBeDisabled();
    await expect(bob.locator('.draw-offer')).toContainText('Alice offers a draw');
    await expect(bob.getByRole('button', { name: 'Accept draw' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Accept draw' })).toHaveCount(0);
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(alice.getByRole('button', { name: 'Offer draw' })).toBeEnabled();
  });

  test('Claim draw shows on your turn when a claim stands, and a claimable move offers Move and claim draw, Just move or Cancel', async ({ seat }) => {
    const knights = { e1: 'K', g1: 'N', e8: 'k', g8: 'n' };
    const { table, alice, bob } = await start(seat);
    await expect(alice.getByRole('button', { name: 'Claim draw' })).toHaveCount(0);
    await setUp(table, knights, { history: filler(100) });
    await expect(alice.getByRole('button', { name: 'Claim draw' })).toBeVisible();
    await expect(bob.getByRole('button', { name: 'Claim draw' })).toHaveCount(0);

    await clicks(alice, 'g1', 'f3');
    await expect(alice.getByText('This move allows a draw by the 50-move rule')).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Move and claim draw' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Just move' })).toBeVisible();
    await alice.getByRole('button', { name: 'Cancel' }).click();
    await expect(alice.locator('.board-prompt')).toHaveCount(0);
    await expect(piece(alice, 'g1')).toHaveAccessibleName('white knight');
    await expect(alice.getByText("Alice's turn")).toBeVisible();
  });

  test('clicking Undo asks the opponent to undo the last move', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await clicks(alice, 'e2', 'e4');
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.locator('.undo-vote')).toContainText('Alice wants to undo the last turn');
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('en passant');
    await expect(faq).toContainText('Claim draw');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Chess differences from Wikipedia', () => {
  test('a dead position is not declared while a king can reach a pawn, or while an en passant capture is on offer', async ({ seat }) => {
    // The white king on f6 is behind the black pawns and can take h5
    const reachable = await start(seat);
    await setUp(reachable.table, { ...WALL, f7: 'K', a8: 'k' });
    await clicks(reachable.alice, 'f7', 'f6');
    await expect(status(reachable.bob)).toHaveText('Alice played Kf6');
    await expect(reachable.bob.getByText("Bob's turn")).toBeVisible();

    // h2-h4 completes the wall but black may take en passant, so the check says nothing until that chance is gone
    const { h4: _h4, ...open } = WALL;
    const { table, alice, bob } = await start(seat);
    await setUp(table, { ...open, h2: 'P', e1: 'K', e8: 'k' });
    await clicks(alice, 'h2', 'h4');
    await expect(bob.getByText("Bob's turn")).toBeVisible();
    await clicks(bob, 'e8', 'd8');
    await expect(status(alice)).toHaveText('Draw by dead position: the pawns are locked and neither king can reach one');
  });

  test('there is no arbiter: no claim is offered when there is nothing to claim, and a move is only offered with a claim when it produces one', async ({ seat }) => {
    const knights = { e1: 'K', g1: 'N', e8: 'k', g8: 'n' };
    const afterNf3 = keyOf({ e1: 'K', f3: 'N', e8: 'k', g8: 'n' }, 2);
    const { table, alice, bob } = await start(seat);
    await setUp(table, knights, { history: [afterNf3, 'a', afterNf3, 'b'] });
    await expect(alice.getByRole('button', { name: 'Claim draw' })).toHaveCount(0);
    // Nh3 repeats nothing, so it is played at once with no box
    await clicks(alice, 'g1', 'h3');
    await expect(alice.locator('.board-prompt')).toHaveCount(0);
    await expect(piece(bob, 'h3')).toHaveAccessibleName('white knight');
    await expect(bob.getByRole('button', { name: 'Claim draw' })).toHaveCount(0);
  });
});

test.describe('Chess clock', () => {
  const clocks = (page: Page) => page.locator('.chess-clock');

  test("the clock shows each player's time", async ({ seat }) => {
    const table = await seat('chess', ['Alice', 'Bob'], { houseRules: { clockMinutes: 5, incrementSeconds: 2 } });
    const [alice, bob] = table.pages;
    await expect(clocks(alice)).toHaveCount(2);
    await expect(clocks(alice).nth(1)).toHaveText('5:00');
    await expect(alice.locator('.chess-clock-running')).toHaveCount(1);
    await expect(alice.locator('.player-row.to-move .chess-clock-running')).toBeVisible();
    await clicks(alice, 'e2', 'e4');
    await expect(bob.locator('.player-row.to-move .chess-clock-running')).toContainText(/^[45]:\d\d$/);
    // White paid for the seconds used and got the increment, so it never reads 5:02 or less than 4:50
    await expect(clocks(bob).first()).toHaveText(/^(5:0[0-2]|4:5\d)$/);
    const before = await clocks(bob).nth(1).textContent();
    await expect(clocks(bob).nth(1)).not.toHaveText(before as string, { timeout: 3000 });
    await bob.reload(); // the countdown keeps going after a reload
    await expect(bob.locator('.chess-clock-running')).toBeVisible();
    const reloaded = await clocks(bob).nth(1).textContent();
    await expect(clocks(bob).nth(1)).not.toHaveText(reloaded as string, { timeout: 3000 });
  });

  test('a player whose clock runs out loses', async ({ seat }) => {
    const table = await seat('chess', ['Alice', 'Bob'], { houseRules: { clockMinutes: 5 } });
    const [alice, bob] = table.pages;
    await table.patch({ clock: { remainingMs: { 1: 300_000, 2: 300_000 }, runningSince: Date.now() - 301_000 }, started: true });
    await expect(status(bob)).toHaveText('Alice ran out of time. Bob wins!');
    await expect(alice.getByText('Game Over')).toBeVisible();
    await expect(alice.locator('.chess-clock-running')).toHaveCount(0);
  });
});
