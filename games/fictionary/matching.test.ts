import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesDefinition, sameText } from './matching.ts';

const BOAT = 'a small boat rowed with one oar';

test('matchesDefinition accepts the real definition however it is typed', () => {
  const cases: [string, string, boolean][] = [
    [BOAT, BOAT, true],
    ['A Small Boat, rowed with one oar.', BOAT, true],
    ['a smal boat rowed with one oar', BOAT, true],
    ['small boat rowed with one oar', BOAT, true],
    ['it is a small boat rowed with one oar I think', BOAT, true],
    ['a rowing boat for one person', BOAT, false],
    ['a small boat', BOAT, false],
    ['   ', BOAT, false],
    ['a fear of long words', 'a fear of long words, often jokingly', false]
  ];
  for (const [submission, definition, expected] of cases) {
    assert.equal(matchesDefinition(submission, definition), expected, submission);
  }
});

test('sameText ignores capitals, spaces and punctuation', () => {
  assert.equal(sameText('A cheese.', 'a  cheese'), true);
  assert.equal(sameText('a cheese', 'cheeses'), false);
  assert.equal(sameText('!!', '?'), false);
});
