// The 16 Fortune and 16 Town Fund cards of Larkhaven. Each index keeps its effect, since saved games name cards by index
import type { Card, DeckName } from './types.ts';

export const CHANCE: Card[] = [
  { text: 'Take the evening air on Skyline Crescent. Advance there', effect: { type: 'advance', to: 39 } },
  { text: 'Head back to Start and collect $200', effect: { type: 'advance', to: 0 } },
  { text: 'Catch a show on Regent Avenue. Advance there, collecting $200 if you pass Start', effect: { type: 'advance', to: 24 } },
  { text: 'Help light the lamps on Lantern Way. Advance there, collecting $200 if you pass Start', effect: { type: 'advance', to: 11 } },
  {
    text: 'Hurry to the nearest station. If nobody owns it, you may buy it from the bank. If someone does, pay them twice the usual rent',
    effect: { type: 'nearest', kind: 'railroad' }
  },
  {
    text: 'Hurry to the nearest station. If nobody owns it, you may buy it from the bank. If someone does, pay them twice the usual rent',
    effect: { type: 'nearest', kind: 'railroad' }
  },
  {
    text: 'Head for the nearest utility. If nobody owns it, you may buy it from the bank. If someone does, roll the dice and pay them ten times the roll',
    effect: { type: 'nearest', kind: 'utility' }
  },
  { text: 'Your shares in the harbor ferry pay out. Collect $50', effect: { type: 'collect', amount: 50 } },
  { text: 'Jail pass. Keep this card until you need it, or trade it', effect: { type: 'jailCard' } },
  { text: 'You took a wrong turn. Go back 3 spaces', effect: { type: 'back', spaces: 3 } },
  { text: 'Go to Jail. Go straight there, without passing Start or collecting $200', effect: { type: 'goToJail' } },
  { text: 'A storm damages your roofs. Pay $25 for each house and $100 for each hotel', effect: { type: 'repairs', house: 25, hotel: 100 } },
  { text: 'A ticket for stopping on the quay. Pay $15', effect: { type: 'pay', amount: 15 } },
  { text: 'Meet the morning ferry at Harbor Station. Collect $200 if you pass Start', effect: { type: 'advance', to: 5 } },
  { text: 'The town council makes you its chair. Pay each player $50', effect: { type: 'payEach', amount: 50 } },
  { text: 'A loan you made to a friend is repaid. Collect $150', effect: { type: 'collect', amount: 150 } }
];

export const COMMUNITY_CHEST: Card[] = [
  { text: 'Ride the tram back to Start. Collect $200', effect: { type: 'advance', to: 0 } },
  { text: 'The bank mixed up two ledgers in your favor. Collect $200', effect: { type: 'collect', amount: 200 } },
  { text: "Dentist's bill. Pay $50", effect: { type: 'pay', amount: 50 } },
  { text: 'You sell your old bicycle. Collect $50', effect: { type: 'collect', amount: 50 } },
  { text: 'Jail pass. Keep this card until you need it, or trade it', effect: { type: 'jailCard' } },
  { text: 'Go to Jail. Go straight there, without passing Start or collecting $200', effect: { type: 'goToJail' } },
  { text: 'Your savings club pays out. Receive $100', effect: { type: 'collect', amount: 100 } },
  { text: 'Your water rates were overcharged. Collect $20', effect: { type: 'collect', amount: 20 } },
  { text: 'The neighbors throw you a birthday party. Collect $10 from every player', effect: { type: 'collectEach', amount: 10 } },
  { text: 'Your savings bond comes due. Collect $100', effect: { type: 'collect', amount: 100 } },
  { text: 'Pay the clinic $100', effect: { type: 'pay', amount: 100 } },
  { text: 'Pay $50 for evening classes', effect: { type: 'pay', amount: 50 } },
  { text: 'You judge the flower show. Receive a $25 fee', effect: { type: 'collect', amount: 25 } },
  { text: 'The town repaves your streets. Pay $40 per house and $115 per hotel', effect: { type: 'repairs', house: 40, hotel: 115 } },
  { text: 'Your pumpkin takes second place at the harvest fair. Collect $10', effect: { type: 'collect', amount: 10 } },
  { text: 'A distant aunt leaves you $100', effect: { type: 'collect', amount: 100 } }
];

export const DECKS: Record<DeckName, Card[]> = { chance: CHANCE, chest: COMMUNITY_CHEST };

export const DECK_NAMES: Record<DeckName, string> = { chance: 'Fortune', chest: 'Town Fund' };

export function jailCardIndex(deck: DeckName): number {
  return DECKS[deck].findIndex(card => card.effect.type === 'jailCard');
}
