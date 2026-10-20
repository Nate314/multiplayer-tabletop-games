// A count with its noun, e.g. '1 tile', '2 tiles'
export const plural = (count: number, word: string, pluralWord = word + 's'): string =>
  `${count} ${count === 1 ? word : pluralWord}`;
