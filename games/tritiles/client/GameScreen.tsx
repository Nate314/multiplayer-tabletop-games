import { useEffect, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useDrag } from '../../../src/drag/useDrag.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import { cellKey } from '../grid.ts';
import { legalPlays, stuckMove } from '../rules.ts';
import { MAX_DRAWS } from '../scoring.ts';
import type { Move, PublicGameState, Seat } from '../types.ts';
import Board from './Board';
import Hand from './Hand';
import RoundSummary from './RoundSummary';
import Table from './Table';

type Play = Extract<Move, { type: 'play' }>;
// A space chosen for the held tile that takes it in more than one rotation: `turn` picks the rotation shown
type Spot = { key: string; turn: number };

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver, winners, roundSummary, roundNumber } = state;
  if (isGameOver) return winners.length > 0 ? `Game over: ${winners.map(seat => playerNames[seat]).join(' and ')} ${winners.length > 1 ? 'win' : 'wins'}` : 'Game over';
  if (roundSummary) return `Round ${roundNumber} is over`;
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  const mine = currentPlayer === playerNumber;
  const name = mine ? 'You' : currentPlayer === null ? '' : playerNames[currentPlayer];
  if (!started) return `${name} ${mine ? 'go' : 'goes'} first. Joining closes after the first move.`;
  return mine ? 'Your turn' : `${name}'s turn`;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const {
    currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, hand, board, leadTile, poolCount,
    drawsThisTurn, roundSummary, lastMove, gameStatus
  } = gameState;
  // The tile picked up (tapped) but not placed, and the space chosen for it while its rotation is picked
  const [choosing, setChoosing] = useState<number | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  // The round opens with the lead tile only
  const opening = board.length === 0;
  const playable = opening && leadTile !== null ? hand.filter(tile => tile === leadTile) : hand;
  const plays = isMyTurn ? legalPlays(board, playable) as Play[] : [];
  const stuck = isMyTurn && !opening ? stuckMove(board, hand, poolCount, drawsThisTurn) : null;

  useEffect(() => {
    // A tile picked up but not placed is put back when the turn or the board changes
    setChoosing(null);
    setSpot(null);
  }, [currentPlayer, board.length, hand.length]);

  const playsOf = (tile: number) => plays.filter(play => play.tile === tile);
  const rotationsAt = (tile: number, key: string) => playsOf(tile).filter(play => cellKey(play.cell) === key);

  function send(play: Play) {
    setChoosing(null);
    setSpot(null);
    gameService.makeMove(play);
  }

  function pickTile(tile: number) {
    setSpot(null);
    setChoosing(choosing === tile ? null : tile);
  }

  // One rotation fits there: it is played. More than one: the first is shown, for Rotate and Confirm
  function pickSpace(tile: number, key: string) {
    const fits = rotationsAt(tile, key);
    if (fits.length === 1) send(fits[0]);
    else if (fits.length > 1) {
      setChoosing(tile);
      setSpot({ key, turn: 0 });
    }
  }

  // Dragging a tile: the spaces it fits light up while it is held; dropping on one is the same as tapping it
  const drag = useDrag({
    canLift: id => playsOf(Number(id)).length > 0,
    canDrop: (id, target) => rotationsAt(Number(id), target).length > 0,
    onDrop: (id, target) => pickSpace(Number(id), target),
    onCancel: () => { setChoosing(null); setSpot(null); }
  });

  const held = drag.dragging === null ? choosing : Number(drag.dragging);
  const options = spot && choosing !== null ? rotationsAt(choosing, spot.key) : [];
  const shown = options.length > 0 ? options[spot!.turn % options.length] : null;
  const targets = held === null ? [] : [...new Map(playsOf(held).map(play => [cellKey(play.cell), play.cell])).values()]
    .filter(cell => cellKey(cell) !== spot?.key);

  let hint: string | null = null;
  if (isMyTurn) {
    if (shown) hint = 'That space takes the tile more than one way: Rotate, then Confirm';
    else if (held !== null) hint = 'Choose a highlighted space';
    else if (opening) hint = 'Open the round with your highest triple, or your highest-sum tile';
    else if (stuck === 'draw') hint = drawsThisTurn === 0
      ? `Nothing fits: draw from the pool, 5 points a tile, up to ${MAX_DRAWS}`
      : `Nothing fits: draw again (${drawsThisTurn} of ${MAX_DRAWS} drawn)`;
    else if (stuck === 'pass') hint = poolCount === 0 ? 'Nothing fits and the pool is empty: pass for 10 points' : `Nothing fits after ${MAX_DRAWS} draws: pass for 10 points`;
    else hint = 'Play a tile whose corners match the board';
  }

  return (
    <>
      <div className="game-screen">
        <div className="game-info">
          <div className="player-info">You are {gameState.playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>}
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          <div className="hint">{hint}</div>
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.makeMove({ type: 'draw' })} disabled={stuck !== 'draw'}>Draw</button>
            <button type="button" onClick={() => gameService.makeMove({ type: 'pass' })} disabled={stuck !== 'pass'}>Pass</button>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        <Table gameState={gameState} viewer={playerNumber} />
        <Board
          board={board}
          lastCell={lastMove?.type === 'play' ? lastMove.cell : null}
          targets={targets}
          preview={shown}
          onCell={cell => { if (held !== null) pickSpace(held, cellKey(cell)); }}
        />
        {shown && (
          <div className="place-choice" role="group" aria-label="Place the tile">
            <button type="button" onClick={() => setSpot({ ...spot!, turn: spot!.turn + 1 })}>Rotate</button>
            <button type="button" onClick={() => send(shown)}>Confirm</button>
            <button type="button" onClick={() => { setChoosing(null); setSpot(null); }}>Cancel</button>
          </div>
        )}
        <Hand
          hand={hand}
          label="Your hand"
          waiting={!isMyTurn}
          playable={tile => playsOf(tile).length > 0}
          selected={choosing}
          onTile={pickTile}
          dragSource={tile => drag.source(String(tile))}
        />
      </div>
      {roundSummary !== null && !isGameOver && (
        <RoundSummary
          summary={roundSummary}
          gameState={gameState}
          playerNumber={playerNumber}
          onContinue={() => gameService.sendAction({ type: 'acknowledgeRound' })}
        />
      )}
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={approve => gameService.voteUndo(approve)} />
    </>
  );
}
