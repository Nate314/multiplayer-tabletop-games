import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slides } from './animateMove.ts';
import { emptyTokens } from '../rules.ts';
import type { PublicGameState, PublicPlayer } from '../types.ts';

type Table = Pick<PublicGameState, 'lastMove' | 'market' | 'players'>;

const player = (reserved: PublicPlayer['reserved'] = []): PublicPlayer => ({ tokens: emptyTokens(), cards: [], reserved, nobles: [] });
const market = (level1: (number | null)[]): Table['market'] => ({ 1: level1, 2: [40, 41, 42, 43], 3: [70, 71, 72, 73] });

test('taken gems slide from the supply to the player', () => {
  const previous: Table = { lastMove: null, market: market([0, 1, 2, 3]), players: { 1: player() } };
  const next: Table = { ...previous, lastMove: { seat: 1, noble: null, type: 'takeThree', colors: ['red', 'blue', 'black'] } };
  assert.deepEqual(slides(previous, next), [
    ['supply-red', 'tokens-1-red'], ['supply-blue', 'tokens-1-blue'], ['supply-black', 'tokens-1-black']
  ]);
});

test('a bought card slides to its bonus, the payment to the supply, and the refill from the deck', () => {
  const previous: Table = { lastMove: null, market: market([0, 1, 2, 3]), players: { 1: player() } };
  const paid = { ...emptyTokens(), green: 1, gold: 1 };
  const next: Table = { lastMove: { seat: 1, noble: 2, type: 'buy', card: 1, fromReserve: false, paid }, market: market([0, 9, 2, 3]), players: { 1: player() } };
  assert.deepEqual(slides(previous, next), [
    ['card-1', 'bonus-1-white'], ['tokens-1-green', 'supply-green'], ['tokens-1-gold', 'supply-gold'],
    ['noble-2', 'noble-2'], ['deck-1', 'card-9']
  ]);
});

test('a card reserved from a deck slides from the deck to its hidden place', () => {
  const previous: Table = { lastMove: null, market: market([0, 1, 2, 3]), players: { 2: player() } };
  const next: Table = { ...previous, lastMove: { seat: 2, noble: null, type: 'reserve', level: 3, card: null, gold: true }, players: { 2: player([{ level: 3, card: null }]) } };
  assert.deepEqual(slides(previous, next), [['deck-3', 'reserved-2-0'], ['supply-gold', 'tokens-2-gold']]);
});
