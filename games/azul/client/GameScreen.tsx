import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import gameService from '../../../src/services/gameService';
import Factories from './Factories';
import GameStatus from './GameStatus';
import PlayerBoard from './PlayerBoard';
import RoundSummary from './RoundSummary';
import UndoVote from '../../../src/components/UndoVote';
import { MOVE_DURATION_MS, prefersReducedMotion } from '../../../src/animation/motion.ts';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import { azulInfo } from '../info.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Selection } from './selection.ts';
import type { PublicGameState, Seat } from '../types.ts';

const MAX_PLAYERS = azulInfo.maxPlayers;
const SUMMARY_DELAY_MS = MOVE_DURATION_MS + 100;

// True for a moment after a move ends the round, so everyone sees the tiles slide onto the wall
// before the summary covers them. A summary already open on load, refresh or rejoin is not held.
function useSummaryHeld(gameState: PublicGameState): boolean {
  const [held, setHeld] = useState(false);
  const previousRef = useRef<PublicGameState | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  // A layout effect, so the summary is hidden again before the browser paints it
  useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = gameState;
    const endedRound = previous !== null && gameState.moveCount === previous.moveCount + 1 &&
      previous.roundSummary === null && gameState.roundSummary !== null;
    if (!endedRound || prefersReducedMotion()) return;
    setHeld(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setHeld(false), SUMMARY_DELAY_MS);
  }, [gameState]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);
  return held;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [finalScoringClosed, setFinalScoringClosed] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const summaryHeld = useSummaryHeld(gameState);
  const {
    currentPlayer, activePlayers, playerNames, boards, isGameOver, winners, round,
    roundSummary, undoVote, dismissVote, undoAvailable
  } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const showSummary = roundSummary !== null && !summaryHeld && !(isGameOver && finalScoringClosed);

  // Only the live table and boards animate; the history dialog renders them without this hook
  useMoveAnimation(screenRef, gameState, animateMove);

  useEffect(() => {
    // Nothing stays picked up across turns or rounds
    setSelection(null);
  }, [currentPlayer, round]);

  useEffect(() => {
    // An undo can reopen a finished game; its next ending shows the scoring again
    if (!isGameOver) setFinalScoringClosed(false);
  }, [isGameOver]);

  function place(line: number | 'floor') {
    if (!selection) return;
    gameService.makeMove({ ...selection, line });
    setSelection(null);
  }

  let hint: string | null = null;
  if (isMyTurn) {
    hint = selection
      ? `Place the ${selection.color} tiles on a highlighted line, or on the floor`
      : 'Your turn: pick tiles from a factory or the center';
  }

  function renderBoard(seat: Seat) {
    const isMe = seat === playerNumber;
    return (
      <PlayerBoard
        key={seat}
        board={boards[seat]}
        seat={seat}
        name={playerNames[seat]}
        isMe={isMe}
        isCurrent={currentPlayer === seat}
        hasLeft={!activePlayers.includes(seat)}
        isWinner={winners.includes(seat)}
        selectedColor={isMe && isMyTurn && selection ? selection.color : null}
        onPlace={place}
      />
    );
  }

  // Turn order starting with this player, so on every screen play passes to the board on the right
  const stepsAfterMe = (seat: Seat) => (seat - playerNumber + MAX_PLAYERS) % MAX_PLAYERS;
  const turnOrder = Object.keys(boards).map(Number).sort((a, b) => stepsAfterMe(a) - stepsAfterMe(b));
  const otherSeats = turnOrder.filter(seat => seat !== playerNumber);

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
            {isGameOver && roundSummary && finalScoringClosed && (
              <button type="button" onClick={() => setFinalScoringClosed(false)}>
                Show Scoring
              </button>
            )}
          </div>
        </div>
        <Factories gameState={gameState} isMyTurn={isMyTurn} selection={selection} onSelect={setSelection} />
        <div className="boards">
          {renderBoard(playerNumber)}
          {otherSeats.length > 0 && <div className="other-boards">{otherSeats.map(renderBoard)}</div>}
        </div>
      </div>
      {showSummary && (
        <RoundSummary
          summary={roundSummary}
          gameState={gameState}
          playerNumber={playerNumber}
          seats={turnOrder}
          onContinue={() => gameService.sendAction({ type: 'acknowledgeRound' })}
          onClose={() => setFinalScoringClosed(true)}
        />
      )}
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
