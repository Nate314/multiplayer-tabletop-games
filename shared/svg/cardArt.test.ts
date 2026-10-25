import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardArtSvg } from './cardArt.ts';

test('each pattern stretches to the card and paints with the --art variables', () => {
  for (const pattern of ['solid', 'stripes', 'bands']) {
    const svg = cardArtSvg(pattern)!;
    assert.match(svg, /^<svg[^>]* viewBox="0 0 100 140" preserveAspectRatio="none"/, pattern);
    assert.match(svg, /var\(--art-fill, #9e9e9e\)/, pattern);
  }
  assert.match(cardArtSvg('stripes')!, /--art-stripe/);
  assert.equal(cardArtSvg('bands')!.match(/<rect/g)?.length, 8);
  assert.match(cardArtSvg('bands')!, /--art-fill-4/);
});

test('an unknown pattern is refused', () => {
  assert.equal(cardArtSvg('plaid'), null);
});
