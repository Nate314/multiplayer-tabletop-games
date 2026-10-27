import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isClose, isCorrect, maskOf, normalize } from './text.ts';

test('normalize lowercases and drops spaces, hyphens and apostrophes', () => {
  assert.equal(normalize("Jack-in-the-Box's Ice Cream"), 'jackintheboxsicecream');
});

test('the mask hides every letter and keeps spaces and hyphens', () => {
  assert.equal(maskOf('ice cream'), '___ _____');
  assert.equal(maskOf('t-shirt'), '_-_____');
});

test('a guess is correct when it contains the word as whole words', () => {
  assert.equal(isCorrect('Ice-Cream', 'ice cream'), true);
  assert.equal(isCorrect('is it castle?', 'castle'), true);
  assert.equal(isCorrect('icecream please', 'ice cream'), true);
  assert.equal(isCorrect('catapult', 'cat'), false);
  assert.equal(isCorrect('dog', 'cat'), false);
});

test('a guess is close when one letter is off', () => {
  assert.equal(isClose('castel', 'castle'), false); // two edits
  assert.equal(isClose('castl', 'castle'), true);
  assert.equal(isClose('casle', 'castle'), true);
  assert.equal(isClose('castle', 'castle'), false);
  assert.equal(isClose('is it castl', 'castle'), true);
});
