import { useState, type ChangeEvent } from 'react';
import { svgUrl } from '../../../src/assets/svgCache.ts';
import { shrinkImage, uploadImage } from '../../../src/services/images.ts';
import { PICTURES } from '../pictures.ts';
import type { Picture } from '../types.ts';

// The server refuses a picture over 1 MB; a busy photo can still be that big after shrinkImage
const TOO_LARGE = 'larger than 1 MB';
const RETRY_LONGEST_SIDE = 1200;
const RETRY_QUALITY = 0.7;

// A smaller, rougher JPEG of the shrunk picture, for the one retry
async function reencode(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, RETRY_LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const smaller = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', RETRY_QUALITY));
  if (!smaller) throw new Error('That picture could not be read');
  return smaller;
}

async function upload(gameId: string, file: File): Promise<string> {
  const blob = await shrinkImage(file);
  try {
    return await uploadImage('jigsaw', gameId, blob);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(TOO_LARGE)) throw error;
    return uploadImage('jigsaw', gameId, await reencode(blob));
  }
}

// `locked`: play has just started, and the picker only holds its place until the first drag ends
type PicturePickerProps = { gameId: string; picture: Picture; locked: boolean; onPick(picture: Picture): void };

export default function PicturePicker({ gameId, picture, locked, onPick }: PicturePickerProps) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setFailure(null);
    try {
      onPick({ kind: 'photo', id: await upload(gameId, file) });
    } catch (error) {
      setFailure(`Could not use that photo: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
      input.value = '';
    }
  }

  return (
    <div className="jigsaw-picker">
      <div className="jigsaw-thumbs" role="group" aria-label="Choose a picture">
        {PICTURES.map(({ name, label }) => (
          <button
            key={name}
            type="button"
            className="jigsaw-thumb"
            aria-pressed={picture.kind === 'builtin' && picture.name === name}
            disabled={locked}
            onClick={() => onPick({ kind: 'builtin', name })}
          >
            <img src={svgUrl('jigsaw-picture', name)} alt="" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <label className="jigsaw-upload">
        Upload a photo
        <input type="file" accept="image/jpeg,image/png" disabled={busy || locked} onChange={choosePhoto} />
      </label>
      {busy && <p className="jigsaw-note">Adding your photo...</p>}
      {failure && <p className="jigsaw-error" role="alert">{failure}</p>}
    </div>
  );
}
