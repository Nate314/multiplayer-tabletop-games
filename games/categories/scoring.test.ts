import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerKey, roundPoints, startsWithLetter, verdicts } from './scoring.ts';
import type { Challenge } from './types.ts';

const rejected: Challenge = { category: 0, seat: 3, by: 1, votes: { 1: true, 2: true }, verdict: 'rejected' };
const answers = { 1: ['Banana', 'Bear'], 2: ['a banana', 'Cat'], 3: ['', 'Bison'] };

test('a leading article is ignored for the letter and for duplicates', () => {
  assert.equal(startsWithLetter('The Tiger', 'T'), true);
  assert.equal(startsWithLetter('The Eagle', 'T'), false);
  assert.equal(startsWithLetter('the', 'T'), true);
  assert.equal(answerKey('a dog'), answerKey('Dog'));
  assert.notEqual(answerKey('dogs'), answerKey('dog'));
  assert.equal(answerKey('An Ice-cream'), answerKey('ice cream'));
});

test('verdicts: empty, wrong letter, duplicate, rejected and valid', () => {
  const v = verdicts(answers, [1, 2, 3], 'B', [{ ...rejected, category: 1 }]);
  assert.deepEqual(v, { 1: ['duplicate', 'valid'], 2: ['duplicate', 'wrongLetter'], 3: ['empty', 'rejected'] });
  assert.deepEqual(roundPoints(v), { 1: 1, 2: 0, 3: 0 });
});

test('a wrong-letter answer does not make another a duplicate', () => {
  const v = verdicts({ 1: ['Apple'], 2: ['apple'], 3: ['Berry'] }, [1, 2, 3], 'B', []);
  assert.deepEqual(v, { 1: ['wrongLetter'], 2: ['wrongLetter'], 3: ['valid'] });
  const w = verdicts({ 1: ['Berry'], 2: ['berry '] }, [1, 2], 'B', []);
  assert.deepEqual(w, { 1: ['duplicate'], 2: ['duplicate'] });
});

test('a seat left out of seats neither scores nor duplicates', () => {
  const v = verdicts(answers, [1, 3], 'B', []);
  assert.equal(v[1]?.[0], 'valid');
  assert.equal(v[2], undefined);
});

test('an accented first letter counts as its plain letter, and accents do not make a different answer', () => {
  assert.equal(startsWithLetter('Éclair', 'E'), true);
  assert.equal(startsWithLetter('the Ñandu', 'N'), true);
  assert.equal(answerKey('Éclair'), answerKey('eclair'));
});
