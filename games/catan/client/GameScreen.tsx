import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import { EDGES, HEX_COUNT, VERTEX_COUNT } from '../board.ts';
import { cityError, roadSpots, settlementError, settlementSpotError } from '../building.ts';
import { robberVictims } from '../dice.ts';
import { minimumToStart, tableLimit } from '../../../shared/houseRules.ts';
import { PLAYERS } from '../rules.ts';
import Board from './Board';
import type { Targets } from './Board';
import Dice from './Dice';
import DiscardPanel from './DiscardPanel';
import EventLog from './EventLog';
import HandPanel from './HandPanel';
import PlayerList from './PlayerList';
import TradePanel from './TradePanel';
import TurnPanel from './TurnPanel';
import type { BuildMode } from './TurnPanel';
import animateMove from './animateMove.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, PublicGameState, Seat } from '../types.ts';

const ALL_VERTICES = Array.from({ length: VERTEX_COUNT }, (_, vertex) => vertex);
const ALL_HEXES = Array.from({ length: HEX_COUNT }, (_, hex) => hex);

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { isGameOver, winners, playerNames, activePlayers, started, currentPlayer } = state;
  if (isGameOver) return winners.length > 0 ? `Game over: ${winners.map(winner => playerNames[winner]).join(' and ')} won` : 'Game over';
  if (activePlayers.length < minimumToStart(PLAYERS, state)) {
    return `Waiting for at least ${minimumToStart(PLAYERS, state)} players (up to ${tableLimit(PLAYERS, state)})`;
  }
  if (currentPlayer === null) return '';
  const name = currentPlayer === playerNumber ? 'You' : playerNames[currentPlayer];
  if (!started) return `${name} ${currentPlayer === playerNumber ? 'place' : 'places'} first. Joining closes after the first move.`;
  return currentPlayer === playerNumber ? 'Your turn' : `${name}'s turn`;
}

// Where the player may click now, from the setup step, a pending robber or free road, or the chosen piece to build
function targetsFor(state: PublicGameState, seat: Seat, mode: BuildMode): Targets {
  const { setup, pending } = state;
  if (setup) {
    if (setup.settlement === null) return { vertices: ALL_VERTICES.filter(vertex => settlementSpotError(state, vertex) === null) };
    const placed = setup.settlement;
    return { edges: EDGES.flatMap((ends, edge) => ends.includes(placed) && state.roads[edge] === undefined ? [edge] : []) };
  }
  if (pending?.kind === 'robber') return { hexes: ALL_HEXES.filter(hex => hex !== state.robber) };
  if (pending?.kind === 'roadBuilding') return { edges: roadSpots(state, seat) };
  if (!pending && state.rolled) {
    if (mode === 'road') return { edges: roadSpots(state, seat) };
    if (mode === 'settlement') return { vertices: ALL_VERTICES.filter(vertex => settlementError(state, seat, vertex) === null) };
    if (mode === 'city') return { vertices: ALL_VERTICES.filter(vertex => cityError(state, seat, vertex) === null) };
  }
  return {};
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [mode, setMode] = useState<BuildMode>(null);
  const [robberHex, setRobberHex] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, pending, devPlayed, setup } = gameState;
  const noVote = !undoVote && !dismissVote;
  const ready = activePlayers.length >= minimumToStart(PLAYERS, gameState) && !isGameOver && noVote;
  const canMove = ready && currentPlayer === playerNumber;
  const canAct = ready && activePlayers.includes(playerNumber);
  const canUndo = undoAvailable && noVote && activePlayers.includes(playerNumber) && activePlayers.length >= minimumToStart(PLAYERS, gameState);
  const canPlay = canMove && !setup && !pending && !devPlayed;

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardRef, gameState, animateMove);

  // A build mode or a half-chosen robber move only lasts while it still applies
  const activeMode = canMove && !pending && gameState.rolled ? mode : null;
  const victimsAt = (hex: number) => robberVictims(gameState, playerNumber, hex, seat => gameState.handCounts[seat] ?? 0);
  const choosing = canMove && pending?.kind === 'robber' && robberHex !== null && victimsAt(robberHex).length > 1 ? robberHex : null;
  const targets = canMove ? targetsFor(gameState, playerNumber, activeMode) : {};

  const send = (move: Move) => {
    setMode(null);
    setRobberHex(null);
    gameService.makeMove(move);
  };

  function clickVertex(vertex: number) {
    if (setup) send({ type: 'placeSettlement', vertex });
    else if (activeMode === 'settlement') send({ type: 'buildSettlement', vertex });
    else if (activeMode === 'city') send({ type: 'buildCity', vertex });
  }

  function clickEdge(edge: number) {
    if (setup || pending?.kind === 'roadBuilding') send({ type: 'placeRoad', edge });
    else if (activeMode === 'road') send({ type: 'buildRoad', edge });
  }

  function clickHex(hex: number) {
    const victims = victimsAt(hex);
    if (victims.length > 1) setRobberHex(hex);
    else send({ type: 'moveRobber', hex, victim: victims[0] ?? null });
  }

  const spots = {
    road: roadSpots(gameState, playerNumber).length,
    settlement: ALL_VERTICES.filter(vertex => settlementError(gameState, playerNumber, vertex) === null).length,
    city: ALL_VERTICES.filter(vertex => cityError(gameState, playerNumber, vertex) === null).length
  };

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="catan-layout">
        <div className="board-area" ref={boardRef}>
          <Board gameState={gameState} targets={targets} onVertex={clickVertex} onEdge={clickEdge} onHex={clickHex} />
          <Dice dice={gameState.dice} />
        </div>
        <div className="side-panel">
          <div className={error ? 'game-status game-status-error' : 'game-status'} role="status">{error || gameStatus}</div>
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          <TurnPanel gameState={gameState} playerNumber={playerNumber} canMove={canMove} mode={activeMode} spots={spots}
            victims={choosing === null ? null : victimsAt(choosing)} onMode={setMode}
            onSteal={victim => choosing !== null && send({ type: 'moveRobber', hex: choosing, victim })} onMove={send} />
          <DiscardPanel key={`discard-${gameState.moveCount}`} gameState={gameState} playerNumber={playerNumber} canAct={canAct}
            onAction={action => gameService.sendAction(action)} />
          <TradePanel key={`trade-${gameState.turnHolder}-${gameState.moveCount}`} gameState={gameState} playerNumber={playerNumber}
            canAct={canAct} onAction={action => gameService.sendAction(action)} />
          <HandPanel gameState={gameState} playerNumber={playerNumber} canPlay={canPlay} onMove={send} />
          <button type="button" className="undo-button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          <PlayerList gameState={gameState} viewer={playerNumber} />
          <EventLog log={gameState.log} />
        </div>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
