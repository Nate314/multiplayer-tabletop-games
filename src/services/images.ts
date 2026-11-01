import type { EmbeddedImages } from '../../shared/gameFile.ts';
import { loadSession } from './session.ts';

const LONGEST_SIDE = 1600;
const QUALITY = 0.85;

// Pictures from a game file opened on the landing page, as data URLs, so they show without the server
const registered = new Map<string, string>();

export function registerImages(images: EmbeddedImages | undefined): void {
  for (const [id, { mime, data }] of Object.entries(images ?? {})) registered.set(id, `data:${mime};base64,${data}`);
}

export function imageUrl(id: string): string {
  return registered.get(id) ?? `/api/images/${encodeURIComponent(id)}`;
}

// A JPEG no longer than LONGEST_SIDE on either side; refuses a file the browser cannot read as a picture
export async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not a picture');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('That picture could not be read');
  return blob;
}

// The seat key comes from the saved session, as a rejoin's does; a pass-and-play device uses its first seat's
export async function uploadImage(gameType: string, gameId: string, blob: Blob): Promise<string> {
  const session = loadSession();
  const same = session?.gameType === gameType && session.gameId === gameId;
  const seatKey = same ? session.seatKey ?? session.localSeats?.[0]?.seatKey : undefined;
  if (!seatKey) throw new Error('Only a player in this game can add a picture');
  const response = await fetch(`/api/images/${gameType}/${encodeURIComponent(gameId)}`, {
    method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg', 'X-Seat-Key': seatKey }, body: blob
  });
  const body = await response.json().catch(() => null) as { id?: unknown; error?: unknown } | null;
  if (response.ok && typeof body?.id === 'string') return body.id;
  throw new Error(typeof body?.error === 'string' ? body.error : 'The picture could not be added');
}
