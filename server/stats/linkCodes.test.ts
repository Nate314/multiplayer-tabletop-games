import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLinkCodes, LINK_CODE_TTL_MS } from './linkCodes.ts';

const CODE = /^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{4}$/;

test('a code is seven letters and digits that cannot be misread, in two groups', () => {
  const codes = createLinkCodes();
  for (let i = 0; i < 50; i++) assert.match(codes.issue(`hash${i}`).code, CODE);
});

test('a code is redeemed once, whatever its case and dashes', () => {
  const values = [...'K7P4QX2'].map(c => ('23456789ABCDEFGHJKMNPQRSTUVWXYZ'.indexOf(c) + 0.5) / 31);
  const codes = createLinkCodes(() => 0, () => values.shift() ?? 0);
  assert.deepEqual(codes.issue('owner'), { code: 'K7P-4QX2', expiresAt: LINK_CODE_TTL_MS });
  assert.equal(codes.redeem('k7p4qx2'), 'owner');
  assert.equal(codes.redeem('K7P-4QX2'), null);
});

test('a code expires after 10 minutes, and junk is no code', () => {
  const clock = { now: 0 };
  const codes = createLinkCodes(() => clock.now);
  const { code } = codes.issue('owner');
  clock.now = LINK_CODE_TTL_MS;
  assert.equal(codes.redeem(code), null);
  for (const junk of [undefined, 42, '', 'nope', { code }]) assert.equal(codes.redeem(junk), null);
  const fresh = codes.issue('owner');
  clock.now += LINK_CODE_TTL_MS - 1;
  assert.equal(codes.redeem(fresh.code), 'owner');
});
