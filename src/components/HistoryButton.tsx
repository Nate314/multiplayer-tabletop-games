import { useCallback, useState } from 'react';
import HistoryDialog, { type History } from './HistoryDialog';
import type { BasePublicState } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';

type HistoryButtonProps = {
  gameType: string;
  gameState: BasePublicState;
  client: ClientGame;
};

async function fetchHistory(gameType: string, gameId: string): Promise<History> {
  try {
    const response = await fetch(`/api/history/${gameType}/${encodeURIComponent(gameId)}`);
    if (!response.ok) return { status: 'failed' };
    const { steps } = await response.json() as { steps: BasePublicState[] };
    return { status: 'loaded', steps };
  } catch {
    return { status: 'failed' };
  }
}

export default function HistoryButton({ gameType, gameState, client }: HistoryButtonProps) {
  const [history, setHistory] = useState<History | null>(null);
  const close = useCallback(() => setHistory(null), []);

  async function open() {
    setHistory({ status: 'loading' });
    const result = await fetchHistory(gameType, gameState.gameId);
    // Closed while loading: stay closed
    setHistory(current => (current?.status === 'loading' ? result : current));
  }

  return (
    <>
      <button type="button" className="history-button" disabled={gameState.moveCount === 0} onClick={open}>
        History
      </button>
      {history && <HistoryDialog client={client} history={history} onClose={close} />}
    </>
  );
}
