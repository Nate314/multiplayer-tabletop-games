import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import gameService from '../../../src/services/gameService';
import { formatClock, useCountdown } from '../../../src/hooks/useCountdown.ts';
import useAnnouncer from '../../../src/hooks/useAnnouncer.ts';
import { gridStep } from '../../../src/drag/gridStep.ts';
import { swallowNextClick } from '../../../src/drag/swallowClick.ts';
import { fits } from '../board.ts';
import { clock } from '../rules.ts';
import RaceBoard from './RaceBoard';
import ShapeArt from './ShapeArt';
import { shapeLabel } from '../shapes.ts';
import { Progress } from './HistoryBoard';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState, SeatBoard } from '../types.ts';

// A press that moves less than this is a tap, which turns the shape
const DRAG_PX = 6;
const NO_BOARD: SeatBoard = { placed: {}, turns: [] };

// Where the pop throws each unplaced shape: a fixed spread from its tray index
const scatter = (i: number) => ({ '--dx': `${((i * 37) % 11 - 5) * 8}px`, '--dy': `${((i * 23) % 7 - 3) * 8}px`, '--spin': `${i * 53}deg` }) as CSSProperties;

type Drag = { shape: number; pointerId: number; x0: number; y0: number; dx: number; dy: number; moved: boolean };

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { layout, boards, activePlayers, finishTimes, endsAt, serverTime, popped, isGameOver, raceStartedAt, gameStatus } = gameState;
  const board = boards[playerNumber] ?? NO_BOARD;
  const timeLeft = useCountdown(endsAt, serverTime);
  const myTime = finishTimes[playerNumber];
  const racing = raceStartedAt !== null && !isGameOver && myTime === undefined && activePlayers.includes(playerNumber);
  const [drag, setDrag] = useState<Drag | null>(null);
  // The handlers read the drag from a ref: a press and release that arrive before the next render would otherwise
  // see the state from before the press, never clear it, and leave every later drag blocked
  const dragRef = useRef<Drag | null>(null);
  const hold = (next: Drag | null) => { dragRef.current = next; setDrag(next); };
  // A fitting drop sits in its hole until the server's answer arrives; a refusal (the error) lets it go
  const [landed, setLanded] = useState<{ shape: number; hole: number } | null>(null);
  useEffect(() => { if (error) setLanded(null); }, [error]);
  // A new race (Rematch), the end, or a finish lets it go too: Screen is not remounted between races
  useEffect(() => { if (!racing) setLanded(null); }, [racing, raceStartedAt]);
  // The pop or a finish mid-drag lets go: a disabled button hears no release
  useEffect(() => { if (!racing) hold(null); }, [racing]);
  const boardRef = useRef<SVGSVGElement>(null);
  // A shape picked up by keyboard, apart from the pointer drag, and the hole its arrow keys are on
  const [kept, setKept] = useState<number | null>(null);
  const [target, setTarget] = useState(0);
  const [announce, setAnnounce] = useAnnouncer();
  // A tray shape to hand focus back to once the board has rendered without the hole targets
  const [refocus, setRefocus] = useState<number | null>(null);
  const paused = gameState.paused === true;
  // A new error lets go; one still set from before must not undo a fresh pick-up
  const seenError = useRef(error);
  useEffect(() => {
    const fresh = error !== seenError.current;
    seenError.current = error;
    if (kept !== null && (!racing || paused || (error && fresh))) { setKept(null); setRefocus(kept); }
  }, [kept, racing, paused, error]);
  useEffect(() => { if (kept !== null) boardRef.current?.querySelector<SVGElement>(`[data-hole="${target}"]`)?.focus(); }, [kept, target]);
  useEffect(() => {
    if (refocus === null) return;
    document.querySelectorAll<HTMLElement>('.sr-tray li')[refocus]?.querySelector('button')?.focus();
    setRefocus(null);
  }, [refocus]);
  useEffect(() => {
    if (kept === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'r' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.target as Element | null)?.closest?.('input, textarea, select')) return;
      gameService.sendAction({ type: 'turn', shape: kept });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kept]);
  // Says the new angle once the server has turned the held shape
  const keptTurns = kept === null ? 0 : board.turns[kept] ?? 0;
  const turnedFrom = useRef<{ shape: number | null; turns: number }>({ shape: null, turns: 0 });
  useEffect(() => {
    const was = turnedFrom.current;
    turnedFrom.current = { shape: kept, turns: keptTurns };
    if (layout && kept !== null && was.shape === kept && was.turns !== keptTurns) setAnnounce(`${shapeLabel(layout.tray[kept])}, turned ${keptTurns * 45} degrees`);
  }, [kept, keptTurns, layout, setAnnounce]);

  if (!layout) return <div className="sr-screen"><div className="game-status">{gameStatus || 'Waiting for players'}</div></div>;
  // Once the server shows the hole filled or the shape placed, the board itself answers for it
  const pending = landed && board.placed[landed.hole] === undefined && !Object.values(board.placed).includes(landed.shape);
  const placed = pending ? { ...board.placed, [landed.hole]: landed.shape } : board.placed;
  const inPlace = new Set(Object.values(placed));

  // The hole under a point on screen, or null off the board
  const holeAt = (x: number, y: number): number | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || x < rect.left || y < rect.top || x >= rect.right || y >= rect.bottom) return null;
    const n = Math.sqrt(layout.size);
    return Math.floor(((y - rect.top) / rect.height) * n) * n + Math.floor(((x - rect.left) / rect.width) * n);
  };

  const onPointerDown = (shape: number) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current || !racing || event.button !== 0) return;
    setKept(null);
    setLanded(null); // a drop the server never answered is not left in its hole
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that already ended cannot be captured; its pointerup still lets go
    }
    hold({ shape, pointerId: event.pointerId, x0: event.clientX, y0: event.clientY, dx: 0, dy: 0, moved: false });
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x0, dy = event.clientY - drag.y0;
    hold({ ...drag, dx, dy, moved: drag.moved || Math.hypot(dx, dy) > DRAG_PX });
  };
  // Release over the matching hole the right way up places it; anywhere else it springs back and nothing is sent
  const onPointerUp = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    hold(null);
    // Judged from the release point too: a fast drag can end before the render that saw it move
    if (!drag.moved && Math.hypot(event.clientX - drag.x0, event.clientY - drag.y0) <= DRAG_PX) return; // a tap: the click that follows turns it
    swallowNextClick();
    const hole = holeAt(event.clientX, event.clientY);
    if (hole === null || !fits(layout, placed, drag.shape, hole, board.turns[drag.shape])) return;
    setLanded({ shape: drag.shape, hole });
    gameService.sendAction({ type: 'place', shape: drag.shape, hole });
  };
  const pickUp = (shape: number) => {
    const first = layout.holes.findIndex((_, hole) => placed[hole] === undefined);
    // The same shape again sets no new state, so the focus effect would not run
    if (kept === shape) boardRef.current?.querySelector<SVGElement>(`[data-hole="${first}"]`)?.focus();
    setLanded(null);
    setKept(shape);
    setTarget(first);
    setAnnounce(`${shapeLabel(layout.tray[shape])} picked up. Choose a hole, R turns it, Escape puts it back`);
  };
  // Escape on a tray shape or a hole puts the held shape back
  const escaped = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Escape' || kept === null) return false;
    setKept(null);
    setRefocus(kept);
    setAnnounce('Piece put back');
    return true;
  };
  const onShapeKey = (shape: number) => (event: ReactKeyboardEvent) => {
    if (escaped(event) || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault(); // so the click that Enter fires never turns it
    pickUp(shape);
  };
  const dropOn = (hole: number) => {
    if (kept === null) return;
    if (!fits(layout, placed, kept, hole, board.turns[kept])) return setAnnounce('That shape does not fit there');
    setLanded({ shape: kept, hole });
    gameService.sendAction({ type: 'place', shape: kept, hole });
    setAnnounce(`${shapeLabel(layout.tray[kept])} placed`);
    setKept(null);
    const left = layout.tray.map((_, i) => i).filter(i => i !== kept && !inPlace.has(i));
    setRefocus(left.find(i => i > kept) ?? left[0] ?? null);
  };
  const onHoleKey = (hole: number, event: ReactKeyboardEvent) => {
    if (kept === null || escaped(event)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dropOn(hole);
    } else {
      const n = Math.sqrt(layout.size);
      const to = gridStep(hole, event.key, n, layout.size);
      if (to === null) return;
      event.preventDefault();
      // Over a filled hole, keep going the same way until an empty one or the edge
      let at = hole, next = to;
      while (next !== at && placed[next] !== undefined) { at = next; next = gridStep(at, event.key, n, layout.size)!; }
      if (next !== at) setTarget(next);
    }
  };
  const onPointerCancel = (event: ReactPointerEvent) => {
    if (dragRef.current?.pointerId === event.pointerId) hold(null);
  };

  return (
    <div className="sr-screen">
      {(error || gameStatus) && <div className={error ? 'game-status game-status-error' : 'game-status'} role="status">{error || gameStatus}</div>}
      <div className="sr-top">
        {timeLeft !== null && <div className="sr-timer" role="timer" aria-label="Time left">{formatClock(timeLeft)}</div>}
        {raceStartedAt === null && !isGameOver && <p className="sr-note">The clock starts once everyone agrees to the house rules</p>}
        {myTime !== undefined && <p className="sr-note">You filled the board in {clock(myTime)}</p>}
      </div>
      <Progress gameState={gameState} seats={activePlayers.filter(seat => seat !== playerNumber)} />
      <RaceBoard layout={layout} placed={placed} popped={popped && isGameOver} svgRef={boardRef} label="Your board" targets={kept === null ? undefined : { focused: target, onFocus: setTarget, onKey: onHoleKey, onClick: dropOn }} />
      <ul className={popped && isGameOver ? 'sr-tray sr-scatter' : 'sr-tray'} aria-label="Shapes">
        {layout.tray.map((id, shape) => {
          const turns = board.turns[shape] ?? 0;
          const held = drag?.shape === shape;
          return (
            <li key={shape} style={scatter(shape)}>
              {!inPlace.has(shape) && (
                <button
                  type="button"
                  className={held && drag.moved ? 'sr-shape sr-dragging' : kept === shape ? 'sr-shape sr-held' : 'sr-shape'}
                  aria-label={`${shapeLabel(id)}, turned ${turns * 45} degrees`}
                  disabled={!racing}
                  // A screen reader's click has detail 0; a keyboard Enter's click is stopped on keydown
                  onClick={event => event.detail > 0 ? gameService.sendAction({ type: 'turn', shape }) : pickUp(shape)}
                  onKeyDown={onShapeKey(shape)}
                  onPointerDown={onPointerDown(shape)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerCancel}
                >
                  <svg viewBox="0 0 100 100" style={held ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}>
                    <ShapeArt id={id} turns={turns} className="sr-piece" />
                  </svg>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {racing && <p className="sr-note">Tap a shape to turn it, then drag it into its hole. Enter picks a shape up, R turns it, then choose its hole</p>}
      <div className="visually-hidden" aria-live="polite">{announce}</div>
    </div>
  );
}
