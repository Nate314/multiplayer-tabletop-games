import { useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import CardView from './CardView';
import GameStatus from './GameStatus';
import HandSummary from './HandSummary';
import LayDownPanel from './LayDownPanel';
import Piles from './Piles';
import Table from './Table';
import animateMove, { cardKey } from './animateMove.ts';
import { DEFAULT_SORT_ORDER, sortHand, type SortOrder } from './sortHand.ts';
import { hasLaidDown, phaseRequirements, skipTargets } from '../rules.ts';
import { phase10 } from '../index.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Card, DrawSource, PublicGameState, Seat } from '../types.ts';

const MAX_PLAYERS = phase10.info.maxPlayers;

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [staged, setStaged] = useState<number[][]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [finalScoringClosed, setFinalScoringClosed] = useState(false);
  const {
    currentPlayer, activePlayers, playerNames, phases, isGameOver, handNumber, handSummary,
    undoVote, dismissVote, undoAvailable, drawnBy, myHand, moveCount
  } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const hasDrawn = isMyTurn && drawnBy === playerNumber;
  const laidDown = hasLaidDown(gameState, playerNumber);
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const showSummary = handSummary !== null && !(isGameOver && finalScoringClosed);

  useMoveAnimation(screenRef, gameState, animateMove);

  useEffect(() => {
    // Nothing stays picked or staged across moves, undos or hands
    setSelected([]);
    setStaged([]);
  }, [moveCount, handNumber]);

  useEffect(() => {
    // An undo can reopen a finished game; its next ending shows the scoring again
    if (!isGameOver) setFinalScoringClosed(false);
  }, [isGameOver]);

  const cardById = (id: number) => myHand.find(card => card.id === id);
  const stagedCards = staged.map(ids => ids.map(cardById).filter(card => card !== undefined));
  const stagedIds = staged.flat();
  const hand = sortHand(myHand.filter(card => !stagedIds.includes(card.id)), sortOrder);
  const selectedCards = selected.map(cardById).filter(card => card !== undefined);
  const discardCard = selectedCards.length === 1 ? selectedCards[0] : null;
  const targets = discardCard?.kind === 'skip' ? skipTargets(gameState, playerNumber) : [];

  function toggle(card: Card) {
    setSelected(current => (current.includes(card.id) ? current.filter(id => id !== card.id) : [...current, card.id]));
  }

  function stage(part: number) {
    setStaged(current => phaseRequirements(phases[playerNumber]).map((_, index) =>
      index === part ? [...(current[index] ?? []), ...selected] : current[index] ?? []));
    setSelected([]);
  }

  function unstage(card: Card) {
    setStaged(current => current.map(ids => ids.filter(id => id !== card.id)));
  }

  const draw = (source: DrawSource) => gameService.makeMove({ type: 'draw', source });
  const layDown = () => gameService.makeMove({ type: 'layDown', groups: staged });
  const hit = (group: number) => gameService.makeMove({ type: 'hit', group, cards: selected });
  const discard = (card: Card, skip: Seat | null) => gameService.makeMove({ type: 'discard', card: card.id, skip });

  let hint: string | null = null;
  if (isMyTurn && !hasDrawn) hint = 'Your turn: draw from the pile or take the discard';
  else if (hasDrawn && !laidDown) hint = 'Build your phase from selected cards, or select one card to discard';
  else if (hasDrawn) hint = 'Select cards to hit on any group, or one card to discard';

  // Turn order starting with this player
  const stepsAfterMe = (seat: Seat) => (seat - playerNumber + MAX_PLAYERS) % MAX_PLAYERS;
  const seats = Object.keys(phases).map(Number).sort((a, b) => stepsAfterMe(a) - stepsAfterMe(b));

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="game-screen" ref={screenRef}>
        <div className="game-info">
          <div className="player-info">
            You are {playerNames[playerNumber]} (Player {playerNumber})
          </div>
          <GameStatus gameState={gameState} error={error} hint={hint} />
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
              Undo
            </button>
            {isGameOver && handSummary && finalScoringClosed && (
              <button type="button" onClick={() => setFinalScoringClosed(false)}>
                Show Scoring
              </button>
            )}
          </div>
        </div>

        <Piles gameState={gameState} canDraw={isMyTurn && !hasDrawn} onDraw={draw} />

        <section className={isMyTurn ? 'my-hand' : 'my-hand my-hand-waiting'} aria-label="Your hand">
          <header className="my-hand-header">
            <span>Your hand ({myHand.length})</span>
            <span className="sort-buttons">
              Sort:
              {(['number', 'color'] as const).map(order => (
                <button key={order} type="button" aria-pressed={sortOrder === order} onClick={() => setSortOrder(order)}>
                  {order === 'number' ? 'Number' : 'Color'}
                </button>
              ))}
            </span>
          </header>
          <div className="hand-cards">
            {hand.map(card => (
              <CardView
                key={card.id}
                card={card}
                animKey={cardKey(card.id)}
                selected={selected.includes(card.id)}
                disabled={!hasDrawn}
                onClick={() => toggle(card)}
              />
            ))}
          </div>
          {hasDrawn && (
            <div className="turn-actions">
              {targets.length > 0 && discardCard ? (
                targets.map(seat => (
                  <button key={seat} type="button" onClick={() => discard(discardCard, seat)}>
                    Discard Skip on {playerNames[seat]}
                  </button>
                ))
              ) : (
                <button type="button" disabled={!discardCard} onClick={() => discardCard && discard(discardCard, null)}>
                  Discard selected card
                </button>
              )}
              {selected.length > 0 && (
                <button type="button" onClick={() => setSelected([])}>Deselect</button>
              )}
            </div>
          )}
          {hasDrawn && !laidDown && (
            <LayDownPanel
              seat={playerNumber}
              phase={phases[playerNumber]}
              staged={stagedCards}
              hasSelection={selected.length > 0}
              onAdd={stage}
              onReturn={unstage}
              onClear={() => setStaged([])}
              onLayDown={layDown}
            />
          )}
        </section>

        <Table
          gameState={gameState}
          seats={seats}
          playerNumber={playerNumber}
          canHit={hasDrawn && laidDown && selected.length > 0}
          onHit={hit}
        />
      </div>
      {showSummary && (
        <HandSummary
          summary={handSummary}
          gameState={gameState}
          playerNumber={playerNumber}
          seats={seats}
          onContinue={() => gameService.sendAction({ type: 'acknowledgeHand' })}
          onClose={() => setFinalScoringClosed(true)}
        />
      )}
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
