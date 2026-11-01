import { svgUrl } from '../../../src/assets/svgCache.ts';
import { imageUrl } from '../../../src/services/images.ts';
import type { Picture } from '../types.ts';

export function pictureUrl(picture: Picture): string {
  return picture.kind === 'builtin' ? svgUrl('jigsaw-picture', picture.name) : imageUrl(picture.id);
}
