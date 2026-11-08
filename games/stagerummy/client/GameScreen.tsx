import { useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import useNewlyDrawn from '../../../src/hooks/useNewlyDrawn.ts';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import CardView from './CardView';
import GameStatus from './GameStatus';
import HandSummary from './HandSummary';
import LayDownPanel from './LayDownPanel';
import Piles from './Piles';
import Table from './Table';
import animateMove, { cardKey } from './animateMove.ts';
import { drawnStep } from './drawn.ts';
import { DEFAULT_SORT_ORDER, sortHand, type SortOrder } from './sortHand.ts';
import { hasLaidDown, layablePhases, phaseRequirements, skipTargets } from '../rules.ts';
import { seatOrder } from './seatOrder.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Card, DrawSource, PublicGameState, Seat } from '../types.ts';

type HandCardsProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  hand: Card[];
  selected: number[];
  disabled: boolean;
  onToggle: (card: Card) => void;
};

// Your hand as cards, with the newly drawn ones outlined
function HandCards({ gameState, playerNumber, hand, selected, disabled, onToggle }: HandCardsProps) {
  const newlyDrawn = useNewlyDrawn(gameState, (previous, next) => drawnStep(previous, next, playerNumber));
  return (
    <div className="hand-cards">
      {hand.map(card => (
        <CardView
          key={card.id}
          card={card}
          animKey={cardKey(card.id)}
          selected={selected.includes(card.id)}
          drawn={newlyDrawn.includes(card.id)}
          disabled={disabled}
          onClick={() => onToggle(card)}
        />
      ))}
    </div>
  );
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [staged, setStaged] = useState<number[][]>([]);
  const [chosenPhase, setChosenPhase] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const {
    currentPlayer, activePlayers, playerNames, phases, isGameOver, handNumber, handSummary,
    undoVote, dismissVote, undoAvailable, drawnBy, myHand, moveCount
  } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const hasDrawn = isMyTurn && drawnBy === playerNumber;
  const laidDown = hasLaidDown(gameState, playerNumber);
  // With phases in any order the player picks one; otherwise there is only the next phase
  const choices = layablePhases(gameState, playerNumber);
  const layPhase = chosenPhase !== null && choices.includes(chosenPhase) ? chosenPhase : choices[0];
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const showSummary = handSummary !== null && !isGameOver;

  useMoveAnimation(screenRef, gameState, animateMove);

  useEffect(() => {
    // Nothing stays picked or staged across moves, undos or hands
    setSelected([]);
    setStaged([]);
    setChosenPhase(null);
  }, [moveCount, handNumber]);

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
    setStaged(current => phaseRequirements(layPhase).map((_, index) =>
      index === part ? [...(current[index] ?? []), ...selected] : current[index] ?? []));
    setSelected([]);
  }

  function choosePhase(phase: number) {
    setChosenPhase(phase);
    setStaged([]);
  }

  function unstage(card: Card) {
    setStaged(current => current.map(ids => ids.filter(id => id !== card.id)));
  }

  const draw = (source: DrawSource) => gameService.makeMove({ type: 'draw', source });
  const layDown = () => gameService.makeMove({ type: 'layDown', groups: staged, phase: layPhase });
  const hit = (group: number) => gameService.makeMove({ type: 'hit', group, cards: selected });
  const discard = (card: Card, skip: Seat | null) => gameService.makeMove({ type: 'discard', card: card.id, skip });

  let hint: string | null = null;
  if (isMyTurn && !hasDrawn) hint = 'Your turn: draw from the pile or take the discard';
  else if (hasDrawn && !laidDown) hint = 'Build your phase from selected cards, or select one card to discard';
  else if (hasDrawn) hint = 'Select cards to hit on any group, or one card to discard';

  // Turn order starting with this player
  const seats = seatOrder(Object.keys(phases).map(Number), playerNumber);

  return (
    <>
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
          {/* Continue deals a new hand without a move, so the cards remount to start with nothing outlined */}
          <HandCards
            key={handNumber}
            gameState={gameState}
            playerNumber={playerNumber}
            hand={hand}
            selected={selected}
            disabled={!hasDrawn}
            onToggle={toggle}
          />
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
              phase={layPhase}
              choices={choices}
              staged={stagedCards}
              hasSelection={selected.length > 0}
              onChoose={choosePhase}
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
          onContinue={() => gameService.sendAction({ type: 'acknowledgeHand' })}
        />
      )}
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
