// Covers what the game READMEs use: headings, paragraphs, nested lists, pipe tables, code, bold, italic and links.
// The output is a plain tree that Markdown.tsx turns into React elements, so HTML in a README is only ever text.

export type Inline = { kind: 'text' | 'strong' | 'em' | 'code'; text: string } | { kind: 'link'; href: string; children: Inline[] };

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { kind: 'paragraph'; children: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Block[][] }
  | { kind: 'code'; text: string }
  | { kind: 'table'; header: Inline[][]; rows: Inline[][][] }
  | { kind: 'rule' };

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^\s*```/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

export function parseMarkdown(source: string): Block[] {
  return parseBlocks(source.replace(/\r\n?/g, '\n').split('\n'));
}

const indentOf = (line: string) => line.length - line.trimStart().length;
const isTableStart = (lines: string[], i: number) => lines[i].trimStart().startsWith('|') && i + 1 < lines.length && TABLE_DELIMITER.test(lines[i + 1]);
const startsBlock = (lines: string[], i: number) =>
  HEADING.test(lines[i]) || FENCE.test(lines[i]) || RULE.test(lines[i]) || LIST_ITEM.test(lines[i]) || isTableStart(lines, i);

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const heading = HEADING.exec(line);
    if (!line.trim()) {
      i++;
    } else if (FENCE.test(line)) {
      const end = lines.findIndex((next, j) => j > i && FENCE.test(next));
      const close = end === -1 ? lines.length : end;
      blocks.push({ kind: 'code', text: lines.slice(i + 1, close).join('\n') });
      i = close + 1;
    } else if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6, children: parseInline(heading[2].trim()) });
      i++;
    } else if (RULE.test(line)) {
      blocks.push({ kind: 'rule' });
      i++;
    } else if (isTableStart(lines, i)) {
      const header = cells(line);
      const rows: Inline[][][] = [];
      for (i += 2; i < lines.length && lines[i].trimStart().startsWith('|'); i++) rows.push(cells(lines[i]));
      blocks.push({ kind: 'table', header, rows });
    } else if (LIST_ITEM.test(line)) {
      i = parseList(lines, i, blocks);
    } else {
      const paragraph: string[] = [];
      while (i < lines.length && lines[i].trim() && (paragraph.length === 0 || !startsBlock(lines, i))) paragraph.push(lines[i++].trim());
      blocks.push({ kind: 'paragraph', children: parseInline(paragraph.join(' ')) });
    }
  }
  return blocks;
}

// Reads one list from lines[start] and returns the index after it. Lines indented past the marker's column belong to
// the item above, so a nested list is parsed from them recursively
function parseList(lines: string[], start: number, blocks: Block[]): number {
  const first = LIST_ITEM.exec(lines[start])!;
  const base = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items: Block[][] = [];
  let i = start;
  while (i < lines.length) {
    const marker = LIST_ITEM.exec(lines[i]);
    if (!marker || marker[1].length !== base || /\d/.test(marker[2]) !== ordered) break;
    const contentIndent = base + marker[2].length + 1;
    const itemLines = [marker[3]];
    for (i++; i < lines.length; i++) {
      const next = lines[i];
      if (!next.trim()) {
        // A blank line ends the item unless the next text is indented under it
        const after = lines.slice(i + 1).find(rest => rest.trim());
        if (!after || indentOf(after) <= base) break;
        itemLines.push('');
      } else if (indentOf(next) > base) {
        itemLines.push(next.slice(Math.min(indentOf(next), contentIndent)));
      } else if (!startsBlock(lines, i) && itemLines[itemLines.length - 1].trim()) {
        itemLines.push(next); // a lazy continuation of the item's text
      } else {
        break;
      }
    }
    items.push(parseBlocks(itemLines));
    while (i < lines.length && !lines[i].trim()) i++;
  }
  blocks.push({ kind: 'list', ordered, items });
  return i;
}

function cells(row: string): Inline[][] {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => parseInline(cell.trim()));
}

function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  const pushText = (value: string) => {
    const last = out[out.length - 1];
    if (last?.kind === 'text') last.text += value;
    else out.push({ kind: 'text', text: value });
  };
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    if (rest[0] === '\\' && rest.length > 1) {
      pushText(rest[1]);
      i += 2;
      continue;
    }
    if (rest[0] === '`') {
      const end = source.indexOf('`', i + 1);
      if (end > i + 1) {
        out.push({ kind: 'code', text: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (rest.startsWith('**')) {
      const end = source.indexOf('**', i + 2);
      if (end > i + 2) {
        out.push({ kind: 'strong', text: source.slice(i + 2, end) });
        i = end + 2;
      } else {
        pushText('**');
        i += 2;
      }
      continue;
    }
    if (rest[0] === '*' && rest[1] && rest[1] !== ' ') {
      const end = source.indexOf('*', i + 1);
      if (end > i + 1 && source[end - 1] !== ' ') {
        out.push({ kind: 'em', text: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (rest[0] === '[') {
      const link = parseLink(source, i);
      if (link) {
        out.push({ kind: 'link', href: link.href, children: parseInline(link.label) });
        i = link.end;
        continue;
      }
    }
    pushText(rest[0]);
    i++;
  }
  return out;
}

// [label](href), where href may hold balanced parentheses, as Wikipedia addresses do
function parseLink(source: string, start: number): { label: string; href: string; end: number } | null {
  const close = source.indexOf('](', start);
  if (close === -1 || source.slice(start + 1, close).includes('[')) return null;
  let depth = 0;
  for (let j = close + 2; j < source.length; j++) {
    if (source[j] === '(') depth++;
    else if (source[j] === ')' && depth-- === 0) return { label: source.slice(start + 1, close), href: source.slice(close + 2, j).trim(), end: j + 1 };
  }
  return null;
}
