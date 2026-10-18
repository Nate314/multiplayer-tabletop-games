import { useCallback, useEffect, useRef, useState } from 'react';
import useEscapeKey from '../hooks/useEscapeKey';
import type { GameFileStep } from '../../shared/gameFile.ts';
import type { BasePublicState, HistoryStep, Seat } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';
import StepErrorBoundary from './StepErrorBoundary';
import { seatOptions, viewFor } from './historyView.ts';
import { PLAY_STEP_MS, nextPlayIndex } from './playback.ts';
import { useMoveAnimation } from '../animation/useMoveAnimation.ts';
import type { MoveChange } from '../animation/useMoveAnimation.ts';
import { loadAnimations, saveAnimations } from '../services/settings.ts';

export type History =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; steps: GameFileStep[] };

type HistoryDialogProps = {
  client: ClientGame;
  history: History;
  title: string;
  onClose: () => void;
  onDownload?: () => Promise<boolean>;
};

type HistoryStepsProps = {
  client: ClientGame;
  steps: GameFileStep[];
};

const STEP_FAILED = 'This step could not be shown';

function stepLabel(client: ClientGame, step: HistoryStep, moveTotal: number): string {
  try {
    if (step.historyStep === 'start') return 'Start of the game';
    if (step.historyStep === 'end') return `End of the game: ${step.gameStatus}`;
    return `Move ${step.moveCount} of ${moveTotal}: ${client.describeMove(step)}`;
  } catch {
    return STEP_FAILED;
  }
}

// The slider starts on the latest step; start and end steps highlight no move.
// One step forward animates when Animations is on; Play steps forward on its own until the last step.
function HistorySteps({ client, steps }: HistoryStepsProps) {
  const [index, setIndex] = useState(steps.length - 1);
  const [viewer, setViewer] = useState<Seat | null>(null);
  const [animations, setAnimations] = useState(loadAnimations);
  const [playing, setPlaying] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const last = steps.length - 1;
  const step = steps[index];
  const moveTotal = steps.filter(s => s.historyStep === 'move').length;
  const { step: view, viewer: shownViewer } = viewFor(step, viewer);
  const boardState = view.historyStep === 'move' ? view : { ...view, lastMove: null };
  const seatNames = seatOptions(steps[0]);
  const { HistoryBoard } = client;

  // A step the game cannot animate snaps instead of breaking the dialog
  const animate = useCallback((change: MoveChange<BasePublicState>) => {
    if (!animations) return;
    try {
      client.animateMove?.(change, shownViewer);
    } catch {
      // the step is already drawn in its place
    }
  }, [client, shownViewer, animations]);
  useMoveAnimation(boardRef, boardState, animate);

  // Each shown step waits PLAY_STEP_MS before the next; moving the slider or the picker keeps playing from there
  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const timeout = setTimeout(() => setIndex(i => i + 1), PLAY_STEP_MS);
    return () => clearTimeout(timeout);
  }, [playing, index, last]);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    setIndex(nextPlayIndex(index, last));
    setPlaying(true);
  }

  function toggleAnimations(on: boolean) {
    setAnimations(on);
    saveAnimations(on);
  }

  return (
    <>
      <p className="history-move">{stepLabel(client, step, moveTotal)}</p>
      <input
        type="range"
        className="history-slider"
        min={0}
        max={last}
        value={index}
        aria-label="Step"
        autoFocus
        onChange={(e) => setIndex(Number(e.target.value))}
      />
      <div className="history-controls">
        <button type="button" className="history-play" onClick={togglePlay}>{playing ? 'Pause' : 'Play'}</button>
        <label className="history-animations">
          <input type="checkbox" checked={animations} onChange={(e) => toggleAnimations(e.target.checked)} /> Animations
        </label>
        {steps[0].views && (
          <select
            aria-label="View as"
            value={viewer === null ? '' : String(viewer)}
            onChange={(e) => setViewer(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">Table only</option>
            {seatNames.map(({ seat, name }) => <option key={seat} value={seat}>{name}</option>)}
          </select>
        )}
      </div>
      <div className="history-board" ref={boardRef}>
        <StepErrorBoundary key={`${index}-${viewer}`}>
          <HistoryBoard gameState={boardState} viewer={shownViewer} />
        </StepErrorBoundary>
      </div>
    </>
  );
}

// The moves as they were when the dialog opened; reopening fetches them again
export default function HistoryDialog({ client, history, title, onClose, onDownload }: HistoryDialogProps) {
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  useEscapeKey(onClose);

  async function download() {
    setDownloadFailed(false);
    setDownloading(true);
    try {
      setDownloadFailed(!(await onDownload?.()));
    } finally {
      setDownloading(false);
    }
  }

  const canDownload = onDownload && history.status === 'loaded' && history.steps.at(-1)?.isGameOver === true;

  let body;
  if (history.status === 'loading') {
    body = <p className="history-move">Loading the history...</p>;
  } else if (history.status === 'failed') {
    body = <p className="history-move">Could not load the history</p>;
  } else {
    body = <HistorySteps client={client} steps={history.steps} />;
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal history" role="dialog" aria-label="History" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {body}
        <div className="modal-buttons">
          {canDownload && (
            <button type="button" className="primary-button" disabled={downloading} onClick={download}>Download game</button>
          )}
          <button type="button" className="primary-button" onClick={onClose}>Close</button>
        </div>
        {downloadFailed && <p className="history-move">Could not download the game</p>}
      </div>
    </div>
  );
}
