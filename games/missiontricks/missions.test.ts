import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS } from './missions.ts';
import type { Mission } from './types.ts';

const mechanics = (m: Mission) => JSON.stringify([m.number, m.tasks, m.tokens, m.deadSpot ?? null, m.commsFrom ?? null, m.rule ?? null]);

// Each mission's numbers and special rule before the campaign got its own titles and stories
const MECHANICS = [
  '[1,1,[],null,null,null]',
  '[2,2,[],null,null,null]',
  '[3,2,[1,2],null,null,null]',
  '[4,3,[],null,null,null]',
  '[5,0,[],null,null,{"kind":"sick"}]',
  '[6,3,[">",">>"],true,null,null]',
  '[7,3,["omega"],null,null,null]',
  '[8,3,[1,2,3],null,null,null]',
  '[9,0,[],null,null,{"kind":"oneWins","count":1}]',
  '[10,4,[],null,null,null]',
  '[11,4,[1],null,null,{"kind":"mute"}]',
  '[12,4,["omega"],null,null,{"kind":"drawFromRight"}]',
  '[13,0,[],null,null,{"kind":"rocketsWin","ordered":false}]',
  '[14,4,[">",">>",">>>"],true,null,null]',
  '[15,4,[1,2,3,4],null,null,null]',
  '[16,0,[],null,null,{"kind":"noNines"}]',
  '[17,2,[],null,null,{"kind":"noNines"}]',
  '[18,5,[],null,2,null]',
  '[19,5,[1],null,3,null]',
  '[20,2,[],null,null,{"kind":"takesAll"}]',
  '[21,5,[1,2],true,null,null]',
  '[22,5,[">",">>",">>>",">>>>"],null,null,null]',
  '[23,5,[1,2,3,4,5],null,null,{"kind":"swapTokens"}]',
  '[24,6,[],null,null,{"kind":"distribution"}]',
  '[25,6,[">",">>"],true,null,null]',
  '[26,0,[],null,null,{"kind":"oneWins","count":2}]',
  '[27,3,[],null,null,{"kind":"takesAll"}]',
  '[28,6,[1,"omega"],null,3,null]',
  '[29,0,[],true,null,{"kind":"balanced","commanderFirstLast":false}]',
  '[30,6,[">",">>",">>>"],null,2,null]',
  '[31,6,[1,2,3],null,null,null]',
  '[32,7,[],null,null,{"kind":"distribution"}]',
  '[33,0,[],null,null,{"kind":"exactlyOneTrick"}]',
  '[34,0,[],null,null,{"kind":"balanced","commanderFirstLast":true}]',
  '[35,7,[">",">>",">>>"],null,null,null]',
  '[36,7,[1,2],null,null,{"kind":"distribution"}]',
  '[37,4,[],null,null,{"kind":"takesAll"}]',
  '[38,8,[],null,3,null]',
  '[39,8,[">",">>",">>>"],true,null,null]',
  '[40,8,[1,2,3],null,null,{"kind":"moveToken"}]',
  '[41,0,[],null,null,{"kind":"firstAndLastOnly"}]',
  '[42,9,[],null,null,null]',
  '[43,9,[],null,null,{"kind":"distribution"}]',
  '[44,0,[],null,null,{"kind":"rocketsWin","ordered":true}]',
  '[45,9,[">",">>",">>>"],null,null,null]',
  '[46,0,[],null,null,{"kind":"allPink"}]',
  '[47,10,[],null,null,null]',
  '[48,3,["omega"],null,null,{"kind":"omegaInLastTrick"}]',
  '[49,10,[">",">>",">>>"],null,null,null]',
  '[50,0,[],null,null,{"kind":"relay"}]'
];

test('every mission keeps its mechanics', () => {
  assert.deepEqual(MISSIONS.map(mechanics), MECHANICS);
});

test('fifty missions, each with its own title and story', () => {
  assert.equal(MISSIONS.length, 50);
  const titles = MISSIONS.map(m => m.title);
  assert.equal(new Set(titles).size, 50);
  for (const title of titles) assert.ok(title.length > 0 && title.length <= 40, title);
  for (const { number, story } of MISSIONS) {
    const sentences = story.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    assert.ok(sentences >= 1 && sentences <= 3 && story.length <= 240, `mission ${number}: ${story}`);
  }
});

test('no published title or phrase', () => {
  for (const { title, story } of MISSIONS) {
    assert.doesNotMatch(`${title} ${story}`, /planet nine|planet x|quest|the crew/i);
  }
});
