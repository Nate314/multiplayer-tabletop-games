import { pauseFileName, type PauseFile, type ResumeStatus, type ResumeUpload } from '../../shared/pauseFile.ts';
import type { Seat } from '../../shared/types.ts';
import { deviceId } from './device.ts';
import { downloadJson } from './download.ts';
import type { Session } from './session.ts';

export const RESUME_POLL_MS = 2000;

const NOT_A_PAUSE_FILE = 'This file is not a pause file';
const UNREACHABLE = 'Could not reach the server';

// The server builds the file for the seat's key, or without one for a seat this device holds; null when it could not be fetched
export async function fetchPauseFile(gameType: string, gameId: string, seat: Seat, seatKey?: string): Promise<PauseFile | null> {
  try {
    const response = await fetch(`/api/pause-file/${gameType}/${encodeURIComponent(gameId)}/${seat}`, {
      headers: { Authorization: `Bearer ${seatKey ?? deviceId()}` }
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

// express answers broken JSON and an oversized body with its own page, not JSON, so those read as not a pause file
export async function uploadPauseFile(file: PauseFile): Promise<ResumeUpload | { error: string }> {
  let response: Response;
  try {
    response = await fetch('/api/resume', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file, deviceId: deviceId() })
    });
  } catch {
    return { error: UNREACHABLE };
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && body) return body as ResumeUpload;
  const error = (body as { error?: unknown } | null)?.error;
  return { error: typeof error === 'string' ? error : NOT_A_PAUSE_FILE };
}

// The lobby's progress for a key an upload was given; null once the server no longer knows it
export async function fetchResumeStatus(gameType: string, gameId: string, seatKey: string): Promise<ResumeStatus | null> {
  try {
    const response = await fetch(`/api/resume/${gameType}/${encodeURIComponent(gameId)}`, {
      headers: { Authorization: `Bearer ${seatKey}` }
    });
    if (!response.ok) return null;
    return await response.json() as ResumeStatus;
  } catch {
    return null;
  }
}

// One file rejoins as a player; several from one device rejoin as its pass-and-play seats
export function sessionForResume(uploads: ResumeUpload[]): Session {
  const [first, ...rest] = [...uploads].sort((a, b) => a.seat - b.seat);
  const { gameType, gameId, playerName } = first;
  if (rest.length === 0) return { gameType, gameId, playerName, seatKey: first.seatKey, inGame: true };
  const localSeats = [first, ...rest].map(upload => ({ playerName: upload.playerName, seatKey: upload.seatKey }));
  return { gameType, gameId, playerName, role: 'passAndPlay', localSeats, inGame: true };
}
