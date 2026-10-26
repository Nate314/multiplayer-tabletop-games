import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reactionLabel, rememberReaction } from './reactions.ts'

const names = { 1: 'Ann', 2: 'Bo' }

test('reactionLabel reads from, arrow, target and emoji, and marks a watching sender', () => {
  const base = { from: 'Ann', fromSpectator: false, target: 2, emoji: '😂', at: 0 }
  assert.equal(reactionLabel(base, names), 'Ann → Bo 😂')
  assert.equal(reactionLabel({ ...base, from: 'Dana', fromSpectator: true }, names), 'Dana (watching) → Bo 😂')
})

test('rememberReaction puts the newest first without repeats and keeps eight', () => {
  assert.deepEqual(rememberReaction(['👍', '😂'], '😂'), ['😂', '👍'])
  const nine = ['🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🍑', '🥝', '🍍']
  assert.equal(nine.reduce<string[]>((list, e) => rememberReaction(list, e), []).length, 8)
})
