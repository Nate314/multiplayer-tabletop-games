import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { houseRulesOf } from '../../../shared/houseRules.ts';
import { MODE_RULE, modeOf, playsAtOnce } from '../../../shared/puzzleModes.ts';
import { jigsawInfo } from '../info.ts';
import PicturePicker from './PicturePicker';
import SidePanel from './SidePanel';
import Table from './Table';
import { pictureUrl } from './pictureUrl.ts';
import { lostHold, samePiece, usePieceDrag, type Dragging } from './usePieceDrag.ts';
import { keepCentre } from './zoom.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Board, Piece, PublicGameState } from '../types.ts';

const ZOOMS = [1, 2, 3];
const NO_PIECES: Board = { pieces: [] };

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { activePlayers, playerNames, isGameOver, started, undoVote, undoAvailable, picture, seed, count, snaps } = gameState;
  const mode = modeOf(gameState, MODE_RULE);
  const board = (mode === 'race' ? gameState.boards[playerNumber] : gameState.board) ?? NO_PIECES;
  const host = houseRulesOf(jigsawInfo, gameState).host;
  const isHost = host === playerNumber;
  const playing = activePlayers.includes(playerNumber) && !isGameOver && !undoVote;
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
  const [landing, setLanding] = useState<(Dragging & { from: Piece }) | null>(null);

  const canLift = (index: number) => {
    const piece = board.pieces[index];
    return playing && !!piece && !piece.placed && (piece.heldBy === null || piece.heldBy === playerNumber);
  };
  const { dragging, bind, cancel } = usePieceDrag({
    canLift,
    positionOf: index => board.pieces[index],
    onLift: piece => {
      setLanding(null);
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

  const landed = landing !== null && samePiece(board.pieces[landing.piece], landing.from) ? landing : null;
  const shown = lost ? null : dragging ?? landed;
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
        {!started && (isHost
          ? <PicturePicker gameId={gameState.gameId} picture={picture} onPick={choice => gameService.sendAction({ type: 'setPicture', picture: choice })} />
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
            />
          </div>
        </div>
        <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={approve => gameService.voteUndo(approve)} />
      </div>
    </div>
  );
}
