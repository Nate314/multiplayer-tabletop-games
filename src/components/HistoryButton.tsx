import { useCallback, useState, type ReactNode } from 'react';
import HistoryDialog, { type History } from './HistoryDialog';
import { downloadJson } from '../services/download';
import { gameFileName } from '../../shared/gameFile.ts';
import type { BasePublicState, HistoryStep } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';

async function fetchHistory(gameType: string, gameId: string): Promise<History> {
  try {
    const response = await fetch(`/api/history/${gameType}/${encodeURIComponent(gameId)}`);
    if (!response.ok) return { status: 'failed' };
    const { steps } = await response.json() as { steps: HistoryStep[] };
    return { status: 'loaded', steps };
  } catch {
    return { status: 'failed' };
  }
}

// The History dialog and what opens it, so the header button and the game-over screen share one dialog
// eslint-disable-next-line react-refresh/only-export-components -- the hook belongs with its button; fast refresh reloads this file in full
export function useHistoryDialog(gameType: string, gameState: BasePublicState, client: ClientGame): { open: () => void; dialog: ReactNode } {
  const [history, setHistory] = useState<History | null>(null);
  const close = useCallback(() => setHistory(null), []);

  async function open() {
    setHistory({ status: 'loading' });
    const result = await fetchHistory(gameType, gameState.gameId);
    // Closed while loading: stay closed
    setHistory(current => (current?.status === 'loading' ? result : current));
  }

  // The server builds the file; false when it could not be fetched
  async function download(): Promise<boolean> {
    const { gameId } = gameState;
    try {
      const response = await fetch(`/api/game-file/${gameType}/${encodeURIComponent(gameId)}`);
      if (!response.ok) return false;
      downloadJson(gameFileName(gameType, gameId), await response.json());
      return true;
    } catch {
      return false;
    }
  }

  const dialog = history && <HistoryDialog client={client} history={history} title="History" onClose={close} onDownload={download} />;
  return { open, dialog };
}

export default function HistoryButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="history-button" onClick={onOpen}>
      History
    </button>
  );
}
