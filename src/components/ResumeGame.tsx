import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { parsePauseFile, type PauseFile, type ResumeUpload } from '../../shared/pauseFile.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { uploadPauseFile } from '../services/pauseFiles.ts';
import type { Session } from '../services/session.ts';
import ResumeWaitingRoom from './ResumeWaitingRoom';

type ResumeGameProps = {
  games: GameInfo[];
  onReady: (session: Session) => void;
};

const NOT_A_PAUSE_FILE = 'This file is not a pause file';
const DIFFERENT_GAMES = 'These files are from different games';
// The server's own cap on an upload; a bigger file is refused unread
const MAX_FILE_BYTES = 20 * 1024 * 1024;

async function readPauseFile(picked: File, gameTypes: string[]): Promise<{ file: PauseFile } | { error: string }> {
  if (picked.size > MAX_FILE_BYTES) return { error: NOT_A_PAUSE_FILE };
  try {
    return parsePauseFile(await picked.text(), gameTypes);
  } catch {
    return { error: NOT_A_PAUSE_FILE };
  }
}

// Brings back a game the server lost: this device's pause files go up, then everyone waits for the rest of the table
export default function ResumeGame({ games, onReady }: ResumeGameProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<ResumeUpload[] | null>(null);
  const game = games.find(({ id }) => id === uploads?.[0].gameType);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const picked = [...event.target.files ?? []];
    // Lets the same files be picked again
    event.target.value = '';
    if (picked.length === 0) return;
    setError(null);
    const files: PauseFile[] = [];
    for (const one of picked) {
      const result = await readPauseFile(one, games.map(({ id }) => id));
      if ('error' in result) {
        setError(result.error);
        return;
      }
      files.push(result.file);
    }
    if (files.some(file => file.gameType !== files[0].gameType || file.gameId !== files[0].gameId)) {
      setError(DIFFERENT_GAMES);
      return;
    }
    // Uploads that went in keep their seats, so the waiting room still opens for them
    const done: ResumeUpload[] = [];
    for (const file of files) {
      const result = await uploadPauseFile(file);
      // A good answer carries the lobby's own error field too, so it is told apart by its key
      if (!('seatKey' in result)) {
        setError(result.error);
        break;
      }
      done.push(result);
    }
    if (done.length > 0) setUploads(done);
  }

  // Stable, so the waiting room's polling and Escape key are not reset on every render
  const ready = useCallback((session: Session) => {
    setUploads(null);
    onReady(session);
  }, [onReady]);
  const cancel = useCallback(() => setUploads(null), []);

  return (
    <>
      <button type="button" className="open-saved-game" onClick={() => input.current?.click()}>
        Resume a game
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        onChange={pick}
      />
      {error && <div className="lobby-error">{error}</div>}
      {uploads && game && (
        <ResumeWaitingRoom game={game} uploads={uploads} onReady={ready} onCancel={cancel} />
      )}
    </>
  );
}
