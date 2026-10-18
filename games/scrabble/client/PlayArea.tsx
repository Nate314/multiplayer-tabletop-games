import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import Board from './Board';
import Tile from './Tile';
import { rackKey, squareKey } from './animateMove.ts';
import { useSlides } from './useSlides.ts';
import { BLANK, LETTERS, RACK_SIZE, evaluatePlacement } from '../rules.ts';
import type { Placement, PublicGameState } from '../types.ts';

type PlayAreaProps = {
  gameState: PublicGameState;
  isMyTurn: boolean;
  initialOrder: number[]; // the rack slot shown at each place
  onShuffle: (order: number[]) => void;
};

// A tile put on the board this turn, and the rack slot it came from
type PendingTile = Placement & { slot: number };

type Square = { row: number; col: number };

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// The board, the player's rack and the turn's buttons. The game screen remounts it after every move,
// so placed tiles and selections never outlive the rack they were made from.
// Tiles glide between the rack and the board as they are placed and taken back, and to their new places on a shuffle.
export default function PlayArea({ gameState, isMyTurn, initialOrder, onShuffle }: PlayAreaProps) {
  const { board, rack, bagCount, lastMove } = gameState;
  const rootRef = useRef<HTMLDivElement>(null);
  const slide = useSlides(rootRef);
  const [order, setOrder] = useState(initialOrder);
  const [pending, setPending] = useState<PendingTile[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [blankSquare, setBlankSquare] = useState<Square | null>(null);
  const [exchanging, setExchanging] = useState<number[] | null>(null);

  const isPlaced = (slot: number) => pending.some(tile => tile.slot === slot);
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

  function clickSquare(row: number, col: number) {
    const taken = pending.find(tile => tile.row === row && tile.col === col);
    if (taken) {
      slide([[squareKey(row, col), rackKeyOf(taken.slot)]]);
      setPending(pending.filter(tile => tile !== taken));
      return;
    }
    if (selected === null || exchanging) return;
    if (rack[selected] === BLANK) setBlankSquare({ row, col });
    else place({ row, col, letter: rack[selected], slot: selected });
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

  function shuffle() {
    const next = shuffled(order);
    slide(order.map((slot, place) => [rackKey(place), rackKey(next.indexOf(slot))]));
    setOrder(next);
    onShuffle(next);
  }

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
      />
      <div className="rack" aria-label="Your rack">
        {order.map((slot, place) => {
          const classes = ['rack-slot'];
          if (selected === slot || exchanging?.includes(slot)) classes.push('rack-slot-selected');
          if (isPlaced(slot)) classes.push('rack-slot-placed');
          return (
            <button
              key={slot}
              type="button"
              className={classes.join(' ')}
              disabled={!isMyTurn || (isPlaced(slot) && !exchanging)}
              onClick={() => clickSlot(slot)}
            >
              <Tile letter={rack[slot]} animKey={rackKey(place)} />
            </button>
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
        <button type="button" onClick={shuffle}>Shuffle</button>
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
