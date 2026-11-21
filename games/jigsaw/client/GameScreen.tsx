import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { agreementPending, houseRule, houseRulesOf } from '../../../shared/houseRules.ts';
import { MODE_RULE, modeOf, playsAtOnce } from '../../../shared/puzzleModes.ts';
import { jigsawInfo } from '../info.ts';
import { ROTATION_RULE } from '../options.ts';
import PicturePicker from './PicturePicker';
import SidePanel from './SidePanel';
import Table from './Table';
import { pictureUrl } from './pictureUrl.ts';
import { lostHold, samePiece, usePieceDrag, type Dragging } from './usePieceDrag.ts';
import { keepCentre } from '../../../shared/zoom.ts';
import { gridStep } from '../../../src/drag/gridStep.ts';
import { gridOf, homeOf } from '../cut.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Board, Piece, PublicGameState } from '../types.ts';

const ZOOMS = [1, 2, 3];
const NO_PIECES: Board = { pieces: [] };
const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

type Point = { x: number; y: number };
// A piece picked up by keyboard, apart from the pointer drag: where it lay, and the spot its arrow keys are on
type KeyHold = { piece: number; from: Point; spot: number };

// Focuses a piece or spot and scrolls it into view in the zoomed table
function show(element: SVGElement | null | undefined) {
  element?.focus({ preventScroll: true });
  element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { activePlayers, playerNames, isGameOver, started, undoVote, undoAvailable, picture, seed, count, snaps } = gameState;
  const mode = modeOf(gameState, MODE_RULE);
  const board = (mode === 'race' ? gameState.boards[playerNumber] : gameState.board) ?? NO_PIECES;
  const host = houseRulesOf(jigsawInfo, gameState).host;
  const isHost = host === playerNumber;
  const rotation = houseRule(gameState, ROTATION_RULE);
  const playing = activePlayers.includes(playerNumber) && !isGameOver && !undoVote;
  // Until everyone agrees to the house rules the server refuses a pick-up, so nothing can be lifted
  const canPlay = playing && !(!started && agreementPending(jigsawInfo, gameState));
  const [guide, setGuide] = useState(false);
  const [zoom, setZoom] = useState(1);
  const scrollBox = useRef<HTMLDivElement>(null);
  const shownZoom = useRef(zoom);
  // After a zoom, scroll so the point that was in the middle of the box still is
  useLayoutEffect(() => {
    const box = scrollBox.current;
    const from = shownZoom.current;
    shownZoom.current = zoom;
    if (!box || from === zoom) return;
    box.scrollLeft = keepCentre(box.scrollLeft, box.clientWidth, from, zoom);
    box.scrollTop = keepCentre(box.scrollTop, box.clientHeight, from, zoom);
  }, [zoom]);
  // A dropped piece stays where it was let go until the state answers for it, so it never flicks back to where it was lifted
  // The first lift starts play, which ends the lobby; its panel stays until that drag ends, so the table does not jump under the pointer
  const [liftedInLobby, setLiftedInLobby] = useState(false);
  const [landing, setLanding] = useState<(Dragging & { from: Piece }) | null>(null);
  // The piece this player last pressed: it shows the turn handle. Kept in this browser only
  const [touched, setTouched] = useState<number | null>(null);
  // Whether the current drag was started by a mouse: only then does a right-click turn the piece
  const liftedByMouse = useRef(false);
  const [hold, setHold] = useState<KeyHold | null>(null);
  const [pieceFocus, setPieceFocus] = useState<number | null>(null);
  // A piece to hand focus to once the table has rendered (else the first liftable one)
  const [refocus, setRefocus] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  // A keyboard drop waiting for the state to say where the piece ended up
  const [pending, setPending] = useState<{ piece: number; spot: number; from: Piece } | null>(null);
  // A refused drop (or any refusal) lets go of the dropped piece, so no ghost stays where it was let go
  useEffect(() => { if (error) { setLanding(null); setPending(null); } }, [error]);

  const canLift = (index: number) => {
    const piece = board.pieces[index];
    return canPlay && !!piece && !piece.placed && (piece.heldBy === null || piece.heldBy === playerNumber);
  };
  // The keyboard hold ends from outside, with no drop: the piece was taken or placed, play stopped, or a new error came
  const holdLost = hold !== null && (lostHold(board.pieces[hold.piece], playerNumber) || !canPlay || gameState.paused === true);
  const keyHold = holdLost ? null : hold;
  const grid = gridOf(count);
  const liftables = board.pieces.map((_, index) => index).filter(canLift);
  // The hold never moved the piece on the server, so no landing is needed (one would outlive the answer, see samePiece)
  const putBack = ({ piece, from }: KeyHold) => {
    setHold(null);
    gameService.sendAction({ type: 'drop', piece, ...from });
  };
  const { dragging, bind, cancel } = usePieceDrag({
    canLift,
    positionOf: index => board.pieces[index],
    onLift: (piece, pointerType) => {
      if (keyHold) putBack(keyHold);
      liftedByMouse.current = pointerType === 'mouse';
      setLanding(null);
      setTouched(piece);
      setLiftedInLobby(!started);
      gameService.sendAction({ type: 'pickUp', piece });
    },
    onDrop: (piece, x, y) => {
      setLanding({ piece, x, y, from: board.pieces[piece] });
      gameService.sendAction({ type: 'drop', piece, x, y });
    }
  });

  // Someone else's pick-up won, or the piece was placed: let go here too, and send no drop for it
  const draggedPiece = dragging === null ? undefined : board.pieces[dragging.piece];
  const lost = dragging !== null && lostHold(draggedPiece, playerNumber);
  useEffect(() => { if (lost) cancel(); }, [lost, cancel]);
  // Someone else took the piece this player touched: the handle is theirs now
  const touchedHolder = touched === null ? null : board.pieces[touched]?.heldBy ?? null;
  useEffect(() => { if (touchedHolder !== null && touchedHolder !== playerNumber) setTouched(null); }, [touchedHolder, playerNumber]);

  // An error still set from before must not undo a fresh pick-up
  const seenError = useRef(error);
  useEffect(() => {
    const fresh = error !== seenError.current;
    seenError.current = error;
    if (hold !== null && (holdLost || (error && fresh))) { setHold(null); setRefocus(hold.piece); }
  }, [hold, holdLost, error]);
  useEffect(() => { if (keyHold) show(scrollBox.current?.querySelector<SVGElement>(`[data-spot="${keyHold.spot}"]`)); }, [keyHold]);
  useEffect(() => {
    if (refocus === null) return;
    const table = scrollBox.current;
    show(table?.querySelector<SVGElement>(`[data-piece="${refocus}"][tabindex]`) ?? table?.querySelector<SVGElement>('[data-piece][tabindex="0"]'));
    setPieceFocus(refocus);
    setRefocus(null);
  }, [refocus]);
  // A keyboard drop is announced once the state shows the piece placed, or loose and let go
  useEffect(() => {
    const now = pending && board.pieces[pending.piece];
    // The hold counts too: a drop where the piece already lay changes only that
    const answered = now && (!samePiece(now, pending.from) || now.heldBy !== pending.from.heldBy);
    if (!pending || !now || !answered || (!now.placed && now.heldBy !== null)) return;
    setAnnounce(now.placed
      ? `Piece ${pending.piece + 1} placed`
      : `Piece ${pending.piece + 1} left loose at row ${Math.floor(pending.spot / grid.cols) + 1}, column ${(pending.spot % grid.cols) + 1}`);
    setPending(null);
  }, [pending, board, grid.cols]);

  const pickUp = (piece: number) => {
    if (keyHold) putBack(keyHold);
    const at = board.pieces[piece];
    const homes = Array.from({ length: grid.cols * grid.rows }, (_, spot) => homeOf(grid, spot));
    const distance = (spot: number) => Math.hypot(homes[spot].x - at.x, homes[spot].y - at.y);
    liftedByMouse.current = false;
    setLanding(null);
    setTouched(piece);
    setLiftedInLobby(!started);
    setPieceFocus(piece);
    setHold({ piece, from: { x: at.x, y: at.y }, spot: homes.reduce((best, _, spot) => distance(spot) < distance(best) ? spot : best, 0) });
    setAnnounce(`Piece ${piece + 1} picked up. Choose a spot${rotation ? ', R turns it' : ''}, Escape puts it back`);
    gameService.sendAction({ type: 'pickUp', piece });
  };
  // Escape on a piece or a spot puts the held piece back where it lay
  const escaped = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Escape' || !keyHold) return false;
    putBack(keyHold);
    setAnnounce('Piece put back');
    setRefocus(keyHold.piece);
    return true;
  };
  const onPieceKey = (piece: number, event: ReactKeyboardEvent) => {
    if (escaped(event)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (canLift(piece)) pickUp(piece);
      return;
    }
    const step = STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const to = step < 0 ? liftables.filter(index => index < piece).pop() : liftables.find(index => index > piece);
    if (to !== undefined) setRefocus(to);
  };
  // Pieces are memoized, so they all get one handler that never changes and calls the latest one
  const pieceKey = useRef(onPieceKey);
  useEffect(() => { pieceKey.current = onPieceKey; });
  const stablePieceKey = useCallback((piece: number, event: ReactKeyboardEvent) => pieceKey.current(piece, event), []);
  const onSpotKey = (spot: number, event: ReactKeyboardEvent) => {
    if (!keyHold || escaped(event)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const { piece } = keyHold;
      const home = homeOf(grid, spot);
      setHold(null);
      const at = board.pieces[piece];
      // Where the piece already lies there is nothing to hold in place, and samePiece would keep the landing forever
      if (at.x !== home.x || at.y !== home.y) setLanding({ piece, ...home, from: at });
      setPending({ piece, spot, from: board.pieces[piece] });
      gameService.sendAction({ type: 'drop', piece, ...home });
      const others = liftables.filter(index => index !== piece);
      setRefocus(others.find(index => index > piece) ?? others[0] ?? null);
      return;
    }
    const to = gridStep(spot, event.key, grid.cols, grid.cols * grid.rows);
    if (to === null) return;
    event.preventDefault();
    setHold({ ...keyHold, spot: to });
  };

  const landed = landing !== null && samePiece(board.pieces[landing.piece], landing.from) ? landing : null;
  const held = keyHold && { piece: keyHold.piece, ...homeOf(grid, keyHold.spot) };
  const shown = lost ? null : dragging ?? held ?? landed;
  // While a piece is held, R or a right-click turns it
  const heldPiece = rotation ? dragging?.piece ?? keyHold?.piece ?? null : null;
  useEffect(() => {
    if (heldPiece === null) return;
    const turn = () => gameService.sendAction({ type: 'turn', piece: heldPiece });
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'r' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.target as Element | null)?.closest?.('input, textarea, select')) return;
      turn();
    }
    // A long press of a finger fires contextmenu too: only a drag started by a mouse turns on it
    function onMenu(event: MouseEvent) {
      event.preventDefault();
      if (liftedByMouse.current) turn();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('contextmenu', onMenu);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('contextmenu', onMenu);
    };
  }, [heldPiece]);
  const turnHandle = rotation && touched !== null && canLift(touched)
    ? { piece: touched, onTurn: () => gameService.sendAction({ type: 'turn', piece: touched }) }
    : undefined;

  const lobbyPanel = !started || ((dragging !== null || hold !== null) && liftedInLobby);
  const placed = board.pieces.filter(piece => piece.placed).length;
  const undo = playsAtOnce(mode)
    ? { label: 'Undo my last move', disabled: !playing || (snaps[playerNumber]?.length ?? 0) === 0, onClick: () => gameService.undoOwn() }
    : { label: 'Undo', disabled: !playing || !undoAvailable, onClick: () => gameService.requestUndo() };

  return (
    <div className="jigsaw-layout">
      <SidePanel
        gameState={gameState}
        mode={mode}
        pictureUrl={pictureUrl(picture)}
        placed={placed}
        total={board.pieces.length}
        guide={guide}
        onGuide={setGuide}
        undo={undo}
        error={error}
      >
        {lobbyPanel && (isHost
          ? <PicturePicker gameId={gameState.gameId} picture={picture} locked={started} onPick={choice => gameService.sendAction({ type: 'setPicture', picture: choice })} />
          : host !== null && <p className="jigsaw-note">{playerNames[host]} picks the picture</p>)}
      </SidePanel>
      <div className="jigsaw-main">
        <div className="jigsaw-zoom" role="group" aria-label="Zoom">
          <button type="button" onClick={() => setZoom(z => ZOOMS[Math.min(ZOOMS.indexOf(z) + 1, ZOOMS.length - 1)])} disabled={zoom === ZOOMS[ZOOMS.length - 1]}>Zoom in</button>
          <button type="button" onClick={() => setZoom(z => ZOOMS[Math.max(ZOOMS.indexOf(z) - 1, 0)])} disabled={zoom === ZOOMS[0]}>Zoom out</button>
        </div>
        <div className="jigsaw-scroll" ref={scrollBox}>
          <div className="jigsaw-zoomed" style={{ width: `${zoom * 100}%` }}>
            <Table
              picture={picture}
              count={count}
              seed={seed}
              board={board}
              viewer={playerNumber}
              playerNames={playerNames}
              guide={guide}
              drag={{ dragging: shown, canLift, bind }}
              turnHandle={turnHandle}
              keys={{
                pieceFocus: pieceFocus !== null && canLift(pieceFocus) ? pieceFocus : liftables[0] ?? null,
                onPieceKey: stablePieceKey,
                spots: keyHold ? { focused: keyHold.spot, onSpotKey } : undefined
              }}
            />
          </div>
        </div>
        <div className="visually-hidden" aria-live="polite">{announce}</div>
        <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={approve => gameService.voteUndo(approve)} />
      </div>
    </div>
  );
}
