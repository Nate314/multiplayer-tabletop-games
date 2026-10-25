import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { svgUrl, loadSvg, cachedSvg, preloadSvgs, clearSvgCache } from './svgCache.ts';

let calls: string[] = [];
let failing = new Set<string>();
const globals = globalThis as unknown as { fetch: unknown };

beforeEach(() => {
  clearSvgCache();
  calls = [];
  failing = new Set();
  globals.fetch = (url: string) => {
    calls.push(url);
    if (failing.has(url)) return Promise.reject(new Error('offline'));
    return Promise.resolve({ ok: true, text: () => Promise.resolve(`<svg data-url="${url}"/>`) });
  };
});

test('svgUrl encodes each parameter', () => {
  assert.equal(svgUrl('pawn', 'a b', 2), '/api/svg/pawn/a%20b/2');
  assert.equal(svgUrl('icon', 'share'), '/api/svg/icon/share');
});

test('one URL is fetched once, however many ask for it', async () => {
  const [a, b] = await Promise.all([loadSvg('/api/svg/x'), loadSvg('/api/svg/x')]);
  assert.equal(a, b);
  await loadSvg('/api/svg/x');
  assert.deepEqual(calls, ['/api/svg/x']);
});

test('cachedSvg has the markup only once it has loaded', async () => {
  assert.equal(cachedSvg('/api/svg/x'), undefined);
  await loadSvg('/api/svg/x');
  assert.equal(cachedSvg('/api/svg/x'), '<svg data-url="/api/svg/x"/>');
});

test('a failed fetch rejects and is not cached, so a retry fetches again', async () => {
  failing.add('/api/svg/x');
  await assert.rejects(loadSvg('/api/svg/x'));
  failing.clear();
  assert.equal(await loadSvg('/api/svg/x'), '<svg data-url="/api/svg/x"/>');
  assert.equal(calls.length, 2);
});

test('an error status rejects too', async () => {
  globals.fetch = () => Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve('bad') });
  await assert.rejects(loadSvg('/api/svg/x'));
  assert.equal(cachedSvg('/api/svg/x'), undefined);
});

test('preloadSvgs resolves even when one URL fails', async () => {
  failing.add('/api/svg/b');
  await preloadSvgs(['/api/svg/a', '/api/svg/b']);
  assert.ok(cachedSvg('/api/svg/a'));
  assert.equal(cachedSvg('/api/svg/b'), undefined);
});
