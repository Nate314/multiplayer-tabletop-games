import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSingleEmoji } from './reactions.ts';

test('isSingleEmoji accepts one emoji and nothing else', () => {
  for (const ok of ['😂', '👍🏽', '👨‍👩‍👧', '🏳️‍🌈', '🇺🇸', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '1️⃣', '❤️', '❤']) {
    assert.equal(isSingleEmoji(ok), true, ok);
  }
  for (const bad of ['', 'a', 'hi', '1', '😂😂', '😂 ', '😂a', '🇺', 42, null, '😂'.repeat(20)]) {
    assert.equal(isSingleEmoji(bad), false, String(bad));
  }
});
