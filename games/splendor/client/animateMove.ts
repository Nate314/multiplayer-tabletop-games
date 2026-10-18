import { slideFrom } from '../../../src/animation/motion.ts';
import { CARDS, LEVELS } from '../cards.ts';
import { TOKENS } from '../rules.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { Level, PublicGameState, PublicReserved, Seat, Token, Tokens } from '../types.ts';

export const supplyKey = (token: Token) => `supply-${token}`;
export const deckKey = (level: Level) => `deck-${level}`;
export const cardKey = (card: number) => `card-${card}`;
export const tokenKey = (seat: Seat, token: Token) => `tokens-${seat}-${token}`;
export const bonusKey = (seat: Seat, gem: Token) => `bonus-${seat}-${gem}`;
export const nobleKey = (noble: number) => `noble-${noble}`;

// A reserved card is keyed by its card when the viewer can see it, else by its place
export const reservedKey = (seat: Seat, index: number, held: PublicReserved) =>
  held.card === null ? `reserved-${seat}-${index}` : cardKey(held.card);

type Table = Pick<PublicGameState, 'lastMove' | 'market' | 'players'>;

const tokensIn = (tokens: Tokens) => TOKENS.filter(token => tokens[token] > 0);

// Where each moved piece came from and where it is now, as [from key, to key]
export function slides(previous: Table, next: Table): [string, string][] {
  const move = next.lastMove;
  if (!move) return [];
  const seat = move.seat;
  const result: [string, string][] = [];
  const fromSupply = (token: Token) => result.push([supplyKey(token), tokenKey(seat, token)]);
  const toSupply = (token: Token) => result.push([tokenKey(seat, token), supplyKey(token)]);
  let moved: number | null = null;

  switch (move.type) {
    case 'takeThree': move.colors.forEach(fromSupply); break;
    case 'takeTwo': fromSupply(move.color); break;
    case 'reserve': {
      const reserved = next.players[seat]?.reserved ?? [];
      const index = reserved.length - 1;
      const held = reserved[index];
      if (held) {
        moved = move.card;
        result.push([move.card === null ? deckKey(move.level) : cardKey(move.card), reservedKey(seat, index, held)]);
      }
      if (move.gold) fromSupply('gold');
      break;
    }
    case 'buy':
      moved = move.card;
      result.push([cardKey(move.card), bonusKey(seat, CARDS[move.card].bonus)]);
      tokensIn(move.paid).forEach(toSupply);
      break;
    case 'returnTokens': tokensIn(move.tokens).forEach(toSupply); break;
    default: break;
  }
  if (move.noble !== null) result.push([nobleKey(move.noble), nobleKey(move.noble)]);

  // A refilled slot gets its card from the deck
  for (const level of LEVELS) {
    next.market[level].forEach((card, slot) => {
      if (card !== null && card !== moved && card !== previous.market[level][slot]) result.push([deckKey(level), cardKey(card)]);
    });
  }
  return result;
}

export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  for (const [fromKey, toKey] of slides(previous, next)) {
    const element = root.querySelector(`[data-anim-key="${toKey}"]`);
    const from = rectOf(fromKey);
    if (element && from) slideFrom(element, from);
  }
}
