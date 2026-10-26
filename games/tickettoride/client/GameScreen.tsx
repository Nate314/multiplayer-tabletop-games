import { useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import useNewlyDrawn from '../../../src/hooks/useNewlyDrawn.ts';
import { drawnStep } from './drawn.ts';
import HandPanel from './HandPanel';
import MapBoard from './MapBoard';
import Market from './Market';
import PlayerList, { FinalScores } from './PlayerList';
import TurnPanel from './TurnPanel';
import { TICKETS } from '../map.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, PublicGameState, Seat } from '../types.ts';

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver, phase, lastTurns } = state;
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  const name = currentPlayer === null ? '' : playerNames[currentPlayer];
  const mine = currentPlayer === playerNumber;
  if (phase === 'setup') {
    const choosing = mine ? 'Your turn to choose your first tickets' : `${name} is choosing their first tickets`;
    return started ? choosing : `${choosing}. Joining closes after the first move.`;
  }
  const whose = mine ? 'Your turn' : `${name}'s turn`;
  return lastTurns ? `Last round: ${whose}` : whose;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [hoveredTicket, setHoveredTicket] = useState<number | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, players, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, moveCount, phase, drawing } = gameState;
  const me = players[playerNumber];
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const freeTurn = isMyTurn && phase === 'play' && !me?.offered;
  const canStartAction = freeTurn && drawing !== playerNumber;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  useMoveAnimation(screenRef, gameState, animateMove);
  const newlyDrawn = useNewlyDrawn(gameState, (previous, next) => drawnStep(previous, next, playerNumber));

  useEffect(() => {
    // Nothing stays picked after any move, an undo or a rejoin
    setSelectedRoute(null);
  }, [moveCount, currentPlayer]);

  function send(move: Move) {
    gameService.makeMove(move);
    setSelectedRoute(null);
  }

  const ticket = hoveredTicket === null ? null : TICKETS[hoveredTicket];
  return (
    <>
      <div className="game-id hand-only-hide">Game ID: {gameState.gameId}</div>
      <div className="ttr-layout" ref={screenRef}>
        <div className="map-area">
          <MapBoard
            gameState={gameState}
            selected={selectedRoute}
            highlight={gameState.lastMove?.type === 'claim' ? gameState.lastMove.route : null}
            cities={ticket ? [ticket.a, ticket.b] : []}
            onRoute={canStartAction ? route => setSelectedRoute(current => (current === route ? null : route)) : undefined}
          />
          <FinalScores gameState={gameState} />
        </div>
        <aside className="side-panel">
          <div className={error ? 'game-status game-status-error' : 'game-status'} role="status">{error || gameStatus}</div>
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          {me && !isGameOver && (
            <TurnPanel gameState={gameState} seat={playerNumber} isMyTurn={isMyTurn} selectedRoute={selectedRoute}
              onMove={send} onClear={() => setSelectedRoute(null)} onTicket={setHoveredTicket} />
          )}
          <Market
            gameState={gameState}
            canDraw={freeTurn}
            second={drawing === playerNumber}
            canTickets={canStartAction}
            onDraw={source => send({ type: 'drawCard', source })}
            onTickets={() => send({ type: 'drawTickets' })}
          />
          <button type="button" className="undo-button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          {me && <HandPanel gameState={gameState} seat={playerNumber} player={me} title="Your hand" drawn={newlyDrawn} onTicket={setHoveredTicket} />}
          <PlayerList gameState={gameState} viewer={playerNumber} />
        </aside>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={approve => gameService.voteUndo(approve)} />
    </>
  );
}
