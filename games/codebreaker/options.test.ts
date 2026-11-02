import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CODEBREAKER_MODE, codeShape, COLORS } from './options.ts';
import { codebreakerInfo } from './info.ts';
import { afterSeatChange, offeredChoices, standardOf } from '../../shared/houseRules.ts';
import { withRules } from '../../server/testing.ts';

const values = (seats: number) => offeredChoices(CODEBREAKER_MODE, seats, {}).map(choice => choice.value);

test('Solo is the only mode at one seat', () => {
  assert.deepEqual(values(1), ['solo']);
  assert.equal(standardOf(CODEBREAKER_MODE, 1), 'solo');
});

test('Classic is offered and standard at exactly two seats', () => {
  const offered = values(2);
  for (const mode of ['classic', 'together', 'race']) assert.ok(offered.includes(mode), mode);
  assert.ok(!offered.includes('solo'));
  assert.equal(standardOf(CODEBREAKER_MODE, 2), 'classic');
});

test('three seats offer Together and Race, standard Together', () => {
  assert.deepEqual(values(3).sort(), ['race', 'together']);
  assert.equal(standardOf(CODEBREAKER_MODE, 3), 'together');
});

test('Classic kept from two seats falls back when a third joins', () => {
  const rules = withRules({ mode: 'classic', code: '4of6' });
  assert.equal(afterSeatChange(codebreakerInfo, rules, [1, 2, 3]).values.mode, 'together');
  assert.equal(afterSeatChange(codebreakerInfo, rules, [1]).values.mode, 'solo');
});

test('codeShape gives 4 of the first 6 colors or 5 of all 8', () => {
  assert.deepEqual(codeShape('4of6'), { pegs: 4, colors: COLORS.slice(0, 6) });
  assert.deepEqual(codeShape('5of8'), { pegs: 5, colors: [...COLORS] });
});

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

test('no file of the game names the trademark', () => {
  const trademark = new RegExp(['master', 'mind'].join(''), 'i');
  const e2e = 'e2e/codebreaker.spec.ts';
  const files = [...filesUnder('games/codebreaker'), ...(existsSync(e2e) ? [e2e] : [])];
  for (const file of files) assert.ok(!trademark.test(readFileSync(file, 'utf8')), file);
});
