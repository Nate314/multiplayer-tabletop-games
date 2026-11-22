import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameIdForJoin, newGameId } from './gameId.ts'
import { MAX_GAME_ID_LENGTH } from './types.ts'

test('newGameId is a lowercase version 4 GUID', () => {
  const ids = new Set<string>()
  for (let i = 0; i < 100; i++) {
    const id = newGameId()
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    assert.equal(id.length, MAX_GAME_ID_LENGTH)
    ids.add(id)
  }
  assert.equal(ids.size, 100)
})

test('gameIdForJoin fills a blank ID only for players', () => {
  for (const typed of ['', '   ']) {
    for (const role of ['player', 'passAndPlay'] as const) {
      assert.match(gameIdForJoin(typed, role), /^[0-9a-f-]{36}$/)
    }
    for (const role of ['spectator', 'tableScreen'] as const) {
      assert.equal(gameIdForJoin(typed, role), typed)
    }
  }
  assert.equal(gameIdForJoin('friday', 'player'), 'friday')
})
