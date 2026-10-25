import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { GAMES } from '../../games/registry.ts';
import { parseMarkdown } from './parseMarkdown.ts';

const text = (value: string) => ({ kind: 'text', text: value });

test('a # line is a heading of that level', () => {
  assert.deepEqual(parseMarkdown('# Title\n### Sub'), [
    { kind: 'heading', level: 1, children: [text('Title')] },
    { kind: 'heading', level: 3, children: [text('Sub')] }
  ]);
});

test('lines join into one paragraph and a blank line starts the next', () => {
  assert.deepEqual(parseMarkdown('one\ntwo\n\nthree'), [
    { kind: 'paragraph', children: [text('one two')] },
    { kind: 'paragraph', children: [text('three')] }
  ]);
});

test('an indented item nests in the item above it', () => {
  assert.deepEqual(parseMarkdown('- a\n  - b\n- c'), [
    {
      kind: 'list', ordered: false, items: [
        [{ kind: 'paragraph', children: [text('a')] }, { kind: 'list', ordered: false, items: [[{ kind: 'paragraph', children: [text('b')] }]] }],
        [{ kind: 'paragraph', children: [text('c')] }]
      ]
    }
  ]);
});

test('a numbered item is an ordered list', () => {
  assert.deepEqual(parseMarkdown('1. x\n2. y'), [
    { kind: 'list', ordered: true, items: [[{ kind: 'paragraph', children: [text('x')] }], [{ kind: 'paragraph', children: [text('y')] }]] }
  ]);
});

test('bold, italic and code spans', () => {
  assert.deepEqual(parseMarkdown('**b** and *i* and `c`'), [
    { kind: 'paragraph', children: [{ kind: 'strong', text: 'b' }, text(' and '), { kind: 'em', text: 'i' }, text(' and '), { kind: 'code', text: 'c' }] }
  ]);
});

test('a link, with parentheses in its address', () => {
  assert.deepEqual(parseMarkdown('[t](u) and [Rook](https://x.org/Rook_(card_game)).'), [
    {
      kind: 'paragraph', children: [
        { kind: 'link', href: 'u', children: [text('t')] },
        text(' and '),
        { kind: 'link', href: 'https://x.org/Rook_(card_game)', children: [text('Rook')] },
        text('.')
      ]
    }
  ]);
});

test('a pipe table gives a header row and body rows, empty cells included', () => {
  assert.deepEqual(parseMarkdown('| A | B |\n| --- | --- |\n| 1 | |\n| **2** | > x |'), [
    { kind: 'table', header: [[text('A')], [text('B')]], rows: [[[text('1')], []], [[{ kind: 'strong', text: '2' }], [text('> x')]]] }
  ]);
});

test('a fenced code block and a horizontal rule', () => {
  assert.deepEqual(parseMarkdown('```\nlet a = 1;\n  b\n```\n---'), [{ kind: 'code', text: 'let a = 1;\n  b' }, { kind: 'rule' }]);
});

test('HTML in the source stays plain text', () => {
  assert.deepEqual(parseMarkdown('<script>x</script>'), [{ kind: 'paragraph', children: [text('<script>x</script>')] }]);
});

test('an unclosed marker is plain text', () => {
  assert.deepEqual(parseMarkdown('a ** b and [c'), [{ kind: 'paragraph', children: [text('a ** b and [c')] }]);
});

test('every game README parses and has a heading', () => {
  for (const game of GAMES) {
    const source = fs.readFileSync(path.join(import.meta.dirname, '../../games', game.info.id, 'README.md'), 'utf8');
    const blocks = parseMarkdown(source);
    assert.ok(blocks.some(block => block.kind === 'heading'), game.info.id);
  }
});
