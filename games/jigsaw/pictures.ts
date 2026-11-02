// The built-in pictures, by name and lobby label. No drawing code, so the rules and the client can import it

export const PICTURES = [
  { name: 'mountains', label: 'Mountain lake' }, { name: 'beach', label: 'Beach' },
  { name: 'fox', label: 'Fox in the woods' }, { name: 'koi', label: 'Koi pond' },
  { name: 'fruit', label: 'Fruit bowl' }, { name: 'pizza', label: 'Pizza' },
  { name: 'quilt', label: 'Patchwork quilt' }, { name: 'balloons', label: 'Hot air balloons' },
] as const;

export type PictureName = (typeof PICTURES)[number]['name'];

export const isPictureName = (name: unknown): name is PictureName => PICTURES.some(picture => picture.name === name);

// 3:2, and every grid (6x4, 8x6, 12x8, 15x10) divides it into whole units
export const PICTURE_W = 1440, PICTURE_H = 960;
