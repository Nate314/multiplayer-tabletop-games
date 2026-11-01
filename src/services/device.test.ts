import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deviceId, replaceDeviceId } from './device.ts'

function stubStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  const writes: string[] = []
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void (writes.push(key), items.set(key, value)),
    removeItem: (key: string) => void items.delete(key),
  } as unknown as Storage
  return { storage: () => storage, writes }
}

const HEX32 = /^[0-9a-f]{32}$/

test('the ID is 32 hex characters, saved once and reused', () => {
  const { storage, writes } = stubStorage()
  const first = deviceId(storage)
  assert.match(first, HEX32)
  assert.equal(deviceId(storage), first)
  assert.deepEqual(writes, ['multiplayer-tabletop-games:migrated', 'multiplayer-tabletop-games:deviceId'])
})

test('a stored value that is not a valid ID is replaced', () => {
  for (const bad of ['5', '"x"']) {
    const { storage } = stubStorage({ deviceId: bad })
    assert.match(deviceId(storage), HEX32)
  }
})

test('replaceDeviceId makes a new saved ID', () => {
  const { storage } = stubStorage()
  const before = deviceId(storage)
  const after = replaceDeviceId(storage)
  assert.notEqual(after, before)
  assert.equal(deviceId(storage), after)
})

test('with blocked storage the ID stays the same for the page', () => {
  const storage = (() => { throw new Error('blocked') }) as () => Storage
  assert.equal(deviceId(storage), deviceId(storage))
})
