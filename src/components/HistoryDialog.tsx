import { useState } from 'react';
import useEscapeKey from '../hooks/useEscapeKey';
import type { BasePublicState } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';

export type History =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; steps: BasePublicState[] };

type HistoryDialogProps = {
  client: ClientGame;
  history: History;
  onClose: () => void;
};

type HistoryStepsProps = {
  client: ClientGame;
  steps: BasePublicState[];
};

// Step k is the board right after move k; the slider starts on the latest move
function HistorySteps({ client, steps }: HistoryStepsProps) {
  const [moveNumber, setMoveNumber] = useState(steps.length);
  const step = steps[moveNumber - 1];
  const { HistoryBoard } = client;

  return (
    <>
      <p className="history-move">{`Move ${moveNumber} of ${steps.length}: ${client.describeMove(step)}`}</p>
      <input
        type="range"
        className="history-slider"
        min={1}
        max={steps.length}
        value={moveNumber}
        aria-label="Move"
        autoFocus
        onChange={(e) => setMoveNumber(Number(e.target.value))}
      />
      <div className="history-board">
        <HistoryBoard gameState={step} />
      </div>
    </>
  );
}

// The moves as they were when the dialog opened; reopening fetches them again
export default function HistoryDialog({ client, history, onClose }: HistoryDialogProps) {
  useEscapeKey(onClose);

  let body;
  if (history.status === 'loading') {
    body = <p className="history-move">Loading the history...</p>;
  } else if (history.status === 'failed') {
    body = <p className="history-move">Could not load the history</p>;
  } else if (history.steps.length === 0) {
    body = <p className="history-move">No moves yet</p>;
  } else {
    body = <HistorySteps client={client} steps={history.steps} />;
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal history" role="dialog" aria-label="Move history" onClick={(e) => e.stopPropagation()}>
        <h2>History</h2>
        {body}
        <button type="button" className="primary-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
