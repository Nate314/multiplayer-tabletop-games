import { useCallback, useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { ordinal } from '../../../src/components/gameOver.ts';
import { houseRule } from '../../../shared/houseRules.ts';
import { hasPattern, letterOf, markable } from '../cards.ts';
import { PATTERN_RULE } from '../options.ts';
import CardGrid from './CardGrid';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState, Seat } from '../types.ts';

// Auto-call calls for you this long after your turn comes up
export const AUTO_CALL_MS = 1000;

type Auto = { call: boolean; mark: boolean; sent: Set<string> };
// A shared device remounts the screen each time the shown seat changes, so the checkboxes and the marks Auto-mark has
// sent live here, per game, not in the component. Still only in this tab, and off again after a reload
const autoByGame = new Map<string, Auto>();
function autoOf(gameId: string): Auto {
  let auto = autoByGame.get(gameId);
  if (!auto) autoByGame.set(gameId, auto = { call: false, mark: false, sent: new Set() });
  return auto;
}

// A shared device's server acts for the seat it shows, which may have moved on since this state arrived, so every send
// on one names its seat first
function send(shared: boolean, seat: Seat, action: object): void {
  if (shared) gameService.showSeat(seat);
  gameService.sendAction(action);
}

function turnMessage(state: PublicGameState, caller: Seat | null, shared: boolean): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver } = state;
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for one more player';
  if (currentPlayer === null) return '';
  const turn = caller !== null && !shared ? 'Your turn: call a number' : `${playerNames[currentPlayer]}'s turn to call`;
  return started ? turn : `${turn}. Joining closes after the first call.`;
}

export default function GameScreen({ gameState, playerNumber, error, localSeats }: GameScreenProps<PublicGameState>) {
  const {
    gameId, gameNumber = 1, currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus,
    moveCount, called, cards, marks, places
  } = gameState;
  const shared = localSeats !== undefined;
  const seats = (localSeats ?? [playerNumber]).filter(seat => cards[seat]);
  const [autoCall, setAutoCall] = useState(() => autoOf(gameId).call);
  const [autoMark, setAutoMark] = useState(() => autoOf(gameId).mark);
  const voting = !!undoVote || !!dismissVote;
  const live = activePlayers.length >= 2 && !isGameOver && !voting;
  const caller = currentPlayer !== null && seats.includes(currentPlayer) ? currentPlayer : null;
  const canCall = live && caller !== null;
  const canUndo = undoAvailable && !voting && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const pattern = houseRule(gameState, PATTERN_RULE);
  const last = called.at(-1);

  // The moveCount a call was last sent at, so a click and the Auto-call timer never both call from the same state
  const sentAt = useRef<number | null>(null);
  const call = useCallback(() => {
    if (caller === null || sentAt.current === moveCount) return;
    sentAt.current = moveCount;
    if (shared) gameService.showSeat(caller);
    gameService.makeMove({ type: 'call' });
  }, [caller, moveCount, shared]);

  // A new state (a call, an undo), a refused call or a vote lets the player call again
  useEffect(() => {
    sentAt.current = null;
  }, [moveCount, error, undoVote, dismissVote]);

  // moveCount restarts the timer when the turn passes from one local seat to the next
  useEffect(() => {
    if (!autoCall || !canCall) return;
    const timer = setTimeout(call, AUTO_CALL_MS);
    return () => clearTimeout(timer);
  }, [autoCall, canCall, call]);

  // A refused send (a pause, an undo in flight, a seat switched under it) never lands, so whenever the error changes, every
  // send still waiting is forgotten and the effect below sends again only what is still missing. Clearing also when the
  // error goes away covers a retry refused with the same message (still paused), which sets no new error.
  // Declared before that effect so it runs first; a remount starts level with the current error, so it clears nothing
  const seenError = useRef(error);
  useEffect(() => {
    if (seenError.current === error) return;
    seenError.current = error;
    autoOf(gameId).sent.clear();
  }, [error, gameId]);

  // Marks every called number on every unplaced local seat's cards, then claims for a seat once a card has the pattern.
  // A sent mark or claim is not sent again until it lands or an error arrives, so the states in between never repeat it
  useEffect(() => {
    if (!autoMark || isGameOver) return;
    const { sent } = autoOf(gameId);
    for (const seat of localSeats ?? [playerNumber]) {
      const claimKey = `${gameNumber}:${seat}:bingo`;
      if (!cards[seat] || places[seat] !== undefined) {
        sent.delete(claimKey);
        continue;
      }
      cards[seat].forEach((card, index) => {
        for (const square of markable(card, called)) {
          const key = `${gameNumber}:${seat}:${index}:${square}`;
          if (marks[seat][index].includes(square)) sent.delete(key);
          else if (!sent.has(key)) {
            sent.add(key);
            send(shared, seat, { type: 'mark', card: index, square });
          }
        }
      });
      if (!sent.has(claimKey) && cards[seat].some((card, index) => hasPattern(card, marks[seat][index], pattern))) {
        sent.add(claimKey);
        send(shared, seat, { type: 'bingo' });
      }
    }
  }, [autoMark, isGameOver, gameId, gameNumber, localSeats, playerNumber, cards, marks, places, called, pattern, shared, error]);

  const tick = (key: 'call' | 'mark', on: boolean) => {
    autoOf(gameId)[key] = on;
    (key === 'call' ? setAutoCall : setAutoMark)(on);
  };

  return (
    <>
      <div className="game-screen bingo-screen">
        <div className="game-info">
          {!shared && <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>}
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="turn-message">{turnMessage(gameState, caller, shared)}</div>
          <div className="bingo-calls">
            <div className="bingo-last" aria-label="Last call">{last === undefined ? 'No call yet' : `${letterOf(last)} ${last}`}</div>
            <ol className="bingo-called" aria-label="Called so far">
              {called.map(number => <li key={number}>{letterOf(number)} {number}</li>)}
            </ol>
          </div>
          <div className="bingo-pattern">Pattern: {PATTERN_RULE.choices.find(choice => choice.value === pattern)?.label}</div>
          <div className="action-buttons">
            <button type="button" className="bingo-call-button" onClick={call} disabled={!canCall}>Call</button>
            <label className="bingo-auto">
              <input type="checkbox" checked={autoCall} onChange={event => tick('call', event.target.checked)} />
              Auto-call
            </label>
            <label className="bingo-auto">
              <input type="checkbox" checked={autoMark} onChange={event => tick('mark', event.target.checked)} />
              Auto-mark
            </label>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        {seats.map(seat => {
          const name = playerNames[seat];
          const done = isGameOver || places[seat] !== undefined;
          return (
            <section key={seat} className="bingo-seat" aria-label={`${name}'s cards`}>
              <header className="bingo-seat-header">
                <h2>{name}{places[seat] !== undefined && ` (${ordinal(places[seat])} place)`}</h2>
                <button type="button" className="bingo-claim" disabled={done} onClick={() => send(shared, seat, { type: 'bingo' })}>Bingo!</button>
              </header>
              <div className="bingo-cards">
                {cards[seat].map((card, index) => (
                  <CardGrid key={index} card={card} marked={marks[seat][index]} called={called} label={`${name}'s card ${index + 1}`}
                    onMark={done ? undefined : square => send(shared, seat, { type: 'mark', card: index, square })} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
