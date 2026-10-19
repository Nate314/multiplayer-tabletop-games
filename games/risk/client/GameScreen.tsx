import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import BattleDice from './BattleDice';
import CardHand from './CardHand';
import EventLog from './EventLog';
import PhasePanel, { type PlaceStep } from './PhasePanel';
import PlayerList from './PlayerList';
import WorldMap from './WorldMap';
import animateMove from './animateMove.ts';
import { canBeSource, targetsFrom } from './selection.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, Placements, PublicGameState } from '../types.ts';

function turnMessage(state: PublicGameState, playerNumber: number): string {
  const { isGameOver, winners, playerNames, activePlayers, started, turnHolder, phase } = state;
  if (isGameOver) return winners.length > 0 ? `Game over: ${playerNames[winners[0]]} wins` : 'Game over';
  if (state.firstPlayer === null) return `Waiting for ${3 - activePlayers.length} more ${activePlayers.length === 2 ? 'player' : 'players'} (3 to 6 play)`;
  if (turnHolder === null) return '';
  const you = turnHolder === playerNumber;
  if (!started) return `${you ? 'You place' : `${playerNames[turnHolder]} places`} first. Joining closes after the first move.`;
  if (phase === 'setup') return you ? 'Place your starting armies' : `${playerNames[turnHolder]} is placing starting armies`;
  return you ? 'Your turn' : `${playerNames[turnHolder]}'s turn`;
}

// A choice made for one move: dropped once another move is played
type Stamped<T> = { moveCount: number; value: T };

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<{ source: string | null; target: string | null } | null>(null);
  const [drafted, setDrafted] = useState<Stamped<Placements> | null>(null);
  const [placeStep, setPlaceStep] = useState<PlaceStep>(1);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, phase, moveCount, hand } = gameState;
  const noVote = !undoVote && !dismissVote;
  // Three are needed to deal, but a game that loses players to dismissals plays on with two
  const canMove = gameState.firstPlayer !== null && !isGameOver && noVote && currentPlayer === playerNumber;
  const canUndo = undoAvailable && noVote && activePlayers.includes(playerNumber);

  useMoveAnimation(mapRef, gameState, animateMove);

  // The source and target stay chosen between attacks, but one the last move made invalid (lost, captured, too few
  // armies) is dropped
  const choice = picked;
  const source = choice?.source && canMove && canBeSource(gameState, playerNumber, choice.source) ? choice.source : null;
  const targets = targetsFrom(gameState, playerNumber, source);
  const target = choice?.target && targets.includes(choice.target) ? choice.target : null;
  const draft = drafted?.moveCount === moveCount ? drafted.value : {};
  const placing = canMove && (phase === 'setup' || phase === 'reinforce');
  const available = phase === 'setup' ? gameState.setupLeft[playerNumber] ?? 0 : gameState.reinforcements;
  const left = available - Object.values(draft).reduce((sum, count) => sum + count, 0);

  const choose = (value: { source: string | null; target: string | null }) => setPicked(value);
  const setDraft = (value: Placements) => setDrafted({ moveCount, value });

  const select = (id: string) => {
    if (placing) {
      const add = placeStep === 'all' ? left : Math.min(placeStep, left);
      if (add > 0) setDraft({ ...draft, [id]: (draft[id] ?? 0) + add });
      return;
    }
    if (source && targets.includes(id)) choose({ source, target: id });
    else if (id === source) choose({ source: null, target: null });
    else choose({ source: id, target: null });
  };

  const canSelect = (id: string) => {
    if (!canMove) return false;
    if (placing) return gameState.owners[id] === playerNumber && left > 0;
    if (phase !== 'attack' && phase !== 'fortify') return false;
    return canBeSource(gameState, playerNumber, id) || targets.includes(id);
  };

  const unplace = (id: string) => {
    const rest = { ...draft };
    if (rest[id] > 1) rest[id] -= 1;
    else delete rest[id];
    setDraft(rest);
  };

  const send = (move: Move) => gameService.makeMove(move);

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="risk-layout">
        <div className="map-area" ref={mapRef}>
          <WorldMap gameState={gameState} source={source} target={target} targets={targets} draft={draft}
            canSelect={canSelect} onSelect={select} />
        </div>
        <div className="side-panel">
          <div className={error ? 'game-status game-status-error' : 'game-status'} role="status">{error || gameStatus}</div>
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          <PhasePanel gameState={gameState} playerNumber={playerNumber} canMove={canMove} source={source} target={target} draft={draft}
            placeStep={placeStep} onPlaceStep={setPlaceStep} onUnplace={unplace} onClearDraft={() => setDraft({})}
            onClearSelection={() => choose({ source: null, target: null })} onMove={send} />
          <BattleDice battle={gameState.battle} playerNames={gameState.playerNames} />
          {hand && (
            <CardHand gameState={gameState} hand={hand} playerNumber={playerNumber} canTrade={canMove && phase === 'reinforce'} onMove={send} />
          )}
          <button type="button" className="undo-button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          <PlayerList gameState={gameState} viewer={playerNumber} />
          <EventLog log={gameState.log} />
        </div>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
