import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import useEscapeKey from '../hooks/useEscapeKey';
import type { GameFileStep } from '../../shared/gameFile.ts';
import type { BasePublicState, HistoryStep, Seat } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';
import StepErrorBoundary from './StepErrorBoundary';
import { reactionsLine, seatOptions, viewFor } from './historyView.ts';
import PlaybackSettings from './PlaybackSettings';
import { nextPlayIndex, stepDelayMs } from './playback.ts';
import type { PlaybackSpeed } from './playback.ts';
import { useMoveAnimation } from '../animation/useMoveAnimation.ts';
import type { MoveChange } from '../animation/useMoveAnimation.ts';
import { loadAnimations, loadHistorySounds, loadPlaybackSpeed, saveAnimations, saveHistorySounds, savePlaybackSpeed } from '../services/settings.ts';
import { fitScale, nextScale } from './fitScale.ts';
import useStateSounds from '../sound/useStateSounds.ts';

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
  const [speed, setSpeed] = useState(loadPlaybackSpeed);
  const [sounds, setSounds] = useState(loadHistorySounds);
  const [playing, setPlaying] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const shownIndexRef = useRef(index);
  const last = steps.length - 1;
  const step = steps[index];
  const moveTotal = steps.filter(s => s.historyStep === 'move').length;
  const { step: view, viewer: shownViewer } = viewFor(step, viewer);
  // The board never reads reactions, and a step's list lacks the moveCount the live log's has
  const { reactions: _reactions, ...boardView } = view;
  const boardState = view.historyStep === 'move' ? boardView : { ...boardView, lastMove: null };
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
  // Only one step forward sounds: a jump over several steps would play the end of the game together with the move
  const advancedByOne = index === shownIndexRef.current + 1;
  useEffect(() => {
    shownIndexRef.current = index;
  }, [index]);
  useStateSounds(boardState, null, sounds && advancedByOne);

  // The board shrinks to fit the box. A step that changes the board's size can only lower the scale, so the board never bounces;
  // only the box changing size (a window resize) starts over. offsetWidth and offsetHeight ignore the scale transform.
  // Written straight to the element, before the browser paints, so the board never shows a frame at the wrong size.
  useLayoutEffect(() => {
    const box = boxRef.current!;
    const content = boardRef.current!;
    let boxSize = '';
    let scale: number | null = null;
    const observer = new ResizeObserver(() => {
      const size = `${box.clientWidth}x${box.clientHeight}`;
      const boxResized = size !== boxSize;
      boxSize = size;
      const fit = fitScale({ width: content.offsetWidth, height: content.offsetHeight }, { width: box.clientWidth, height: box.clientHeight });
      scale = nextScale(scale, fit, boxResized);
      content.style.setProperty('--fit-scale', String(scale));
      content.dataset.fitScale = String(scale);
    });
    observer.observe(box);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Each shown step waits stepDelayMs(speed) before the next, a new speed restarts the current step's wait; moving the slider or the picker keeps playing from there
  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const timeout = setTimeout(() => setIndex(i => i + 1), stepDelayMs(speed));
    return () => clearTimeout(timeout);
  }, [playing, index, last, speed]);

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

  function changeSpeed(next: PlaybackSpeed) {
    setSpeed(next);
    savePlaybackSpeed(next);
}

  function toggleSounds(on: boolean) {
    setSounds(on);
    saveHistorySounds(on);
  }

  return (
    <>
      <p className="history-move">{stepLabel(client, step, moveTotal)}</p>
      <p className="history-reactions">{reactionsLine(step)}</p>
      <div className="history-board" ref={boxRef}>
        <div className="history-board-content" ref={boardRef}>
          <StepErrorBoundary key={`${index}-${viewer}`}>
            <HistoryBoard gameState={boardState} viewer={shownViewer} />
          </StepErrorBoundary>
        </div>
      </div>
      <div className="history-controls">
        <button type="button" className="history-play" onClick={togglePlay}>{playing ? 'Pause' : 'Play'}</button>
        <input
          type="range"
          className="history-slider themed-range"
          min={0}
          max={last}
          value={index}
          aria-label="Step"
          autoFocus
          onChange={(e) => setIndex(Number(e.target.value))}
        />
        <PlaybackSettings
          animations={animations}
          onAnimationsChange={toggleAnimations}
          sounds={sounds}
          onSoundsChange={toggleSounds}
          speed={speed}
          onSpeedChange={changeSpeed}
          viewAs={steps[0].views ? { value: viewer, options: seatNames, onChange: setViewer } : undefined}
        />
      </div>
      {steps[0].views && <p className="history-viewer">Viewing as {seatNames.find(o => String(o.seat) === String(shownViewer))?.name ?? 'Table only'}</p>}
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
    <div className="overlay history-overlay" onClick={onClose}>
      <div className="modal history" role="dialog" aria-label="History" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {body}
        <div className="modal-buttons">
          {canDownload && (
            <button type="button" className="primary-button" disabled={downloading} onClick={download}>Download game</button>
          )}
          <button type="button" className="primary-button" onClick={onClose}>Close</button>
        </div>
        {downloadFailed && <p role="alert" className="history-download-error">Could not download the game</p>}
      </div>
    </div>
  );
}
