import { el, svgDoc, type SvgAsset } from './svg.ts';

// A QR code (ISO 18004) drawn in-house so the table screen needs no package: byte mode, error correction level M,
// versions 1 to 10 (up to 213 bytes), which is plenty for a room link

// Per version at level M: error correction codewords per block, then [block count, data codewords per block] groups
const BLOCKS: Record<number, number[][]> = {
  1: [[10], [1, 16]],
  2: [[16], [1, 28]],
  3: [[26], [1, 44]],
  4: [[18], [2, 32]],
  5: [[24], [2, 43]],
  6: [[16], [4, 27]],
  7: [[18], [4, 31]],
  8: [[22], [2, 38], [2, 39]],
  9: [[22], [3, 36], [2, 37]],
  10: [[26], [4, 43], [1, 44]]
};

const ALIGNMENT: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
};

const VERSIONS = Object.keys(BLOCKS).map(Number);

// GF(256) with x^8 + x^4 + x^3 + x^2 + 1
const EXP: number[] = [];
const LOG: number[] = [];
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11D;
}

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[(LOG[a] + LOG[b]) % 255];
}

export function reedSolomon(data: number[], ecLength: number): number[] {
  let generator = [1];
  for (let i = 0; i < ecLength; i++) {
    const next = new Array<number>(generator.length + 1).fill(0);
    generator.forEach((coef, j) => {
      next[j] ^= coef;
      next[j + 1] ^= gfMul(coef, EXP[i]);
    });
    generator = next;
  }
  const rest = new Array<number>(ecLength).fill(0);
  for (const byte of data) {
    const factor = byte ^ rest.shift()!;
    rest.push(0);
    for (let i = 0; i < ecLength; i++) rest[i] ^= gfMul(generator[i + 1], factor);
  }
  return rest;
}

// BCH remainder of `value` (already shifted left by the check length) by `poly`
function bch(value: number, poly: number): number {
  const length = (n: number) => 32 - Math.clz32(n);
  while (length(value) >= length(poly)) value ^= poly << (length(value) - length(poly));
  return value;
}

export function formatBits(mask: number): number {
  const data = mask; // level M is 00
  return ((data << 10) | bch(data << 10, 0x537)) ^ 0x5412;
}

export function versionBits(version: number): number {
  return (version << 12) | bch(version << 12, 0x1F25);
}

function toBits(value: number, length: number): number[] {
  return Array.from({ length }, (_, i) => (value >> (length - 1 - i)) & 1);
}

const dataCapacity = (version: number) => BLOCKS[version].slice(1).reduce((sum, [count, size]) => sum + count * size, 0);

function codewords(bytes: number[], version: number): number[] {
  const capacity = dataCapacity(version);
  const bits = [...toBits(0b0100, 4), ...toBits(bytes.length, version < 10 ? 8 : 16), ...bytes.flatMap(byte => toBits(byte, 8))];
  bits.push(...new Array<number>(Math.min(4, capacity * 8 - bits.length)).fill(0));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xEC; data.length < capacity; pad ^= 0xEC ^ 0x11) data.push(pad);

  const [[ecLength], ...groups] = BLOCKS[version];
  const blocks: number[][] = [];
  let at = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++, at += size) blocks.push(data.slice(at, at + size));
  }
  const ecBlocks = blocks.map(block => reedSolomon(block, ecLength));
  const out: number[] = [];
  for (let i = 0; i < Math.max(...blocks.map(block => block.length)); i++) {
    for (const block of blocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecLength; i++) for (const block of ecBlocks) out.push(block[i]);
  return out;
}

type Grid = boolean[][];

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  r => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => ((((r + c) % 2) + ((r * c) % 3)) % 2) === 0
];

