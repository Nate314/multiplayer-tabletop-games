import { useCallback, useRef } from 'react';
import gameService from '../../../src/services/gameService';
import GameStatus from './GameStatus';
import PlayArea from './PlayArea';
import Scores from './Scores';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import { animateMove, identityOrder } from './animateMove.ts';
import { canEndGame } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, moveCount, rack } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const layoutRef = useRef<HTMLDivElement>(null);

  // A new move or a new rack starts the turn's placing afresh
  const rackId = `${moveCount}:${rack.join('')}`;
  // The last shuffle or rearrange, kept while the rack holds the same letters (so across other players' moves),
  // and so a move can slide each kept tile from the place it was shown at
  const orderRef = useRef<{ letters: string; order: number[] } | null>(null);
  const orderOf = useCallback((state: PublicGameState) => {
    const saved = orderRef.current;
    return saved?.letters === state.rack.join('') ? saved.order : identityOrder(state.rack);
  }, []);

  // Only the live board and rack animate; the history dialog renders without this hook
  const animate = useCallback(
    (change: MoveChange<PublicGameState>) => animateMove(change, playerNumber, orderOf(change.previous)),
    [playerNumber, orderOf]
  );
  useMoveAnimation(layoutRef, gameState, animate);

  return (
    <>
      <div className="game-layout" ref={layoutRef}>
        <div className="game-info side-panel">
          <div className="player-info">
            You are {playerNames[playerNumber]} (Player {playerNumber})
          </div>
          <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} />
          <Scores gameState={gameState} playerNumber={playerNumber} />
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
              Undo
            </button>
            {canEndGame(gameState) && activePlayers.includes(playerNumber) && (
              <button type="button" onClick={() => gameService.sendAction({ type: 'endGame' })} disabled={undoVote !== null}>
                End game
              </button>
            )}
          </div>
        </div>
        <PlayArea
          key={rackId}
          gameState={gameState}
          isMyTurn={isMyTurn}
          initialOrder={orderOf(gameState)}
          onShuffle={(order) => { orderRef.current = { letters: rack.join(''), order }; }}
        />
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
