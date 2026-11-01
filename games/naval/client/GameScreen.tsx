import { useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import DrawAndResign from '../../../src/components/DrawAndResign';
import { houseRule } from '../../../shared/houseRules.ts';
import { cellName } from '../fleet.ts';
import { SALVO } from '../options.ts';
import { shotsAllowed } from '../rules.ts';
import Grid from './Grid';
import GameStatus from './GameStatus';
import Placement from './Placement';
import { opponentOf, shipsOf, shotsAt } from './sea.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Action, Cell, Move, PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { phase, myFleet, ready, currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, moveCount } = gameState;
  // Salvo targets marked this turn; a mark made before the last move no longer counts
  const [marks, setMarks] = useState<{ moveCount: number; cells: Cell[] }>({ moveCount, cells: [] });
  const marked = marks.moveCount === moveCount ? marks.cells : [];

  const seated = activePlayers.includes(playerNumber);
  const other = opponentOf(playerNumber);
  const voting = Boolean(undoVote || dismissVote);
  const isMyTurn = phase === 'firing' && currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !voting;
  const canUndo = undoAvailable && !voting && seated && activePlayers.length >= 2;
  const salvo = houseRule(gameState, SALVO);
  const allowed = shotsAllowed(gameState, playerNumber);
  const fired = new Set(gameState.shots[playerNumber].map(cellName));

  const fire = (targets: Cell[]) => {
    gameService.makeMove({ type: 'fire', targets } satisfies Move);
    setMarks({ moveCount, cells: [] });
  };

  function onTarget(cell: Cell) {
    if (fired.has(cellName(cell))) return;
    if (!salvo) { fire([cell]); return; }
    const name = cellName(cell);
    const without = marked.filter(c => cellName(c) !== name);
    if (without.length < marked.length) setMarks({ moveCount, cells: without });
    else if (marked.length < allowed) setMarks({ moveCount, cells: [...marked, cell] });
  }

  const placing = phase === 'placing' && !isGameOver;
  const waitingFor = activePlayers.filter(seat => !ready.includes(seat));

  return (
    <div className="game-layout">
      <div className="board-area">
        {placing && !myFleet && seated ? (
          <Placement onConfirm={ships => gameService.sendAction({ type: 'place', ships } satisfies Action)} />
        ) : (
          <div className="naval-seas">
            <section className="sea">
              <h3 className="sea-title">Your fleet</h3>
              <Grid label="Your fleet" ships={shipsOf(gameState, playerNumber, playerNumber)} shots={shotsAt(gameState, playerNumber)} />
              {placing && waitingFor.map(seat => <div key={seat} className="sea-waiting">{`Waiting for ${playerNames[seat]}`}</div>)}
            </section>
            {!placing && (
              <section className="sea">
                <h3 className="sea-title">Target</h3>
                <Grid
                  label="Target"
                  ships={shipsOf(gameState, other, playerNumber)}
                  shots={shotsAt(gameState, other)}
                  cells={marked}
                  onCell={isMyTurn ? onTarget : undefined}
                />
                {salvo && isMyTurn && (
                  <button type="button" className="fire-button" disabled={marked.length !== allowed} onClick={() => fire(marked)}>
                    {`Fire (${marked.length} of ${allowed})`}
                  </button>
                )}
              </section>
            )}
          </div>
        )}
        <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
      </div>
      <div className="side-panel">
        <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} />
        <DrawAndResign gameState={gameState} playerNumber={playerNumber} onAction={(action) => gameService.sendAction(action)}>
          <button type="button" title="Ask to undo" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
            Undo
          </button>
        </DrawAndResign>
      </div>
    </div>
  );
}
