import { useState, useEffect, useRef } from 'react';
import gameService from '../../../src/services/gameService';
import Card from './Card';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import GameStatus from './GameStatus';
import RoundSummary from './RoundSummary';
import Table from './Table';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove, { sortedHand } from './animateMove.ts';
import useNewlyDrawn from '../../../src/hooks/useNewlyDrawn.ts';
import { drawnStep, markDrawn } from './drawn.ts';
import { handKey } from '../../../src/animation/animKeys.ts';
import { COLORS, canJumpIn, canPlay, isWild, sameCard, sevenZero } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Card as CardData, Color, Move, PublicGameState, Seat } from '../types.ts';

type HandCardsProps = {
  gameState: PublicGameState;
  playerNumber: number;
  isPlayable: (card: CardData) => boolean;
  selected: CardData | null;
  onPlay: (card: CardData) => void;
};

// Your hand as cards, sorted, with the newly drawn ones outlined
function HandCards({ gameState, playerNumber, isPlayable, selected, onPlay }: HandCardsProps) {
  const newlyDrawn = useNewlyDrawn(gameState, (previous, next) => drawnStep(previous, next, playerNumber));
  const shownHand = sortedHand(gameState.hand);
  const drawnSlots = markDrawn(shownHand, newlyDrawn);
  return (
    <div className="hand-cards">
      {shownHand.map((card, slot) => (
        <Card
          key={slot}
          card={card}
          drawn={drawnSlots[slot]}
          animKey={handKey(slot)}
          playable={isPlayable(card)}
          selected={selected !== null && sameCard(card, selected)}
          onClick={() => onPlay(card)}
        />
      ))}
    </div>
  );
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  // A Wild waiting for its color
  const [pendingWild, setPendingWild] = useState<CardData | null>(null);
  // A 7 waiting for the player to swap hands with
  const [pendingSwap, setPendingSwap] = useState<CardData | null>(null);
  // UNO is called with the next play, which leaves one card
  const [unoArmed, setUnoArmed] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const {
    currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable,
    hand, discardTop, currentColor, hasDrawn, drawnCard, drawPileCount, pendingFour, unoWindow, revealed, roundSummary
  } = gameState;
  const pendingDraw = gameState.pendingDraw ?? null;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const canAct = !isGameOver && !undoVote && !dismissVote && activePlayers.includes(playerNumber);
  const needsColor = isMyTurn && currentColor === null;
  const answering = isMyTurn && (pendingFour !== null || pendingDraw !== null);
  // A Wild Draw Four can be answered only by accepting or challenging it, unless stacking lets a card be played on it
  const canPlayCards = isMyTurn && !needsColor && (!answering || pendingDraw !== null);
  const canDrawOrPass = canPlayCards && !answering;
  // The UNO button calls with the play that leaves one card, or late, before anyone catches you
  const lateUno = canAct && unoWindow?.seat === playerNumber && !unoWindow.called;
  // With jump-in, a number card matching the top card exactly may be played out of turn
  const jumpable = (card: CardData) => canAct && !isMyTurn && currentPlayer !== null && canJumpIn(gameState, discardTop, card);
  const canJump = hand.some(jumpable);
  const canArmUno = (canPlayCards || canJump) && hand.length === 2 && !lateUno;
  const catchable = canAct && unoWindow !== null && !unoWindow.called && unoWindow.seat !== playerNumber ? unoWindow.seat : null;
  const showSummary = roundSummary !== null && !isGameOver;

  // Only the live table animates; the history dialog renders it without this hook
  useMoveAnimation(screenRef, gameState, animateMove);

  useEffect(() => {
    // A Wild picked up but not played is put back, and an UNO call not yet played is dropped, when the turn changes
    setPendingWild(null);
    setPendingSwap(null);
    setUnoArmed(false);
  }, [currentPlayer, hasDrawn]);

  // After drawing, only the drawn card may be played
  // A Draw Two goes on a Draw Two, a Wild Draw Four on either
  // A Draw Two cannot go on a Wild Draw Four
  const stackable = discardTop?.value === 'wildDrawFour' ? 'a Wild Draw Four' : 'a Draw Two or Wild Draw Four';
  const canStack = (card: CardData) => card.value === 'wildDrawFour' || (card.value === 'drawTwo' && discardTop?.value === 'drawTwo');
  const isPlayable = (card: CardData) => jumpable(card) || canPlayCards &&
    (pendingDraw ? canStack(card) : drawnCard ? sameCard(card, drawnCard) : !hasDrawn && canPlay(card, discardTop, currentColor));

  // An out-of-turn play names the move count it saw, so of two players jumping on the same card only the first counts
  const send = (move: Move) => gameService.makeMove(move, isMyTurn ? undefined : gameState.moveCount);

  function playCard(card: CardData) {
    setPendingSwap(null);
    if (isWild(card)) {
      setPendingWild(card);
      return;
    }
    // A 7 that goes out swaps nothing, so it needs no one to swap with
    if (card.value === '7' && sevenZero(gameState) && hand.length > 1) {
      setPendingSwap(card);
      return;
    }
    send({ type: 'play', card, uno: unoArmed });
  }

  function swapWith(seat: Seat) {
    if (!pendingSwap) return;
    send({ type: 'play', card: pendingSwap, uno: unoArmed, swapWith: seat });
    setPendingSwap(null);
  }

  function chooseColor(color: Color) {
    if (needsColor) {
      gameService.makeMove({ type: 'chooseColor', color });
      return;
    }
    if (!pendingWild) return;
    gameService.makeMove({ type: 'play', card: pendingWild, color, uno: unoArmed });
    setPendingWild(null);
  }

  function callUno() {
    if (lateUno) gameService.sendAction({ type: 'callUno' });
    else setUnoArmed(armed => !armed);
  }

  let hint: string | null = null;
  if (needsColor) hint = 'The game starts on a Wild: name the first color';
  else if (answering && pendingDraw) hint = `Play ${stackable} on it, or accept and draw ${pendingDraw.count}`;
  else if (answering) hint = 'Accept the Wild Draw Four, or challenge it';
  else if (lateUno) hint = 'Call UNO before anyone catches you!';
  else if (canJump) hint = 'Jump in: you hold a card identical to the top card';
  else if (isMyTurn) {
    if (pendingWild) hint = 'Choose a color for your Wild';
    else if (pendingSwap) hint = 'Choose a player to swap hands with';
    else if (unoArmed) hint = 'UNO! Now play your next-to-last card';
    else if (hasDrawn) hint = 'Play the card you drew, or pass to keep it';
    else if (hand.length === 2) hint = 'Call UNO before you play your next-to-last card';
    else hint = 'Play a matching card, or draw one';
  }

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="game-screen" ref={screenRef}>
        <div className="game-info">
          <div className="player-info">
            You are {playerNames[playerNumber]} (Player {playerNumber})
          </div>
          <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} hint={hint} />
          <div className="action-buttons">
            <button
              type="button"
              onClick={() => gameService.makeMove({ type: 'draw' })}
              disabled={!canDrawOrPass || hasDrawn}
            >
              Draw
            </button>
            <button
              type="button"
              onClick={() => gameService.makeMove({ type: 'pass' })}
              disabled={!canDrawOrPass || (!hasDrawn && drawPileCount > 0)}
            >
              Pass
            </button>
            <button
              type="button"
              className="uno-button"
              aria-pressed={unoArmed}
              onClick={callUno}
              disabled={!lateUno && !canArmUno}
            >
              UNO!
            </button>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
              Undo
            </button>
          </div>
          {catchable !== null && (
            <button type="button" className="catch-button" onClick={() => gameService.sendAction({ type: 'catchUno' })}>
              Catch {playerNames[catchable]}: no UNO call!
            </button>
          )}
        </div>
        <Table
          gameState={gameState}
          viewer={playerNumber}
          onDraw={canDrawOrPass && !hasDrawn ? () => gameService.makeMove({ type: 'draw' }) : undefined}
        />
        {answering && (
          <div className="four-answer" role="group" aria-label={pendingFour ? 'Answer the Wild Draw Four' : 'Answer the stack'}>
            {pendingFour ? (
              <p>
                {playerNames[pendingFour.by]} played a Wild Draw Four on you. It was allowed only if they held
                no {pendingFour.previousColor} card. If you challenge and they did, they draw 4 and you play on;
                if they did not, you draw 6 and lose your turn.
                {pendingDraw && ` Or play ${stackable} on it.`}
              </p>
            ) : (
              <p>Play {stackable} on the stack, or accept it, draw {pendingDraw?.count} and lose your turn.</p>
            )}
            <div className="four-actions">
              {pendingFour && <button type="button" onClick={() => gameService.makeMove({ type: 'challenge' })}>Challenge</button>}
              <button type="button" onClick={() => gameService.makeMove({ type: 'accept' })}>
                Accept and draw {pendingDraw?.count ?? 4}
              </button>
            </div>
          </div>
        )}
        {revealed && (
          <section className="revealed" aria-label={`${playerNames[revealed.of]}'s hand`}>
            <header className="hand-header">{playerNames[revealed.of]}'s hand when you challenged (only you see this)</header>
            <div className="hand-cards">
              {sortedHand(revealed.hand).map((card, slot) => <Card key={slot} card={card} />)}
            </div>
          </section>
        )}
        {(pendingWild || needsColor) && (
          <div className="color-picker" role="group" aria-label="Choose a color">
            {COLORS.map(color => (
              <button key={color} type="button" className={`color-choice swatch-${color}`} onClick={() => chooseColor(color)}>
                <ColorSymbol color={color} /> {color}
              </button>
            ))}
            {pendingWild && <button type="button" className="color-cancel" onClick={() => setPendingWild(null)}>Cancel</button>}
          </div>
        )}
        {pendingSwap && (
          <div className="swap-picker" role="group" aria-label="Swap hands with">
            {activePlayers.filter(seat => seat !== playerNumber).map(seat => (
              <button key={seat} type="button" className="swap-choice" onClick={() => swapWith(seat)}>
                {playerNames[seat]} ({gameState.handCounts[seat]})
              </button>
            ))}
            <button type="button" className="swap-cancel" onClick={() => setPendingSwap(null)}>Cancel</button>
          </div>
        )}
        <section className={isMyTurn ? 'hand' : 'hand hand-waiting'} aria-label="Your hand">
          <header className="hand-header">Your hand ({hand.length})</header>
          {/* Continue deals a new round without a move, so the cards remount to start with nothing outlined */}
          <HandCards
            key={gameState.roundNumber}
            gameState={gameState}
            playerNumber={playerNumber}
            isPlayable={isPlayable}
            selected={pendingWild}
            onPlay={playCard}
          />
        </section>
      </div>
      {showSummary && (
        <RoundSummary
          summary={roundSummary}
          gameState={gameState}
          playerNumber={playerNumber}
          onContinue={() => gameService.sendAction({ type: 'acknowledgeRound' })}
        />
      )}
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
