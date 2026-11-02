import { useRef, useState, type KeyboardEvent } from 'react';
import gameService from '../../../src/services/gameService';
import Grid from './Grid';
import DigitPad from './DigitPad';
import BoardPicker from './BoardPicker';
import GameStatus from './GameStatus';
import RaceProgress from './RaceProgress';
import { keyToCommand } from './keys.ts';
import useBoardOwner from './useBoardOwner.ts';
import { lastCellOn, modeOfState, shownBoard } from './shown.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);
  const { givens, wrong, myNotes, isGameOver, activePlayers, undoAvailable, undoVote, dismissVote, ownUndo, showMistakes } = gameState;
  const mode = modeOfState(gameState);
  // During play a player's view holds only their own Race board; once a Race is over they can look at the others
  const [owner, pick] = useBoardOwner(gameState, playerNumber);
  const { entries } = shownBoard(gameState, owner);
  const canPlay = !isGameOver && activePlayers.includes(playerNumber) && !undoVote && !dismissVote;
  const target = canPlay && selected !== null && !givens[selected] ? selected : null;
  // A correct Together entry is locked: nobody may write over or erase it
  const locked = mode === 'together' && target !== null && !!entries[target] && !(wrong ?? []).includes(target);

  // Solo enters by moves; Together and Race by actions, as anyone may play at any time
  const sendEntry = (entry: { type: 'enter'; cell: number; digit: number } | { type: 'erase'; cell: number }) =>
    mode === 'solo' ? gameService.makeMove(entry) : gameService.sendAction(entry);

  function digit(d: number) {
    if (target === null || locked) return;
    if (pencil) {
      if (!entries[target]) gameService.sendAction({ type: 'note', cell: target, digit: d }); // a note never goes on an entry
    } else sendEntry({ type: 'enter', cell: target, digit: d });
  }

  function erase() {
    if (target !== null && !locked && entries[target]) sendEntry({ type: 'erase', cell: target });
  }

  // Arrows pass over givens, which cannot be selected, and stop at the edge
  function moveTo(key: string, from: number | null) {
    let cell = from;
    for (let next = keyToCommand(key, cell); next?.kind === 'move' && next.to !== cell; next = keyToCommand(key, cell)) {
      cell = next.to;
      if (!givens[cell]) {
        setSelected(cell);
        layoutRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${cell}"]`)?.focus();
        return;
      }
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement).closest('input, textarea, select')) return;
    const command = keyToCommand(event.key, selected);
    if (!command) return;
    event.preventDefault();
    if (command.kind === 'digit') digit(command.digit);
    else if (command.kind === 'erase') erase();
    else if (command.kind === 'pencil') setPencil(on => !on);
    else moveTo(event.key, selected);
  }

  return (
    <div className="game-layout" ref={layoutRef} onKeyDown={onKeyDown}>
      <div className="board-area">
        <BoardPicker gameState={gameState} owner={owner} onPick={pick} />
        <Grid
          givens={givens}
          entries={entries}
          notes={myNotes ?? []}
          wrong={wrong ?? []}
          selected={selected}
          lastCell={lastCellOn(gameState, owner)}
          onSelect={canPlay ? setSelected : undefined}
        />
      </div>
      <div className="side-panel">
        <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} />
        {mode === 'race' && gameState.boardWrong && (
          <div className="board-wrong" role="status">Your board is full, but something is wrong</div>
        )}
        {mode === 'race' && <RaceProgress progress={gameState.progress} playerNames={gameState.playerNames} viewer={playerNumber} />}
        <DigitPad disabled={target === null || locked} pencil={pencil} canErase={target !== null && !!entries[target]}
          onDigit={digit} onErase={erase} onPencil={() => setPencil(on => !on)} />
        <div className="sudoku-controls">
          {mode === 'solo' ? (
            <>
              <button type="button" aria-pressed={!!showMistakes} disabled={!canPlay}
                onClick={() => gameService.sendAction({ type: 'showMistakes', on: !showMistakes })}>
                Show mistakes
              </button>
              <button type="button" disabled={!canPlay || !undoAvailable} onClick={() => gameService.requestUndo()}>Undo</button>
            </>
          ) : (
            <button type="button" disabled={!canPlay || !ownUndo} onClick={() => gameService.undoOwn()}>Undo my last move</button>
          )}
        </div>
      </div>
    </div>
  );
}
