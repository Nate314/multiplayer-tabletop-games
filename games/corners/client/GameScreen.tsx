import { useEffect, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { PIECES, type Cell } from '../geometry.ts';
import { COLOR_NAMES, cellsOf, legalSpots } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, PublicGameState } from '../types.ts';
import Board from './Board';
import Scores from './Scores';
import Tray from './Tray';
import { anchorOf, flip, keepSpot, spotAt, tapSpot, turn, type Draft } from './placeInput.ts';

function turnMessage({ currentPlayer, playerNames, activePlayers, started, isGameOver, turnColor, owners }: PublicGameState): string {
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2 || currentPlayer == null) return 'Waiting for at least one more player';
  const shared = owners[turnColor] === 'shared' ? ' (shared)' : '';
  const text = `${playerNames[currentPlayer]} places ${COLOR_NAMES[turnColor]}${shared}`;
  return started ? text : `${text}. Joining closes after the first move.`;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { board: kind, currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, moveCount, turnColor, used, gameStatus } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  // The held piece, kept with the move count so any move drops it
  const [held, setHeld] = useState<{ draft: Draft; moveCount: number } | null>(null);
  const draft = isMyTurn && held?.moveCount === moveCount ? held.draft : null;
  const setDraft = (next: Draft | null) => setHeld(next && { draft: next, moveCount });
  const legalFor = (d: Draft) => legalSpots(gameState, turnColor, d.piece, d.orientation);
  const legal = draft ? legalFor(draft) : [];
  const shape = draft ? cellsOf(gameState, draft.piece, draft.orientation, 0, 0) : [];
  const unplayed = PIECES[kind].map((_, piece) => piece).filter(piece => !used[turnColor].includes(piece));

  const reorient = (next: Draft) => setDraft(keepSpot(next, legalFor(next)));

  function place({ piece, orientation, spot }: Draft) {
    if (!spot) return;
    gameService.makeMove({ type: 'place', piece, orientation, ...spot } satisfies Move);
    setDraft(null);
  }

  function handleCell(cell: Cell) {
    if (!draft) return;
    const spot = spotAt(shape, cell, draft, legal);
    if (!spot) return setDraft({ ...draft, spot: null });
    const result = tapSpot(draft, spot, legal);
    if (result.place) place(result.draft);
    else setDraft(result.draft);
  }

  function handleHover(cell: Cell) {
    if (draft) setDraft({ ...draft, spot: spotAt(shape, cell, draft, legal) });
  }

  // Q and E turn, F flips, Escape drops the piece, unless the player is typing or holding a modifier
  useEffect(() => {
    if (!draft) return;
    const d = draft;
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
      const key = event.key.toLowerCase();
      if (key === 'q') reorient(turn(kind, d, -1));
      else if (key === 'e') reorient(turn(kind, d, 1));
      else if (key === 'f') reorient(flip(kind, d));
      else if (key === 'escape') setDraft(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="corners-layout">
      <div className="corners-board-area">
        <Board
          gameState={gameState}
          preview={draft?.spot ? { color: turnColor, cells: cellsOf(gameState, draft.piece, draft.orientation, draft.spot.dx, draft.spot.dy) } : null}
          spots={legal.map(spot => anchorOf(shape, spot))}
          onCell={draft ? handleCell : undefined}
          onHover={draft ? handleHover : undefined}
        />
        <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
      </div>
      <div className="corners-panel">
        {(error || gameStatus) && (
          <div className={error ? 'corners-status corners-status-error' : 'corners-status'}>{error || gameStatus}</div>
        )}
        <div className="corners-turn">{turnMessage(gameState)}</div>
        {isMyTurn && (
          <Tray
            kind={kind}
            color={turnColor}
            pieces={unplayed}
            draft={draft}
            onPick={piece => setDraft(draft?.piece === piece ? null : { piece, orientation: 0, spot: null })}
            onTurn={by => draft && reorient(turn(kind, draft, by))}
            onFlip={() => draft && reorient(flip(kind, draft))}
            onPlace={() => draft && place(draft)}
          />
        )}
        <Scores gameState={gameState} viewer={playerNumber} />
        <div className="corners-buttons">
          <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
        </div>
      </div>
    </div>
  );
}
