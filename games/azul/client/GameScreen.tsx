import { useState, useEffect } from 'react';
import gameService from '../../../src/services/gameService';
import Factories from './Factories';
import GameStatus from './GameStatus';
import PlayerBoard from './PlayerBoard';
import RoundSummary from './RoundSummary';
import UndoVote from '../../../src/components/UndoVote';
import { azul } from '../index.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Selection } from './selection.ts';
import type { PublicGameState, Seat } from '../types.ts';

const MAX_PLAYERS = azul.info.maxPlayers;

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [finalScoringClosed, setFinalScoringClosed] = useState(false);
  const {
    currentPlayer, activePlayers, playerNames, boards, isGameOver, winners, round,
    roundSummary, undoVote, undoAvailable
  } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote;
  const canUndo = undoAvailable && !undoVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const showSummary = roundSummary !== null && !(isGameOver && finalScoringClosed);

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
      <div className="game-screen">
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
