import { useEffect, useRef, useState } from 'react';
import { shuffle } from '../../../shared/shuffle.ts';
import gameService from '../../../src/services/gameService';
import Board from './Board';
import Tile from './Tile';
import { rackKey, squareKey } from './animateMove.ts';
import { useSlides } from './useSlides.ts';
import { moveInOrder, movePending } from './placing.ts';
import type { PendingTile } from './placing.ts';
import { useDrag } from '../../../src/drag/useDrag.ts';
import { BLANK, LETTERS, RACK_SIZE, evaluatePlacement } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

type PlayAreaProps = {
  gameState: PublicGameState;
  isMyTurn: boolean;
  initialOrder: number[]; // the rack slot shown at each place
  onShuffle: (order: number[]) => void;
};

type Square = { row: number; col: number };

// Drag ids: a rack tile by its slot, a tile placed this turn by its square; targets are squares, rack places and the rack
const SQUARE = /^(?:square|pending)-(\d+)-(\d+)$/;
const squareOf = (id: string): Square | null => {
  const match = SQUARE.exec(id);
  return match ? { row: Number(match[1]), col: Number(match[2]) } : null;
};
const numberAfter = (prefix: string, id: string) => id.startsWith(prefix) ? Number(id.slice(prefix.length)) : null;

// The board, the player's rack and the turn's buttons. The game screen remounts it after every move,
// so placed tiles and selections never outlive the rack they were made from.
// Tiles glide between the rack and the board as they are placed and taken back, and to their new places on a shuffle.
// Rack tiles can be dragged onto the board on your turn, or between places on the rack at any time; tiles placed
// this turn can be dragged to another square or back to the rack. Only placing and Play reach the server.
export default function PlayArea({ gameState, isMyTurn, initialOrder, onShuffle }: PlayAreaProps) {
  const { board, rack, bagCount, lastMove, currentPlayer } = gameState;
  const rootRef = useRef<HTMLDivElement>(null);
  const slide = useSlides(rootRef);
  const [order, setOrder] = useState(initialOrder);
  const [pending, setPending] = useState<PendingTile[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [blankSquare, setBlankSquare] = useState<Square | null>(null);
  const [exchanging, setExchanging] = useState<number[] | null>(null);

  const liftSelected = useRef(false); // the current drag selected its rack tile, so a drag that ends without placing clears it
  // The turn passed on (the turn timer ran out): tiles put down but not played go back to the rack
  useEffect(() => {
    setPending([]);
    setSelected(null);
    setBlankSquare(null);
    setExchanging(null);
  }, [currentPlayer]);

  const isPlaced = (slot: number) => pending.some(tile => tile.slot === slot);
  const pendingAt = ({ row, col }: Square) => pending.find(tile => tile.row === row && tile.col === col);
  const isOpen = (square: Square) => board[square.row][square.col] === null && !pendingAt(square);
  const rackKeyOf = (slot: number) => rackKey(order.indexOf(slot));
  const preview = pending.length > 0 ? evaluatePlacement(board, pending) : null;
  const canExchange = isMyTurn && bagCount >= RACK_SIZE;

  function clickSlot(slot: number) {
    if (exchanging) {
      setExchanging(exchanging.includes(slot) ? exchanging.filter(s => s !== slot) : [...exchanging, slot]);
    } else if (!isPlaced(slot)) {
      setSelected(selected === slot ? null : slot);
      setBlankSquare(null);
    }
  }

  function place(tile: PendingTile) {
    slide([[rackKeyOf(tile.slot), squareKey(tile.row, tile.col)]]);
    setPending([...pending, tile]);
    setSelected(null);
    setBlankSquare(null);
  }

  // The rack tile in `slot` goes on the square; a blank first asks for its letter
  function placeSlot(slot: number, row: number, col: number) {
    if (rack[slot] === BLANK) {
      setSelected(slot);
      setBlankSquare({ row, col });
    } else place({ row, col, letter: rack[slot], slot });
  }

  function clickSquare(row: number, col: number) {
    const taken = pendingAt({ row, col });
    if (taken) {
      slide([[squareKey(row, col), rackKeyOf(taken.slot)]]);
      setPending(pending.filter(tile => tile !== taken));
      return;
    }
    if (selected === null || exchanging) return;
    placeSlot(selected, row, col);
  }

  function recall() {
    slide(pending.map(tile => [squareKey(tile.row, tile.col), rackKeyOf(tile.slot)]));
    setPending([]);
    setSelected(null);
    setBlankSquare(null);
  }

  function startExchange() {
    recall();
    setExchanging([]);
  }

  function rearrange(next: number[]) {
    slide(order.map((slot, place) => [rackKey(place), rackKey(next.indexOf(slot))]));
    setOrder(next);
    onShuffle(next);
  }

  function shuffleRack() {
    rearrange(shuffle(order, Math.random));
  }

  const drag = useDrag({
    canLift: id => {
      if (blankSquare) return false;
      const slot = numberAfter('rack-', id);
      if (slot !== null) return !isPlaced(slot);
      const square = squareOf(id);
      return isMyTurn && square !== null && pendingAt(square) !== undefined;
    },
    canDrop: (id, target) => {
      const square = squareOf(target);
      if (id.startsWith('rack-')) return square ? isMyTurn && !exchanging && isOpen(square) : target.startsWith('place-');
      return square ? isOpen(square) : target === 'rack' || target.startsWith('place-');
    },
    onLift: id => {
      const slot = numberAfter('rack-', id);
      if (slot === null || !isMyTurn || exchanging) return;
      liftSelected.current = true;
      setSelected(slot);
      setBlankSquare(null);
    },
    onDrop: (id, target) => {
      const slot = numberAfter('rack-', id);
      const to = squareOf(target);
      const placeTo = numberAfter('place-', target);
      const lifted = liftSelected.current;
      liftSelected.current = false;
      if (slot !== null) {
        if (to) placeSlot(slot, to.row, to.col);
        else if (placeTo !== null) {
          rearrange(moveInOrder(order, slot, placeTo));
          if (lifted) setSelected(null);
        }
        return;
      }
      const from = squareOf(id)!;
      if (to) {
        slide([[squareKey(from.row, from.col), squareKey(to.row, to.col)]]);
        setPending(movePending(pending, from, to));
      } else clickSquare(from.row, from.col); // back to its slot on the rack
    },
    onCancel: () => {
      if (liftSelected.current) setSelected(null);
      liftSelected.current = false;
    }
  });

  function play() {
    gameService.makeMove({ type: 'play', tiles: pending.map(({ row, col, letter, blank }) => ({ row, col, letter, blank })) });
  }

  function exchange() {
    if (!exchanging) return;
    gameService.makeMove({ type: 'exchange', letters: exchanging.map(slot => rack[slot]) });
  }

  let hint: string | null = null;
  if (exchanging) hint = 'Select the tiles to put back in the bag';
  else if (blankSquare) hint = 'Pick the letter for your blank';
  else if (preview && 'error' in preview) hint = preview.error;
  else if (preview) {
    // One word needs no breakdown; several words, or a bingo, list what each part adds
    const { words, bingo, points } = preview.state;
    const parts = words.length === 1 && !bingo
      ? words[0].word
      : [...words.map(word => `${word.word} ${word.points}`), ...(bingo ? ['bingo 50'] : [])].join(', ');
    hint = `${parts}: ${points} points`;
  } else if (isMyTurn) hint = selected === null ? 'Your turn: click a tile on your rack' : 'Now click an empty square';

  return (
    <div className={isMyTurn ? 'play-area' : 'play-area play-area-waiting'} ref={rootRef}>
      <Board
        board={board}
        pending={pending}
        highlighted={lastMove?.type === 'play' ? lastMove.tiles : []}
        onSquare={isMyTurn && !exchanging ? clickSquare : undefined}
        sourceProps={(row, col) => drag.source(`pending-${row}-${col}`)}
      />
      <div className="rack" aria-label="Your rack" data-drop="rack">
        {order.map((slot, place) => {
          const classes = ['rack-slot'];
          if (selected === slot || exchanging?.includes(slot)) classes.push('rack-slot-selected');
          if (isPlaced(slot)) classes.push('rack-slot-placed');
          return (
            <div key={slot} className="rack-cell" data-drop={`place-${place}`} {...drag.source(`rack-${slot}`)}>
              <button
                type="button"
                className={classes.join(' ')}
                disabled={!isMyTurn || (isPlaced(slot) && !exchanging)}
                onClick={() => clickSlot(slot)}
              >
                <Tile letter={rack[slot]} animKey={rackKey(place)} />
              </button>
            </div>
          );
        })}
      </div>
      {blankSquare && selected !== null && (
        <div className="blank-picker" role="group" aria-label="Letter for the blank">
          {LETTERS.map(letter => (
            <button key={letter} type="button" onClick={() => place({ ...blankSquare, letter, blank: true, slot: selected })}>
              {letter}
            </button>
          ))}
          <button type="button" className="blank-cancel" onClick={() => setBlankSquare(null)}>Cancel</button>
        </div>
      )}
      <div className={preview && 'error' in preview ? 'hint hint-error' : 'hint'}>{hint}</div>
      <div className="turn-buttons">
        <button type="button" onClick={shuffleRack}>Shuffle</button>
        {exchanging ? (
          <>
            <button type="button" onClick={exchange} disabled={exchanging.length === 0}>
              Exchange {exchanging.length}
            </button>
            <button type="button" onClick={() => setExchanging(null)}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" onClick={recall} disabled={pending.length === 0}>Recall</button>
            <button
              type="button"
              className="play-button"
              onClick={play}
              disabled={!isMyTurn || !preview || 'error' in preview}
            >
              {preview && 'state' in preview ? `Play (${preview.state.points})` : 'Play'}
            </button>
            <button
              type="button"
              onClick={startExchange}
              disabled={!canExchange}
              title={bagCount < RACK_SIZE ? 'The bag needs at least 7 tiles' : undefined}
            >
              Exchange
            </button>
            <button type="button" onClick={() => gameService.makeMove({ type: 'pass' })} disabled={!isMyTurn}>Pass</button>
          </>
        )}
      </div>
    </div>
  );
}
