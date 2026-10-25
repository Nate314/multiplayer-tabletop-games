// Guess matching and the masked word, shared by the browser and the server; imports no rules code

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s'-]/g, '');
}

export function maskOf(word: string): string {
  return word.replace(/[^ -]/g, '_');
}

// Every contiguous run of the guess's words, joined without separators, so "ice cream" matches "icecream"
function runs(guess: string): string[] {
  const words = guess.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const result: string[] = [];
  for (let start = 0; start < words.length; start++) {
    for (let end = start + 1; end <= words.length; end++) result.push(words.slice(start, end).join(''));
  }
  return result;
}

// Whole words only, so "catapult" does not guess "cat"
export function isCorrect(guess: string, word: string): boolean {
  const target = normalize(word);
  return runs(guess).includes(target);
}

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length];
}

// One letter added, dropped or changed, against the whole guess or any run of its words
export function isClose(guess: string, word: string): boolean {
  if (isCorrect(guess, word)) return false;
  const target = normalize(word);
  return [normalize(guess), ...runs(guess)].some(candidate => distance(candidate, target) === 1);
}