// The modules every mask leaves alone, drawn into `modules`, and `reserved` marks where they (and the format and
// version areas) sit so data skips them
function functionPatterns(version: number, modules: Grid, reserved: Grid): void {
  const size = modules.length;
  const put = (r: number, c: number, dark: boolean) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    modules[r][c] = dark;
    reserved[r][c] = true;
  };
  for (const [r0, c0] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      put(r0 + r, c0 + c, inside && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)));
    }
  }
  const centers = ALIGNMENT[version];
  for (const r0 of centers) for (const c0 of centers) {
    if (reserved[r0][c0]) continue; // under a finder pattern
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) put(r0 + r, c0 + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
  }
  for (let i = 8; i < size - 8; i++) {
    put(6, i, i % 2 === 0);
    put(i, 6, i % 2 === 0);
  }
  put(4 * version + 9, 8, true);
  for (let i = 0; i < 15; i++) { // format areas, filled by writeFormat
    put(i < 6 ? i : i < 8 ? i + 1 : size - 15 + i, 8, false);
    put(8, i < 8 ? size - i - 1 : i < 9 ? 15 - i : 14 - i, false);
  }
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >> i) & 1) === 1;
      put(Math.floor(i / 3), (i % 3) + size - 11, dark);
      put((i % 3) + size - 11, Math.floor(i / 3), dark);
    }
  }
}

function writeFormat(modules: Grid, mask: number): void {
  const size = modules.length;
  const bits = formatBits(mask);
  for (let i = 0; i < 15; i++) {
    const dark = ((bits >> i) & 1) === 1;
    modules[i < 6 ? i : i < 8 ? i + 1 : size - 15 + i][8] = dark;
    modules[8][i < 8 ? size - i - 1 : i < 9 ? 15 - i : 14 - i] = dark;
  }
}

function placeData(modules: Grid, reserved: Grid, words: number[]): void {
  const size = modules.length;
  const bits = words.flatMap(word => toBits(word, 8));
  let next = 0;
  for (let right = size - 1, upward = true; right > 0; right -= 2, upward = !upward) {
    if (right === 6) right--; // the timing column
    for (let i = 0; i < size; i++) {
      const r = upward ? size - 1 - i : i;
      for (const c of [right, right - 1]) {
        if (!reserved[r][c]) modules[r][c] = next < bits.length && bits[next++] === 1;
      }
    }
  }
}

function penalty(modules: Grid): number {
  const size = modules.length;
  let score = 0;
  const line = (at: (i: number) => boolean) => {
    let run = 1;
    for (let i = 1; i < size; i++) {
      run = at(i) === at(i - 1) ? run + 1 : 1;
      if (run === 5) score += 3;
      else if (run > 5) score += 1;
    }
    for (let i = 0; i + 11 <= size; i++) {
      const window = Array.from({ length: 11 }, (_, k) => (at(i + k) ? 1 : 0)).join('');
      if (window === '10111010000' || window === '00001011101') score += 40;
    }
  };
  for (let i = 0; i < size; i++) {
    line(k => modules[i][k]);
    line(k => modules[k][i]);
  }
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (modules[r][c]) dark++;
    if (r + 1 < size && c + 1 < size && modules[r][c] === modules[r][c + 1] && modules[r][c] === modules[r + 1][c] && modules[r][c] === modules[r + 1][c + 1]) score += 3;
  }
  return score + 10 * Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5);
}

export function qrMatrix(text: string): boolean[][] | null {
  const bytes = [...new TextEncoder().encode(text)];
  if (bytes.length === 0) return null;
  const version = VERSIONS.find(v => 4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= dataCapacity(v) * 8);
  if (version === undefined) return null;

  const size = 17 + 4 * version;
  const blank = () => Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const base = blank();
  const reserved = blank();
  functionPatterns(version, base, reserved);
  placeData(base, reserved, codewords(bytes, version));

  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row, r) => row.map((dark, c) => (reserved[r][c] ? dark : dark !== MASKS[mask](r, c))));
    writeFormat(candidate, mask);
    const score = penalty(candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

const QUIET = 4;

export function qrSvg(text: string): string | null {
  const matrix = qrMatrix(text);
  if (!matrix) return null;
  const side = matrix.length + 2 * QUIET;
  const path = matrix.flatMap((row, r) => row.flatMap((dark, c) => (dark ? [`M${c + QUIET} ${r + QUIET}h1v1h-1z`] : []))).join('');
  return svgDoc(`0 0 ${side} ${side}`, { 'shape-rendering': 'crispEdges' },
    el('rect', { width: side, height: side, fill: '#fff' }),
    el('path', { d: path, fill: '#000' }));
}

export const QR_ASSETS: SvgAsset[] = [
  { name: 'qr', params: ['text'], samples: [['https://example.com/join/chess/fun1']], render: ([text]) => qrSvg(text) },
];
