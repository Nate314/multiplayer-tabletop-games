import assert from 'node:assert/strict'
import { test } from 'node:test'
import { alertSupport, sameKey } from './support.ts'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const desktop = { isSecureContext: true, hasNotification: true, permission: 'default' as const, userAgent: DESKTOP, maxTouchPoints: 0, standalone: false }

test('plain http is insecure even with the Notification API', () => {
  assert.equal(alertSupport({ ...desktop, isSecureContext: false }), 'insecure')
})

test('an iPhone in a Safari tab needs the home screen, and in the home screen app is ready', () => {
  assert.equal(alertSupport({ ...desktop, userAgent: IPHONE, hasNotification: false, maxTouchPoints: 5 }), 'iphoneHomeScreen')
  assert.equal(alertSupport({ ...desktop, userAgent: IPAD, hasNotification: false, maxTouchPoints: 5 }), 'iphoneHomeScreen')
  assert.equal(alertSupport({ ...desktop, userAgent: IPHONE, maxTouchPoints: 5, standalone: true }), 'ready')
  assert.equal(alertSupport({ ...desktop, userAgent: IPAD, maxTouchPoints: 5, standalone: true }), 'ready')
  // A real Mac has no touch points
  assert.equal(alertSupport({ ...desktop, userAgent: IPAD }), 'ready')
})

test('a denied permission is blocked', () => {
  assert.equal(alertSupport({ ...desktop, permission: 'denied' }), 'blocked')
})

test('no Notification API is unsupported', () => {
  assert.equal(alertSupport({ ...desktop, hasNotification: false, permission: undefined }), 'unsupported')
})

test('a subscription made with another server key is not reused', () => {
  assert.equal(sameKey(new Uint8Array([4, 1, 2]).buffer, new Uint8Array([4, 1, 2])), true)
  assert.equal(sameKey(new Uint8Array([4, 1, 3]).buffer, new Uint8Array([4, 1, 2])), false)
  assert.equal(sameKey(new Uint8Array([4, 1]).buffer, new Uint8Array([4, 1, 2])), false)
  assert.equal(sameKey(null, new Uint8Array([4, 1, 2])), false)
})

test('a desktop https browser is ready', () => {
  assert.equal(alertSupport(desktop), 'ready')
  assert.equal(alertSupport({ ...desktop, permission: 'granted' }), 'ready')
})
