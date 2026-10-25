import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import PieceTray from '../../../src/components/PieceTray';
import { useDrag } from '../../../src/drag/useDrag.ts';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import { boardOf } from '../board.ts';
import { cityError, piecesLeft, roadSpots, settlementError, settlementSpotError } from '../building.ts';
import { robberVictims } from '../dice.ts';
import { minimumToStart, tableLimit } from '../../../shared/houseRules.ts';
import { PLAYERS } from '../options.ts';
import { buildChance } from '../specialBuild.ts';
import Board from './Board';
import { boardAreaClass, seatClass } from './layout.ts';
import type { Targets } from './Board';
import Dice from './Dice';
import DiscardPanel from './DiscardPanel';
import EventLog from './EventLog';
import HandPanel from './HandPanel';
import PlayerList from './PlayerList';
import TradePanel from './TradePanel';
import TurnPanel from './TurnPanel';
import type { BuildMode } from './TurnPanel';
import { trayBlocker } from './tray.ts';
import type { TrayKind } from './tray.ts';
import animateMove from './animateMove.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, PublicGameState, Seat } from '../types.ts';

const indexes = (count: number) => Array.from({ length: count }, (_, index) => index);
const allVertices = (state: PublicGameState) => indexes(boardOf(state.layout).vertexCount);
const allHexes = (state: PublicGameState) => indexes(boardOf(state.layout).hexCount);

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { isGameOver, winners, playerNames, activePlayers, started, currentPlayer } = state;
  if (isGameOver) return winners.length > 0 ? `Game over: ${winners.map(winner => playerNames[winner]).join(' and ')} won` : 'Game over';
  if (activePlayers.length < minimumToStart(PLAYERS, state)) {
    return `Waiting for at least ${minimumToStart(PLAYERS, state)} players (up to ${tableLimit(PLAYERS, state)})`;
  }
  if (currentPlayer === null) return '';
  const name = currentPlayer === playerNumber ? 'You' : playerNames[currentPlayer];
  if (state.specialBuild) {
    const builder = state.specialBuild.builders[0];
    return builder === playerNumber ? 'Your build chance' : `${playerNames[builder]}'s build chance`;
  }
  if (!started) return `${name} ${currentPlayer === playerNumber ? 'place' : 'places'} first. Joining closes after the first move.`;
  return currentPlayer === playerNumber ? 'Your turn' : `${name}'s turn`;
}

