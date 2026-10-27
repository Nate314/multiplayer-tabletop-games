import crypto, { type JsonWebKey } from 'node:crypto';

export type VapidKeys = { publicKey: string; privateJwk: JsonWebKey };

const PUSH_HOSTS = ['.googleapis.com', '.mozilla.com', '.push.apple.com', '.notify.windows.com'];

export function createVapidKeys(): VapidKeys {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const privateJwk = privateKey.export({ format: 'jwk' });
  const point = Buffer.concat([Buffer.from([4]), Buffer.from(privateJwk.x!, 'base64url'), Buffer.from(privateJwk.y!, 'base64url')]);
  return { publicKey: point.toString('base64url'), privateJwk };
}

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

// Importing the key costs more than signing, so it happens once per keys object
const privateKeys = new WeakMap<VapidKeys, crypto.KeyObject>();
function privateKeyOf(keys: VapidKeys): crypto.KeyObject {
  let key = privateKeys.get(keys);
  if (!key) privateKeys.set(keys, key = crypto.createPrivateKey({ key: keys.privateJwk, format: 'jwk' }));
  return key;
}

// The caller adds `Topic`
export function vapidHeaders(keys: VapidKeys, endpoint: string, subject: string, nowMs: number): Record<string, string> {
  const key = privateKeyOf(keys);
  const data = `${encode({ typ: 'JWT', alg: 'ES256' })}.${encode({
    aud: new URL(endpoint).origin, exp: Math.floor(nowMs / 1000) + 12 * 3600, sub: subject
  })}`;
  const signature = crypto.sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' });
  return {
    Authorization: `vapid t=${data}.${signature.toString('base64url')}, k=${keys.publicKey}`,
    TTL: '86400',
    Urgency: 'high'
  };
}

// Checks the parsed hostname, so a lookalike in the path cannot pass
export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && PUSH_HOSTS.some((host) => url.hostname.endsWith(host));
  } catch {
    return false;
  }
}

export async function sendPush(
  endpoint: string, headers: Record<string, string>, fetchImpl: typeof fetch = fetch
): Promise<'sent' | 'gone' | 'failed'> {
  try {
    const response = await fetchImpl(endpoint, { method: 'POST', headers, signal: AbortSignal.timeout(10_000) });
    if (response.status === 404 || response.status === 410) return 'gone';
    if (response.ok) return 'sent';
    // A 403 here usually means the browser subscribed with older VAPID keys
    console.error(`push failed with status ${response.status}`);
    return 'failed';
  } catch (error) {
    console.error('push failed', error);
    return 'failed';
  }
}
