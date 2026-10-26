import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createVapidKeys, isPushEndpoint, sendPush, vapidHeaders } from './vapid.ts';

const endpoint = 'https://fcm.googleapis.com/fcm/send/abc';

function token(authorization: string): string {
  return /t=([^,]+)/.exec(authorization)![1];
}

function verifies(authorization: string, k: string): boolean {
  const [header, payload, signature] = token(authorization).split('.');
  const point = Buffer.from(k, 'base64url');
  const key = crypto.createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url') },
    format: 'jwk'
  });
  return crypto.verify('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'));
}

test('the VAPID token verifies with its own public key', () => {
  const keys = createVapidKeys();
  const headers = vapidHeaders(keys, endpoint, 'mailto:a@b.c', 1_700_000_000_000);
  const k = /k=(.+)$/.exec(headers.Authorization)![1];
  const point = Buffer.from(k, 'base64url');
  assert.equal(point.length, 65);
  assert.equal(point[0], 0x04);
  assert.equal(k, keys.publicKey);
  assert.equal(verifies(headers.Authorization, k), true);
  const [header, payload] = token(headers.Authorization).split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), { typ: 'JWT', alg: 'ES256' });
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url').toString()), {
    aud: 'https://fcm.googleapis.com', exp: 1_700_043_200, sub: 'mailto:a@b.c'
  });
  assert.equal(headers.TTL, '86400');
  assert.equal(headers.Urgency, 'high');
});

test('a token signed by other keys does not verify', () => {
  const headers = vapidHeaders(createVapidKeys(), endpoint, 'mailto:a@b.c', 1_700_000_000_000);
  assert.equal(verifies(headers.Authorization, createVapidKeys().publicKey), false);
});

test('only known push services are accepted', () => {
  const good = ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x'];
  for (const value of good) assert.equal(isPushEndpoint(value), true, value);
  const bad = ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://evil.com/.googleapis.com', 'https://169.254.169.254/',
    `https://fcm.googleapis.com/${'a'.repeat(1001)}`, 42];
  for (const value of bad) assert.equal(isPushEndpoint(value), false, String(value));
});

test('a gone subscription is reported and a network error is not thrown', async (t) => {
  const respond = (status: number) => async () => new Response(null, { status });
  assert.equal(await sendPush(endpoint, {}, respond(410)), 'gone');
  assert.equal(await sendPush(endpoint, {}, respond(404)), 'gone');
  assert.equal(await sendPush(endpoint, {}, respond(201)), 'sent');
  const logged = t.mock.method(console, 'error', () => {});
  assert.equal(await sendPush(endpoint, {}, async () => { throw new Error('down'); }), 'failed');
  assert.equal(logged.mock.callCount(), 1);
});
