import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { openSeal, sealRoom, shareHash, type SealedRoom } from './pauseSeal.ts';
import type { BaseGameState } from '../shared/types.ts';

const SECRET = 'ace-of-spades-in-seat-two';
const SEATS = [1, 2, 3];

function room(): SealedRoom {
  const state = { phase: 'play', turn: 2, secret: { hands: { 2: [SECRET] } } } as unknown as BaseGameState;
  const before = { phase: 'play', turn: 1, secret: { hands: { 2: [SECRET, 'x'] } } } as unknown as BaseGameState;
  return { state, history: [before], timeline: [before, state] };
}

test('a sealed room opens with every share', () => {
  const { seal, shares } = sealRoom(room(), SEATS);
  assert.deepEqual(openSeal(seal, shares), room());
});

test('no share or pair of shares opens it', () => {
  const { seal, shares } = sealRoom(room(), SEATS);
  for (const seat of SEATS) {
    const missing = { ...shares };
    delete missing[seat];
    assert.equal(openSeal(seal, missing), null);
    assert.equal(openSeal(seal, { ...shares, [seat]: randomBytes(32).toString('base64') }), null);
  }
  for (const a of SEATS) {
    for (const b of SEATS) {
      if (a >= b) continue;
      assert.equal(openSeal(seal, { [a]: shares[a], [b]: shares[b] }), null);
    }
  }
});

test('the sealed data does not show the room', () => {
  const { seal } = sealRoom(room(), SEATS);
  assert.ok(!Buffer.from(seal.data, 'base64').toString('latin1').includes(SECRET));
  assert.ok(!JSON.stringify(seal).includes(SECRET));
});

test('a changed byte is refused', () => {
  const { seal, shares } = sealRoom(room(), SEATS);
  const data = Buffer.from(seal.data, 'base64');
  data[0] ^= 1;
  assert.equal(openSeal({ ...seal, data: data.toString('base64') }, shares), null);
});

test("share hashes name each seat's share", () => {
  const { seal, shares } = sealRoom(room(), SEATS);
  for (const seat of SEATS) assert.equal(seal.shareHashes[seat], shareHash(shares[seat]));
});

test('two seals of one room differ but both open', () => {
  const a = sealRoom(room(), SEATS);
  const b = sealRoom(room(), SEATS);
  assert.notEqual(a.seal.iv, b.seal.iv);
  assert.notEqual(a.seal.data, b.seal.data);
  assert.deepEqual(openSeal(a.seal, a.shares), openSeal(b.seal, b.shares));
});

test('hostile input is refused, never thrown', () => {
  const { seal, shares } = sealRoom(room(), SEATS);
  const bad = [
    { ...seal, iv: 'AAAA' },
    { ...seal, tag: 'AAAA' },
    { ...seal, data: '!!!' },
    { ...seal, fingerprint: 'zz' },
    { ...seal, data: Buffer.from('not deflate').toString('base64') },
  ];
  for (const s of bad) assert.equal(openSeal(s, shares), null);
  assert.equal(openSeal(seal, { ...shares, 1: 'short' }), null);
  assert.equal(openSeal(seal, { ...shares, 1: 42 as unknown as string }), null);
});
