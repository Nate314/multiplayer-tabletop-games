import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { GAME_INFOS } from '../../games/infos.ts';
import type { ControlItem } from '../clientGames.ts';

for (const { id } of GAME_INFOS) {
  const file = new URL(`../../games/${id}/client/controls.ts`, import.meta.url);
  test(`${id} has a controls file`, () => assert.ok(existsSync(file), id));
  test(`${id} has a well-formed controls list`, async () => {
    const { CONTROLS } = await import(file.href) as { CONTROLS: ControlItem[] };
    assert.ok(CONTROLS.length > 0, id);
    for (const row of CONTROLS) {
      assert.ok(row.action.trim(), id);
      assert.ok(row.pointer?.trim() || row.keys?.trim(), `${id}: ${row.action}`);
      assert.ok(!/—/.test(`${row.action}${row.pointer ?? ''}${row.keys ?? ''}`), `${id}: em-dash`);
    }
    assert.equal(new Set(CONTROLS.map(r => r.action)).size, CONTROLS.length, `${id}: repeated action`);
  });
}
