import { useMemo, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import PieceTray from '../../../src/components/PieceTray';
import { useDrag } from '../../../src/drag/useDrag.ts';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import { meeplesOnBoard, placementOptions, tileFeatures } from '../board.ts';
import { meepleError } from '../rules.ts';
import { MEEPLES_PER_PLAYER } from '../tiles.ts';
import Board from './Board';
import { MeepleIcon } from './Meeple';
import { cellTarget, spotTarget } from './keys.ts';
import PlayerList from './PlayerList';
import TurnPanel from './TurnPanel';
import animateMove from './animateMove.ts';
import type { Cell } from './Board';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { FeatureRef, PublicGameState, Seat } from '../types.ts';

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { isGameOver, winners, playerNames, activePlayers, started, currentPlayer } = state;
  if (isGameOver) return winners.length > 0 ? `Game over: ${winners.map(seat => playerNames[seat]).join(' and ')} ${winners.length > 1 ? 'share the win' : 'wins'}` : 'Game over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  if (currentPlayer === null) return '';
  const name = currentPlayer === playerNumber ? 'You' : playerNames[currentPlayer];
  if (!started) return `${name} ${currentPlayer === playerNumber ? 'go' : 'goes'} first. Joining closes after the first move.`;
  return currentPlayer === playerNumber ? 'Your turn' : `${name}'s turn`;
}

// What the player has picked so far this step; it belongs to one move count, so a new state starts it afresh
type Choice = { move: number; cell: Cell | null; rotation: number; meeple: FeatureRef | null };

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { board, currentTile, currentPlayer, placed, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, moveCount } = gameState;
  const noVote = !undoVote && !dismissVote;
  const canMove = activePlayers.length >= 2 && !isGameOver && noVote && currentPlayer === playerNumber;
  const canUndo = undoAvailable && noVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const boardRef = useRef<HTMLDivElement>(null);
  useMoveAnimation(boardRef, gameState, animateMove);

  const [stored, setChoice] = useState<Choice>({ move: moveCount, cell: null, rotation: 0, meeple: null });
  const choice = stored.move === moveCount ? stored : { move: moveCount, cell: null, rotation: 0, meeple: null };
  const update = (change: Partial<Choice>) => setChoice({ ...choice, ...change });

  const options = useMemo(
    () => (canMove && !placed && currentTile ? placementOptions(board, currentTile) : []),
    [canMove, placed, currentTile, board]
  );
  const chosen = options.find(option => option.x === choice.cell?.x && option.y === choice.cell?.y) ?? null;
  const meeplesLeft = MEEPLES_PER_PLAYER - meeplesOnBoard(board, playerNumber);
  const freeSpots = canMove && placed
    ? tileFeatures(board[board.length - 1].tile).filter(feature => meepleError(gameState, playerNumber, feature) === null)
    : [];

  const rotate = (step: 1 | -1) => {
    if (!chosen) return update({ rotation: (choice.rotation + step + 4) % 4 });
    const at = chosen.rotations.indexOf(choice.rotation);
    const next = chosen.rotations[(Math.max(at, 0) + step + chosen.rotations.length) % chosen.rotations.length];
    update({ rotation: next });
  };

  const pickCell = (cell: Cell) => {
    const option = options.find(candidate => candidate.x === cell.x && candidate.y === cell.y);
    if (!option) return;
    update({ cell, rotation: option.rotations.includes(choice.rotation) ? choice.rotation : option.rotations[0] });
  };

  const pickMeeple = (feature: FeatureRef) => {
    const same = choice.meeple?.kind === feature.kind && choice.meeple.index === feature.index;
    update({ meeple: same ? null : feature });
  };

  // The tile drops on a highlighted square and the meeple on a circle; a drop only chooses, Place tile and Place meeple still send the move
  const optionAt = (target: string) => options.find(option => cellTarget(option) === target);
  const spotAt = (target: string) => freeSpots.find(feature => spotTarget(feature) === target);
  const drag = useDrag({
    canLift: id => id === 'tile' ? canMove && !placed : canMove && placed && meeplesLeft > 0 && freeSpots.length > 0,
    canDrop: (id, target) => id === 'tile' ? !!optionAt(target) : !!spotAt(target),
    onDrop: (id, target) => {
      const option = optionAt(target), feature = spotAt(target);
      if (id === 'tile' && option) pickCell(option);
      else if (id === 'meeple' && feature) update({ meeple: feature });
    }
  });

  let meepleBlocked: string | undefined;
  if (meeplesLeft === 0) meepleBlocked = 'All your meeples are on the board';
  else if (freeSpots.length === 0) meepleBlocked = 'No free feature on this tile for a meeple';
  const meepleTray = (
    <PieceTray
      label="Your meeple"
      pieces={[{ id: 'meeple', label: 'Meeple', icon: <MeepleIcon seat={playerNumber} />, count: meeplesLeft, blocked: meepleBlocked }]}
      selected={null}
      onTap={() => {}} // the circles are already lit; tapping one chooses it
      drag={drag}
    />
  );

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="cc-layout">
        <div className="cc-board-area" ref={boardRef}>
          <Board
            board={board}
            highlight={board.length > 1 ? board.length - 1 : null} // the start tile alone was placed by nobody
            cells={options}
            preview={chosen && currentTile ? { x: chosen.x, y: chosen.y, tile: currentTile, rotation: choice.rotation } : null}
            onCell={pickCell}
            meepleSeat={canMove && placed ? playerNumber : undefined}
            meepleChoices={freeSpots.map(feature => ({
              feature,
              selected: choice.meeple?.kind === feature.kind && choice.meeple.index === feature.index
            }))}
            onMeeple={pickMeeple}
            focus={canMove && placed ? board[board.length - 1] : null}
          />
        </div>
        <div className="cc-side-panel">
          <div className={error ? 'cc-status cc-status-error' : 'cc-status'} role="status">{error || gameStatus}</div>
          <div className="cc-turn-message">{turnMessage(gameState, playerNumber)}</div>
          <TurnPanel
            gameState={gameState}
            canMove={canMove}
            rotation={choice.rotation}
            onRotate={rotate}
            cellChosen={chosen !== null}
            onPlace={() => chosen && gameService.makeMove({ type: 'place', x: chosen.x, y: chosen.y, rotation: choice.rotation })}
            meepleChosen={choice.meeple !== null}
            meepleSpots={freeSpots.length}
            meeplesLeft={meeplesLeft}
            onMeeple={place => gameService.makeMove({ type: 'meeple', feature: place ? choice.meeple : null })}
            tileDrag={drag.source('tile')}
            meepleTray={meepleTray}
          />
          <PlayerList gameState={gameState} viewer={playerNumber} />
          <button type="button" className="cc-undo" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
        </div>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
