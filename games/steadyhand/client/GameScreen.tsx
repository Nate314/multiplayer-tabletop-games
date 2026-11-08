import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import YouTag from '../../../src/components/YouTag.tsx';
import { playSounds } from '../../../src/sound/synth.ts';
import { SIMULATION_TICK_MS } from '../../../shared/gameDefinition.ts';
import { agreementPending, houseRule } from '../../../shared/houseRules.ts';
import { pointsText } from '../../../shared/standings.ts';
import { PARTS, PART_RADIUS } from '../board.ts';
import { steadyhandInfo } from '../info.ts';
import { TOLERANCE, TOLERANCE_RULE } from '../options.ts';
import { buzzesLeft } from '../rules.ts';
import Bay, { type Held } from './Bay';
import { drawnPosition, partAt, shouldSend, stepDrag } from './liveDrag.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Part, Point, PublicGameState, Seat } from '../types.ts';

// Half of the 44 CSS px a finger needs, whatever the bay's scale
const HIT_RADIUS_PX = 22;

// The part in this browser's hand: `last` is the last checked point, `pending` the newest position not yet sent
type Hold = { part: Part; offset: Point; last: Point; sentAt: number; pending: Point | null; timer?: ReturnType<typeof setTimeout>; stop(): void };

function turnLine({ isGameOver, currentPlayer, playerNames }: PublicGameState, me: Seat): string {
  if (isGameOver || currentPlayer === null) return '';
  return currentPlayer === me ? 'Your turn: drag a part out along its slot without touching the walls' : `${playerNames[currentPlayer]}'s turn`;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { activePlayers, playerNames, currentPlayer, isGameOver, undoVote, dismissVote, undoAvailable, started, scores, live, gameStatus } = gameState;
  const myTurn = currentPlayer === playerNumber && !isGameOver;
  const canDrag = myTurn && !undoVote && !dismissVote && !(!started && agreementPending(steadyhandInfo, gameState));
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber);
  const factor = TOLERANCE[houseRule(gameState, TOLERANCE_RULE)];
  const [local, setLocal] = useState<Point | null>(null);
  const [shaking, setShaking] = useState(false);
  const hold = useRef<Hold | null>(null);
  // Pointer callbacks fire between renders, so they read the newest values
  const latest = useRef({ factor, canDrag, myTurn });
  useLayoutEffect(() => {
    latest.current = { factor, canDrag, myTurn };
  }, [factor, canDrag, myTurn]);

  // Ends this browser's drag; `drop` tells the server to let go, which a turn move does by itself
  const end = useCallback((drop: boolean) => {
    const held = hold.current;
    if (!held) return;
    clearTimeout(held.timer);
    held.stop();
    hold.current = null;
    setLocal(null);
    if (drop) gameService.sendAction({ type: 'drop' });
  }, []);

  // A vote, the turn passing or leaving the screen mid-drag lets go; only the turn's owner may send the drop
  useEffect(() => {
    if (!canDrag) end(myTurn);
  }, [canDrag, myTurn, end]);
  useEffect(() => () => end(latest.current.myTurn), [end]);

  const send = (held: Hold, at: Point) => {
    held.sentAt = performance.now();
    held.pending = null;
    // A timer left from the window just closed would send the next position too soon
    clearTimeout(held.timer);
    held.timer = undefined;
    gameService.sendAction({ type: 'drag', at });
  };

  const onMove = (held: Hold, board: Point) => {
    const target: Point = [board[0] - held.offset[0], board[1] - held.offset[1]];
    const { at, result } = stepDrag(held.part, held.last, target, latest.current.factor);
    if (result === 'buzz') {
      end(false);
      gameService.makeMove({ type: 'buzz', part: held.part.id, at });
      playSounds(['timer']);
      setShaking(true);
      return;
    }
    if (result === 'out') {
      end(false);
      gameService.makeMove({ type: 'out', part: held.part.id });
      return;
    }
    held.last = at;
    setLocal(at);
    const now = performance.now();
    if (shouldSend(held.sentAt, now)) {
      send(held, at);
    } else {
      held.pending = at;
      // The last skipped position goes out when the 50 ms window ends
      held.timer ??= setTimeout(() => {
        held.timer = undefined;
        if (hold.current === held && held.pending) send(held, held.pending);
      }, held.sentAt + SIMULATION_TICK_MS - now);
    }
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (hold.current || event.button !== 0 || !latest.current.canDrag) return;
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const toBoard = (e: { clientX: number; clientY: number }): Point => {
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform((svg.getScreenCTM() ?? matrix).inverse());
      return [p.x, p.y];
    };
    const pressed = toBoard(event);
    const inSlot = PARTS.filter(p => gameState.outBy[p.id] === undefined);
    // matrix.a is CSS px per board unit
    const part = partAt(inSlot, pressed, Math.max(PART_RADIUS, HIT_RADIUS_PX / matrix.a));
    if (!part) return;
    event.preventDefault();
    const { pointerId } = event;
    const rest = part.path[0];
    const moved = (e: PointerEvent) => {
      if (e.pointerId === pointerId && hold.current) onMove(hold.current, toBoard(e));
    };
    const ended = (e: PointerEvent) => {
      if (e.pointerId === pointerId) end(true);
    };
    // touch-action: none should keep a finger from scrolling; this backs it up where a browser ignores it on SVG
    const holdStill = (touch: TouchEvent) => touch.preventDefault();
    // Captured, so a mouse leaving the window still moves the part (and buzzes on the clamped edge); losing focus lets go
    const blurred = () => end(true);
    try {
      svg.setPointerCapture(pointerId);
    } catch {
      // A pointer that already ended cannot be captured; its pointerup still lets go
    }
    window.addEventListener('touchmove', holdStill, { passive: false });
    window.addEventListener('pointermove', moved);
    window.addEventListener('pointerup', ended);
    window.addEventListener('pointercancel', ended);
    window.addEventListener('blur', blurred);
    hold.current = {
      part, offset: [pressed[0] - rest[0], pressed[1] - rest[1]], last: rest, sentAt: performance.now(), pending: null,
      stop() {
        window.removeEventListener('touchmove', holdStill);
        window.removeEventListener('pointermove', moved);
        window.removeEventListener('pointerup', ended);
        window.removeEventListener('pointercancel', ended);
        window.removeEventListener('blur', blurred);
      }
    };
    setLocal(rest);
    gameService.sendAction({ type: 'pick', part: part.id });
  };

  const at = drawnPosition(live, playerNumber, local);
  const held: Held | null = live && at ? { part: live.part, at, watched: live.seat !== playerNumber } : null;

  return (
    <div className="sh-screen">
      {(error || gameStatus) && <div className={error ? 'game-status game-status-error' : 'game-status'} role="status">{error || gameStatus}</div>}
      <div className="sh-turn">{turnLine(gameState, playerNumber)}</div>
      <ul className="sh-seats" aria-label="Scores">
        {activePlayers.map(seat => {
          const left = buzzesLeft(gameState, seat);
          return (
            <li key={seat} className={seat === currentPlayer ? 'sh-seat sh-seat-turn' : 'sh-seat'}>
              <span className="sh-seat-name">{playerNames[seat]}<YouTag when={seat === playerNumber} /></span>
              <span>{pointsText(scores[seat] ?? 0)}</span>
              <span className="sh-seat-buzzes">{left === null ? '∞' : left} {left === 1 ? 'buzz' : 'buzzes'} left</span>
            </li>
          );
        })}
      </ul>
      <Bay gameState={gameState} factor={factor} held={held} interactive={canDrag} shaking={shaking}
        highlight={isGameOver ? null : gameState.lastMove?.part ?? null}
        onPointerDown={onPointerDown} onShaken={() => setShaking(false)} />
      {canDrag && <div className="sh-hint">Press a part and drag it to the round exit at the end of its slot</div>}
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
      <div className="sh-bar">
        <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
      </div>
    </div>
  );
}
