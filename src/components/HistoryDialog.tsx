import { useState } from 'react';
import useEscapeKey from '../hooks/useEscapeKey';
import type { GameFileStep } from '../../shared/gameFile.ts';
import type { HistoryStep, Seat } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';
import StepErrorBoundary from './StepErrorBoundary';
import { viewOf } from './historyView.ts';

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

// The slider starts on the latest step; start and end steps highlight no move
function HistorySteps({ client, steps }: HistoryStepsProps) {
  const [index, setIndex] = useState(steps.length - 1);
  const [viewer, setViewer] = useState<Seat | null>(null);
  const step = steps[index];
  const moveTotal = steps.filter(s => s.historyStep === 'move').length;
  const view = viewOf(step, viewer);
  const boardState = view.historyStep === 'move' ? view : { ...view, lastMove: null };
  const seatNames = Object.entries(steps[0].playerNames);
  const { HistoryBoard } = client;

  return (
    <>
      <p className="history-move">{stepLabel(client, step, moveTotal)}</p>
      <input
        type="range"
        className="history-slider"
        min={0}
        max={steps.length - 1}
        value={index}
        aria-label="Step"
        autoFocus
        onChange={(e) => setIndex(Number(e.target.value))}
      />
      {steps[0].views && (
        <div className="history-controls">
          <select
            aria-label="View as"
            value={viewer === null ? '' : String(viewer)}
            onChange={(e) => setViewer(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">Table only</option>
            {seatNames.map(([seat, name]) => <option key={seat} value={seat}>{name}</option>)}
          </select>
        </div>
      )}
      <div className="history-board">
        <StepErrorBoundary key={index}>
          <HistoryBoard gameState={boardState} viewer={viewer} />
        </StepErrorBoundary>
      </div>
    </>
  );
}

// The moves as they were when the dialog opened; reopening fetches them again
export default function HistoryDialog({ client, history, title, onClose, onDownload }: HistoryDialogProps) {
  const [downloadFailed, setDownloadFailed] = useState(false);
  useEscapeKey(onClose);

  async function download() {
    setDownloadFailed(false);
    setDownloadFailed(!(await onDownload?.()));
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
            <button type="button" className="primary-button" onClick={download}>Download game</button>
          )}
          <button type="button" className="primary-button" onClick={onClose}>Close</button>
        </div>
        {downloadFailed && <p className="history-move">Could not download the game</p>}
      </div>
    </div>
  );
}
