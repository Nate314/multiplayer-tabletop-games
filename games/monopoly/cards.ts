// The 16 Chance and 16 Community Chest cards of the current (2008 and later) US edition
import type { Card, DeckName } from './types.ts';

export const CHANCE: Card[] = [
  { text: 'Advance to Boardwalk', effect: { type: 'advance', to: 39 } },
  { text: 'Advance to GO (Collect $200)', effect: { type: 'advance', to: 0 } },
  { text: 'Advance to Illinois Avenue. If you pass GO, collect $200', effect: { type: 'advance', to: 24 } },
  { text: 'Advance to St. Charles Place. If you pass GO, collect $200', effect: { type: 'advance', to: 11 } },
  {
    text: 'Advance to the nearest Railroad. If unowned, you may buy it from the Bank. If owned, pay the owner twice the rental to which they are otherwise entitled',
    effect: { type: 'nearest', kind: 'railroad' }
  },
  {
    text: 'Advance to the nearest Railroad. If unowned, you may buy it from the Bank. If owned, pay the owner twice the rental to which they are otherwise entitled',
    effect: { type: 'nearest', kind: 'railroad' }
  },
  {
    text: 'Advance to the nearest Utility. If unowned, you may buy it from the Bank. If owned, throw the dice and pay the owner a total ten times the amount thrown',
    effect: { type: 'nearest', kind: 'utility' }
  },
  { text: 'Bank pays you dividend of $50', effect: { type: 'collect', amount: 50 } },
  { text: 'Get Out of Jail Free. This card may be kept until needed or traded', effect: { type: 'jailCard' } },
  { text: 'Go Back 3 Spaces', effect: { type: 'back', spaces: 3 } },
  { text: 'Go to Jail. Go directly to Jail, do not pass GO, do not collect $200', effect: { type: 'goToJail' } },
  { text: 'Make general repairs on all your property. For each house pay $25. For each hotel pay $100', effect: { type: 'repairs', house: 25, hotel: 100 } },
  { text: 'Speeding fine $15', effect: { type: 'pay', amount: 15 } },
  { text: 'Take a trip to Reading Railroad. If you pass GO, collect $200', effect: { type: 'advance', to: 5 } },
  { text: 'You have been elected Chairman of the Board. Pay each player $50', effect: { type: 'payEach', amount: 50 } },
  { text: 'Your building loan matures. Collect $150', effect: { type: 'collect', amount: 150 } }
];

export const COMMUNITY_CHEST: Card[] = [
  { text: 'Advance to GO (Collect $200)', effect: { type: 'advance', to: 0 } },
  { text: 'Bank error in your favor. Collect $200', effect: { type: 'collect', amount: 200 } },
  { text: "Doctor's fee. Pay $50", effect: { type: 'pay', amount: 50 } },
  { text: 'From sale of stock you get $50', effect: { type: 'collect', amount: 50 } },
  { text: 'Get Out of Jail Free. This card may be kept until needed or traded', effect: { type: 'jailCard' } },
  { text: 'Go to Jail. Go directly to Jail, do not pass GO, do not collect $200', effect: { type: 'goToJail' } },
  { text: 'Holiday fund matures. Receive $100', effect: { type: 'collect', amount: 100 } },
  { text: 'Income tax refund. Collect $20', effect: { type: 'collect', amount: 20 } },
  { text: 'It is your birthday. Collect $10 from every player', effect: { type: 'collectEach', amount: 10 } },
  { text: 'Life insurance matures. Collect $100', effect: { type: 'collect', amount: 100 } },
  { text: 'Pay hospital fees of $100', effect: { type: 'pay', amount: 100 } },
  { text: 'Pay school fees of $50', effect: { type: 'pay', amount: 50 } },
  { text: 'Receive $25 consultancy fee', effect: { type: 'collect', amount: 25 } },
  { text: 'You are assessed for street repair. $40 per house. $115 per hotel', effect: { type: 'repairs', house: 40, hotel: 115 } },
  { text: 'You have won second prize in a beauty contest. Collect $10', effect: { type: 'collect', amount: 10 } },
  { text: 'You inherit $100', effect: { type: 'collect', amount: 100 } }
];

export const DECKS: Record<DeckName, Card[]> = { chance: CHANCE, chest: COMMUNITY_CHEST };

export const DECK_NAMES: Record<DeckName, string> = { chance: 'Chance', chest: 'Community Chest' };

export function jailCardIndex(deck: DeckName): number {
  return DECKS[deck].findIndex(card => card.effect.type === 'jailCard');
}
