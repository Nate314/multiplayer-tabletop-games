import { pauseFileName, type PauseFile } from '../../shared/pauseFile.ts';
import type { Seat } from '../../shared/types.ts';
import { deviceId } from './device.ts';
import { downloadJson } from './download.ts';

// The server builds the file for a seat this device holds; null when it could not be fetched
export async function fetchPauseFile(gameType: string, gameId: string, seat: Seat): Promise<PauseFile | null> {
  try {
    const response = await fetch(`/api/pause-file/${gameType}/${encodeURIComponent(gameId)}/${seat}`, {
      headers: { Authorization: `Bearer ${deviceId()}` }
    });
    if (!response.ok) return null;
    return await response.json() as PauseFile;
  } catch {
    return null;
  }
}

export function downloadPauseFile(file: PauseFile): void {
  downloadJson(pauseFileName(file.gameType, file.gameId, file.playerName), file);
}
