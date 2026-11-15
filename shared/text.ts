// A count with its noun, e.g. '1 tile', '2 tiles'
export const plural = (count: number, word: string, pluralWord = word + 's'): string =>
  `${count} ${count === 1 ? word : pluralWord}`;

// Words joined as 'A', 'A and B', 'A, B and C'
export const listOf = (words: string[]): string =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
