import type { Seat } from './types.ts';

export const REACTION_COOLDOWN_MS = 15_000;
export const REACTION_SHOW_MS = 3000;
// shortcut: the log drops its oldest entries past this cap, upgrade if history must keep every reaction
export const MAX_REACTIONS = 200;

export type Reaction = { from: string; fromSpectator: boolean; target: Seat; emoji: string; at: number };
export type RecordedReaction = Reaction & { moveCount: number };

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
// new RegExp because the ES2022 target rejects a /v literal
const RGI_EMOJI = new RegExp('^\\p{RGI_Emoji}$', 'v');
const PICTOGRAPHIC_START = /^\p{Extended_Pictographic}/u;

export function isSingleEmoji(text: unknown): boolean {
  if (typeof text !== 'string' || text.length === 0 || text.length > 32) return false;
  const graphemes = [...segmenter.segment(text)];
  if (graphemes.length !== 1) return false;
  const g = graphemes[0].segment;
  return RGI_EMOJI.test(g) || PICTOGRAPHIC_START.test(g);
}
