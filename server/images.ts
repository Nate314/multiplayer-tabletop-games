import { randomBytes } from 'node:crypto';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { isImageId, type EmbeddedImages } from '../shared/gameFile.ts';
import type { ImageMime } from './store.ts';

// A picture is shrunk in the browser first (longest side 1600 px, JPEG), so 1 MB is plenty
export const MAX_IMAGE_BYTES = 1024 * 1024;

// Uploads one room may hold, so a seated player cannot fill the disk
export const MAX_ROOM_IMAGES = 20;

export const newImageId = () => randomBytes(16).toString('hex');

// By its leading bytes, never its name or declared type; null for anything but JPEG and PNG
export function imageMime(bytes: Buffer): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'image/png';
  return null;
}

// Each id's image as base64, skipping one the store no longer has
export function embedImages(ids: Iterable<string>, load: (id: string) => { mime: string; bytes: Buffer } | undefined): EmbeddedImages {
  const images: EmbeddedImages = {};
  for (const id of ids) {
    const image = load(id);
    if (image) images[id] = { mime: image.mime, data: image.bytes.toString('base64') };
  }
  return images;
}

// An embedded image from an untrusted file: strict base64, at most MAX_IMAGE_BYTES, and a JPEG or PNG by its bytes; else null
export function decodeImage(image: { data: string }): { mime: ImageMime; bytes: Buffer } | null {
  if (image.data.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) return null;
  const bytes = Buffer.from(image.data, 'base64');
  if (bytes.toString('base64') !== image.data || bytes.length > MAX_IMAGE_BYTES) return null;
  const mime = imageMime(bytes);
  return mime && { mime, bytes };
}

// `uploadImage` answers which refusal it was, so the route can give each its status
export type ImageUploadError = 'no-room' | 'not-seated' | 'not-an-image' | 'too-many';
export type ImageService = {
  uploadImage(gameType: unknown, gameId: unknown, seatKey: unknown, bytes: Buffer): { id: string } | { error: ImageUploadError };
  loadImage(id: string): { mime: string; bytes: Buffer } | undefined;
};

const STATUS: Record<ImageUploadError, number> = { 'no-room': 404, 'not-seated': 403, 'not-an-image': 415, 'too-many': 429 };
const MESSAGES: Record<ImageUploadError | 'too-large', string> = {
  'no-room': 'This game is not available',
  'not-seated': 'Only a player in this game can add a picture',
  'not-an-image': 'Only JPEG and PNG pictures can be added',
  'too-many': 'This game has too many pictures',
  'too-large': 'That picture is larger than 1 MB'
};

export function mountImageRoutes(app: Express, images: ImageService): void {
  const raw = express.raw({ type: ['image/jpeg', 'image/png'], limit: '1mb' }); // '1mb' is MAX_IMAGE_BYTES
  app.post('/api/images/:gameType/:gameId', raw, (req, res) => {
    // Any other type is left unparsed, so the body is not a Buffer
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(415).json({ error: MESSAGES['not-an-image'] });
      return;
    }
    const result = images.uploadImage(req.params.gameType, req.params.gameId, req.header('X-Seat-Key'), req.body);
    if ('id' in result) res.status(201).json(result);
    else res.status(STATUS[result.error]).json({ error: MESSAGES[result.error] });
  });

  // The body parser's own refusals (too large, a broken body) as JSON like every other API error
  const refused: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const status = typeof error?.status === 'number' && error.status >= 400 && error.status < 500 ? error.status : 500;
    res.status(status).json({ error: status === 413 ? MESSAGES['too-large'] : 'The picture could not be added' });
  };
  app.use('/api/images', refused);

  // An id names one image forever, so the browser may keep it
  app.get('/api/images/:id', (req, res) => {
    const image = isImageId(req.params.id) ? images.loadImage(req.params.id) : undefined;
    if (!image) {
      res.status(404).json({ error: 'No such picture' });
      return;
    }
    res.set({ 'Content-Type': image.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
    res.send(image.bytes);
  });
}
