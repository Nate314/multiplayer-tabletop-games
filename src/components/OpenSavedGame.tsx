import { useRef, useState, type ChangeEvent } from 'react';
import { parseGameFile, type GameFile } from '../../shared/gameFile.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import ClientGameGate from '../games/ClientGameGate.tsx';
import HistoryDialog from './HistoryDialog';
import { registerImages } from '../services/images.ts';

type OpenSavedGameProps = {
  games: GameInfo[];
};

const NOT_A_GAME_FILE = 'This file is not a saved game';

// Lets a visitor replay a downloaded game file without joining anything
export default function OpenSavedGame({ games }: OpenSavedGameProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<GameFile | null>(null);
  const game = games.find(({ id }) => id === file?.gameType);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    // Lets the same file be picked again
    event.target.value = '';
    if (!picked) return;
    setError(null);
    let text: string;
    try {
      text = await picked.text();
    } catch {
      setError(NOT_A_GAME_FILE);
      return;
    }
    const result = parseGameFile(text, games.map(({ id }) => id));
    if ('error' in result) {
      setError(result.error);
      return;
    }
    registerImages(result.file.images);
    setFile(result.file);
  }

  function close() {
    setFile(null);
    setError(null);
  }

  return (
    <>
      <button type="button" className="open-saved-game" onClick={() => input.current?.click()}>
        Open a saved game
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={pick}
      />
      {error && <div className="lobby-error">{error}</div>}
      {file && game && (
        <ClientGameGate id={game.id} name={game.name}>
          {client => (
            <div data-game={file.gameType}>
              <HistoryDialog
                client={client}
                history={{ status: 'loaded', steps: file.steps }}
                title={`Saved game: ${file.gameId}`}
                onClose={close}
              />
            </div>
          )}
        </ClientGameGate>
      )}
    </>
  );
}
