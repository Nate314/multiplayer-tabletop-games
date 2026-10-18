import { useState } from 'react';
import useEscapeKey from '../hooks/useEscapeKey';
import type { HistoryStep } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';
import StepErrorBoundary from './StepErrorBoundary';

export type History =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; steps: HistoryStep[] };

type HistoryDialogProps = {
  client: ClientGame;
  history: History;
  title: string;
  onClose: () => void;
  onDownload?: (steps: HistoryStep[]) => void;
};

type HistoryStepsProps = {
  client: ClientGame;
  steps: HistoryStep[];
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
  const step = steps[index];
  const moveTotal = steps.filter(s => s.historyStep === 'move').length;
  const boardState = step.historyStep === 'move' ? step : { ...step, lastMove: null };
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
      <div className="history-board">
        <StepErrorBoundary key={index}>
          <HistoryBoard gameState={boardState} />
        </StepErrorBoundary>
      </div>
    </>
  );
}

// The moves as they were when the dialog opened; reopening fetches them again
export default function HistoryDialog({ client, history, title, onClose, onDownload }: HistoryDialogProps) {
  useEscapeKey(onClose);

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
      <div className="modal history" role="dialog" aria-label="Move history" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {body}
        {canDownload && (
          <button type="button" className="primary-button" onClick={() => onDownload(history.steps)}>Download game</button>
        )}
        <button type="button" className="primary-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