// Where the player may click now, from the setup step, a pending robber or free road, or the chosen piece to build
function targetsFor(state: PublicGameState, seat: Seat, mode: BuildMode): Targets {
  const { setup, pending } = state;
  if (setup) {
    if (setup.settlement === null) return { vertices: allVertices(state).filter(vertex => settlementSpotError(state, vertex) === null) };
    const placed = setup.settlement;
    return { edges: boardOf(state.layout).edges.flatMap((ends, edge) => ends.includes(placed) && state.roads[edge] === undefined ? [edge] : []) };
  }
  if (pending?.kind === 'robber') return { hexes: allHexes(state).filter(hex => hex !== state.robber) };
  if (pending?.kind === 'roadBuilding') return { edges: roadSpots(state, seat) };
  if (!pending && (state.rolled || state.specialBuild)) {
    if (mode === 'road') return { edges: roadSpots(state, seat) };
    if (mode === 'settlement') return { vertices: allVertices(state).filter(vertex => settlementError(state, seat, vertex) === null) };
    if (mode === 'city') return { vertices: allVertices(state).filter(vertex => cityError(state, seat, vertex) === null) };
  }
  return {};
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [mode, setMode] = useState<BuildMode>(null);
  const [robberHex, setRobberHex] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, pending, devPlayed, setup, specialBuild } = gameState;
  const noVote = !undoVote && !dismissVote;
  const ready = activePlayers.length >= minimumToStart(PLAYERS, gameState) && !isGameOver && noVote;
  const canMove = ready && currentPlayer === playerNumber;
  const canBuild = ready && buildChance(gameState, playerNumber);
  const canAct = ready && activePlayers.includes(playerNumber);
  const canUndo = undoAvailable && noVote && activePlayers.includes(playerNumber) && activePlayers.length >= minimumToStart(PLAYERS, gameState);
  const canPlay = canMove && !setup && !pending && !devPlayed;

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardRef, gameState, animateMove);

  // A build mode or a half-chosen robber move only lasts while it still applies
  const activeMode = (canMove && !pending && gameState.rolled) || canBuild ? mode : null;
  const victimsAt = (hex: number) => robberVictims(gameState, playerNumber, hex, seat => gameState.handCounts[seat] ?? 0);
  const choosing = canMove && pending?.kind === 'robber' && robberHex !== null && victimsAt(robberHex).length > 1 ? robberHex : null;
  const targets = canMove || canBuild ? targetsFor(gameState, playerNumber, activeMode) : {};

  const send = (move: Move) => {
    setMode(null);
    setRobberHex(null);
    gameService.makeMove(move, playerNumber === currentPlayer ? undefined : gameState.moveCount);
  };

  // A click builds what the build mode says; a drop builds the piece that was lifted, whatever the mode has re-rendered to
  function clickVertex(vertex: number, kind: BuildMode = activeMode) {
    if (setup) send({ type: 'placeSettlement', vertex });
    else if (kind === 'settlement') send({ type: 'buildSettlement', vertex });
    else if (kind === 'city') send({ type: 'buildCity', vertex });
  }

  function clickEdge(edge: number, kind: BuildMode = activeMode) {
    if (setup || pending?.kind === 'roadBuilding') send({ type: 'placeRoad', edge });
    else if (kind === 'road') send({ type: 'buildRoad', edge });
  }

  function clickHex(hex: number) {
    const victims = victimsAt(hex);
    if (victims.length > 1) setRobberHex(hex);
    else send({ type: 'moveRobber', hex, victim: victims[0] ?? null });
  }

  const spots = {
    road: roadSpots(gameState, playerNumber).length,
    settlement: allVertices(gameState).filter(vertex => settlementError(gameState, playerNumber, vertex) === null).length,
    city: allVertices(gameState).filter(vertex => cityError(gameState, playerNumber, vertex) === null).length
  };

  const left = piecesLeft(gameState, playerNumber);
  const blockedFor = (kind: TrayKind) => canMove || canBuild ? trayBlocker(gameState, kind, spots[kind]) : 'Not your turn';
  const beforeLift = useRef<BuildMode>(null);
  const targetOf = (id: string, target: string) => {
    const kind = id as TrayKind, number = Number(target.split('-')[1]);
    const legal = targetsFor(gameState, playerNumber, kind);
    return (target.startsWith('edge-') ? legal.edges : legal.vertices)?.includes(number) ? number : null;
  };
  const drag = useDrag({
    canLift: id => (canMove || canBuild) && blockedFor(id as TrayKind) === '',
    canDrop: (id, target) => targetOf(id, target) !== null,
    onLift: id => {
      beforeLift.current = activeMode;
      if (!setup && !pending) setMode(id as TrayKind);
    },
    onDrop: (id, target) => {
      const spot = targetOf(id, target);
      if (spot === null) return;
      if (target.startsWith('edge-')) clickEdge(spot, id as TrayKind);
      else clickVertex(spot, id as TrayKind);
    },
    onCancel: () => setMode(beforeLift.current)
  });
  const tapPiece = (id: string) => setMode(activeMode === id ? null : id as TrayKind);
  const pieces = (['road', 'settlement', 'city'] as const).map(kind => ({
    id: kind, label: kind[0].toUpperCase() + kind.slice(1), count: left[kind],
    // The outline is on a wrapper, as the piece's own clip-path would cut it off; it keeps white (seat 5) readable
    icon: <span className="tray-icon" aria-hidden="true"><span className={`tray-${kind} ${seatClass(playerNumber)}`} /></span>,
    blocked: blockedFor(kind) || undefined
  }));

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="catan-layout">
        <div className={boardAreaClass(boardOf(gameState.layout))} ref={boardRef}>
          <Board gameState={gameState} targets={targets} onVertex={clickVertex} onEdge={clickEdge} onHex={clickHex} />
          <Dice dice={gameState.dice} />
        </div>
        <div className="side-panel">
          <div className={error ? 'game-status game-status-error' : 'game-status'} role="status">{error || gameStatus}</div>
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          {canAct && <PieceTray label="Your pieces" pieces={pieces} selected={activeMode} onTap={tapPiece} drag={drag} />}
          <TurnPanel gameState={gameState} playerNumber={playerNumber} canMove={canMove} canBuild={canBuild} mode={activeMode} spots={spots}
            victims={choosing === null ? null : victimsAt(choosing)} onMode={setMode}
            onSteal={victim => choosing !== null && send({ type: 'moveRobber', hex: choosing, victim })} onMove={send} />
          <DiscardPanel key={`discard-${gameState.moveCount}`} gameState={gameState} playerNumber={playerNumber} canAct={canAct}
            onAction={action => gameService.sendAction(action)} />
          <TradePanel key={`trade-${gameState.turnHolder}-${gameState.moveCount}`} gameState={gameState} playerNumber={playerNumber}
            canAct={canAct && !specialBuild} onAction={action => gameService.sendAction(action)} />
          <HandPanel gameState={gameState} playerNumber={playerNumber} canPlay={canPlay && !specialBuild} onMove={send} />
          <button type="button" className="undo-button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          <PlayerList gameState={gameState} viewer={playerNumber} />
          <EventLog log={gameState.log} />
        </div>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
