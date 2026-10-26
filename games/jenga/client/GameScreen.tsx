import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import TowerView from './TowerView';
import { usePreview } from './usePreview.ts';
import { across, keySteps, keyboardTarget, nextSelection } from './pullInput.ts';
import { BLOCK, anchorWorld } from '../physics.ts';
import { canPull, openSlots } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Block, Grab, PublicGameState, Seat, Vec3 } from '../types.ts';

const SLOT_NAMES = ['left', 'middle', 'right'] as const;
// The keyboard holds a block by its end, so pulling moves it straight out along its length
const KEY_ANCHOR: Vec3 = [BLOCK.length / 2, 0, 0];

const slotName = (block: Block) => SLOT_NAMES[Math.max(0, Math.min(2, Math.round(across(block) / BLOCK.width) + 1))];
const blockName = (block: Block) => `Level ${block.level + 1}, ${slotName(block)} block`;

function statusLine(state: PublicGameState, me: Seat): string {
  const { loser, isGameOver, activePlayers, currentPlayer, playerNames, phase } = state;
  if (loser !== null) return `${playerNames[loser]} toppled the tower!`;
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for one more player';
  if (currentPlayer === null) return state.gameStatus;
  const mine = currentPlayer === me;
  if (phase === 'place') return mine ? 'Your turn: place your block on top' : `${playerNames[currentPlayer]} is placing a block`;
  return mine ? 'Your turn: pull a block from the tower' : `${playerNames[currentPlayer]}'s turn to pull a block`;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, phase, blocks, sim, toppled } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote && !toppled;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const pulling = isMyTurn && phase === 'pull';
  const [localGrab, setLocalGrab] = useState<Grab | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [steps, setSteps] = useState(0);
  const shown = usePreview(gameState, localGrab);
  // Pointer callbacks fire between renders, so they read the newest state
  const latest = useRef(gameState);
  useEffect(() => {
    latest.current = gameState;
  }, [gameState]);

  const selectedBlock = blocks.find(b => b.id === selected && canPull(gameState, b.id));
  const holding = pulling && selectedBlock !== undefined && gameState.grab?.block === selectedBlock.id;
  // Once the block is out, toppled or the turn moved on, the server has no grab to steer
  const steerable = () => latest.current.phase === 'pull' && !latest.current.toppled;

  const interactive = {
    canGrab: (block: number) => pulling && canPull(gameState, block),
    onGrab(block: number, anchor: Vec3) {
      const target = anchorWorld(latest.current.blocks.find(b => b.id === block)!, anchor);
      setLocalGrab({ block, anchor, target });
      setSelected(block);
      gameService.sendAction({ type: 'grab', block, anchor });
    },
    onDrag(target: Vec3) {
      if (!steerable()) return;
      setLocalGrab(grab => grab && { ...grab, target });
      gameService.sendAction({ type: 'drag', target });
    },
    onRelease() {
      setLocalGrab(null);
      if (steerable()) gameService.sendAction({ type: 'release' });
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!pulling) return;
    const { key } = event;
    if (holding && (key === 'ArrowDown' || key === 'ArrowUp')) {
      const next = keySteps(steps, key === 'ArrowDown' ? 1 : -1);
      setSteps(next);
      gameService.sendAction({ type: 'drag', target: keyboardTarget(selectedBlock, KEY_ANCHOR, next) });
    } else if (holding && key === 'Escape') {
      gameService.sendAction({ type: 'release' });
    } else if (!holding && key.startsWith('Arrow')) {
      setSelected(nextSelection(blocks, selected, key));
    } else if (!holding && (key === 'Enter' || key === ' ') && selectedBlock) {
      setSteps(0);
      gameService.sendAction({ type: 'grab', block: selectedBlock.id, anchor: KEY_ANCHOR });
    } else {
      return;
    }
    event.preventDefault();
  };

  const selection = !pulling ? ''
    : holding ? `${blockName(selectedBlock)}, held. Down arrow pulls it out, Up arrow pushes it back, Escape lets go`
      : selectedBlock ? `${blockName(selectedBlock)}. Enter grabs it` : 'Arrow keys choose a block';
  const open = openSlots(blocks);

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="game-layout">
        <div className="board-area">
          <div className="jenga-controls" role="application" aria-label="Tower" tabIndex={0} onKeyDown={onKeyDown}>
            <TowerView
              blocks={shown}
              highlight={gameState.grab?.block ?? localGrab?.block ?? (pulling ? selected : null)}
              interactive={interactive}
            />
            <div className="jenga-selection" aria-live="polite">{selection}</div>
          </div>
          <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
        </div>
        <div className="side-panel">
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="jenga-status">{statusLine(gameState, playerNumber)}</div>
          {pulling && <div className="hint">Drag a block out with the mouse or a finger; drag empty space to turn the tower</div>}
          {isMyTurn && phase === 'place' && (
            <div className="jenga-place">
              {sim && <div className="hint">Wait for the tower to settle</div>}
              {SLOT_NAMES.map((name, slot) => (
                <button key={name} type="button" disabled={sim !== null || !open.includes(slot as 0 | 1 | 2)}
                  onClick={() => gameService.makeMove({ type: 'place', slot })}>
                  Place on top, {name}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="jenga-undo" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
        </div>
      </div>
    </>
  );
}
