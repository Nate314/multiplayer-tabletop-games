import { useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import PlayerPanel from './PlayerPanel';
import Table from './Table';
import TurnPanel from './TurnPanel';
import { toggleGem } from './selection.ts';
import { splendor } from '../index.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Selection } from './selection.ts';
import type { Move, PublicGameState, Seat } from '../types.ts';

const MAX_PLAYERS = splendor.info.maxPlayers;

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver, finalRound } = state;
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  const name = currentPlayer === null ? '' : playerNames[currentPlayer];
  if (!started) return `${name} goes first. Joining closes after the first move.`;
  const whose = currentPlayer === playerNumber ? 'Your turn' : `${name}'s turn`;
  return finalRound ? `Final round: ${whose}` : whose;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, players, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, pending, moveCount } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canPick = isMyTurn && pending === null;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  useMoveAnimation(screenRef, gameState, animateMove);

  useEffect(() => {
    // Nothing stays picked up after any move, an undo or a rejoin
    setSelection(null);
  }, [moveCount, currentPlayer]);

  function send(move: Move) {
    gameService.makeMove(move);
    setSelection(null);
  }

  // Seats in turn order starting with this player
  const stepsAfterMe = (seat: Seat) => (seat - playerNumber + MAX_PLAYERS) % MAX_PLAYERS;
  const seats = Object.keys(players).map(Number).sort((a, b) => stepsAfterMe(a) - stepsAfterMe(b));
  const hasSeat = seats.includes(playerNumber);

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="game-screen" ref={screenRef}>
        <div className="game-info">
          <div className="player-info">You are {gameState.playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          {isMyTurn && hasSeat && (
            <TurnPanel gameState={gameState} seat={playerNumber} selection={selection} onMove={send} onClear={() => setSelection(null)} />
          )}
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        <div className="play-area">
          <Table
            gameState={gameState}
            seat={hasSeat ? playerNumber : null}
            active={canPick}
            selection={selection}
            onGem={gem => setSelection(previous => toggleGem(previous, gem, gameState))}
            onCard={setSelection}
          />
          <div className="players">
            {seats.map(seat => (
              <PlayerPanel
                key={seat}
                gameState={gameState}
                seat={seat}
                isMe={seat === playerNumber}
                selection={seat === playerNumber ? selection : null}
                onReserved={seat === playerNumber && canPick ? index => setSelection({ kind: 'card', source: { kind: 'reserved', index } }) : undefined}
              />
            ))}
          </div>
        </div>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={approve => gameService.voteUndo(approve)} />
    </>
  );
}
