import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import Board from './Board';
import GameStatus from './GameStatus';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import { livePath, pathFor, pickHole } from './selection.ts';
import type { Picked } from './selection.ts';
import { parseHole } from '../board.ts';
import { isStep, nextLandings } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Hole, PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [picked, setPicked] = useState<Picked>({ moveCount: -1, path: [] });
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const { holes, currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, moveCount } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  const path = isMyTurn ? livePath(gameState, playerNumber, pathFor(picked, moveCount)) : [];
  const movable = isMyTurn
    ? Object.entries(holes)
      .filter(([, seat]) => seat === playerNumber)
      .map(([key]) => parseHole(key))
      .filter(hole => nextLandings(gameState, [hole]).length > 0)
    : [];
  const targets = path.length > 0 ? nextLandings(gameState, path) : [];
  // A chain of at least one hop that could go on further; one with nowhere left to go is sent by itself
  const canEndMove = path.length > 1 && !isStep(path) && targets.length > 0;

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardAreaRef, gameState, animateMove);

  function send(full: Hole[]) {
    gameService.makeMove({ type: 'move', path: full });
    setPicked({ moveCount, path: [] });
  }

  // Click a marble, then each landing hole
  function handleHoleClick(hole: Hole) {
    if (!isMyTurn) return;
    const next = pickHole(gameState, playerNumber, path, hole);
    if (next.send) send(next.path);
    else setPicked({ moveCount, path: next.path });
  }

  function hint(): string {
    if (path.length > 1) return 'Click a marked hole to hop again, or End move to stop here';
    if (path.length === 1) return 'Click a marked hole to move there';
    return 'Click one of your glowing marbles';
  }

  return (
    <div className="game-layout">
      <div className="board-area" ref={boardAreaRef}>
        <Board
          gameState={gameState}
          viewer={playerNumber}
          dimmed={!isMyTurn}
          path={path}
          movable={movable}
          targets={targets}
          onHoleClick={handleHoleClick}
        />
        <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
      </div>
      <div className="side-panel">
        <GameStatus gameState={gameState} playerNumber={playerNumber} isMyTurn={isMyTurn} error={error} />
        {isMyTurn && <div className="hint">{hint()}</div>}
        <div className="panel-buttons">
          {canEndMove && (
            <button type="button" className="end-move" onClick={() => send(path)}>
              End move
            </button>
          )}
          <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
            Undo
          </button>
        </div>
      </div>
    </div>
  );
}
