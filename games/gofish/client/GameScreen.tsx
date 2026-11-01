import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import PlayingCard from '../../../src/components/PlayingCard';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import Hand from './Hand';
import useNewlyDrawn from '../../../src/hooks/useNewlyDrawn.ts';
import { drawnStep } from './drawn.ts';
import Table from './Table';
import { rankPlural } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState, Rank, Seat } from '../types.ts';

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver } = state;
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  const mine = currentPlayer === playerNumber;
  const name = currentPlayer === null ? '' : playerNames[currentPlayer];
  if (!started) return `${mine ? 'You go' : `${name} goes`} first. Joining closes after the first ask.`;
  return mine ? 'Your turn' : `${name}'s turn`;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const screenRef = useRef<HTMLDivElement>(null);
  const {
    currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, hand, handCounts,
    gameStatus, lastMove, fishedCard, moveCount
  } = gameState;
  // The picks belong to one turn position, so a new ask or an undo clears them
  const [picks, setPicks] = useState<{ at: number; rank: Rank | null; target: Seat | null }>({ at: moveCount, rank: null, target: null });
  const current = picks.at === moveCount ? picks : { at: moveCount, rank: null, target: null };

  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const targets = activePlayers.filter(seat => seat !== playerNumber && (handCounts[seat] ?? 0) > 0);
  // With one player to ask, they are picked already
  const target = current.target ?? (targets.length === 1 ? targets[0] : null);
  const rank = current.rank !== null && hand.some(card => card.rank === current.rank) ? current.rank : null;

  useMoveAnimation(screenRef, gameState, animateMove);
  const newlyDrawn = useNewlyDrawn(gameState, (previous, next) => drawnStep(previous, next, playerNumber));

  function ask() {
    if (!isMyTurn || rank === null || target === null) return;
    gameService.makeMove({ type: 'ask', target, rank });
  }

  let hint: string | null = null;
  if (isMyTurn) {
    if (rank === null) hint = 'Click a card to pick the rank to ask for';
    else if (target === null) hint = `Now pick the player to ask for ${rankPlural(rank)}`;
    else hint = `Ask ${playerNames[target]} for ${rankPlural(rank)}`;
  }
  const drew = fishedCard !== null && lastMove !== null && (lastMove.asker === playerNumber || lastMove.fished === 'asked');

  return (
    <>
      <div className="game-screen" ref={screenRef}>
        <div className="game-info">
          <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          {drew && (
            <div className="fished">
              <PlayingCard card={fishedCard} size="small" />
              <span>{lastMove.asker === playerNumber ? 'You' : playerNames[lastMove.asker]} drew this card</span>
            </div>
          )}
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          <div className="hint">{hint}</div>
          <div className="action-buttons">
            <button type="button" className="ask-button" onClick={ask} disabled={!isMyTurn || rank === null || target === null}>
              {isMyTurn && rank !== null && target !== null ? `Ask ${playerNames[target]} for ${rankPlural(rank)}` : 'Ask'}
            </button>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        <Table
          gameState={gameState}
          viewer={playerNumber}
          target={isMyTurn ? target : null}
          onPickTarget={isMyTurn ? seat => setPicks({ ...current, target: seat }) : undefined}
        />
        <Hand
          hand={hand}
          label={`Your hand (${hand.length})`}
          waiting={!isMyTurn}
          drawnKeys={newlyDrawn}
          rank={isMyTurn ? rank : null}
          onPickRank={isMyTurn ? picked => setPicks({ ...current, rank: picked }) : undefined}
        />
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
