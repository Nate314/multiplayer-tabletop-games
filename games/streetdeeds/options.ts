// The house rules of Street Deeds, read from the table state by the rules and the board
import { houseRule, type HouseRule, type ToggleRule } from '../../shared/houseRules.ts';
import type { BaseGameState } from '../../shared/types.ts';

const JACKPOT: ToggleRule = {
  id: 'freeParkingJackpot', label: 'Town Square jackpot', kind: 'toggle', standard: false,
  help: 'Taxes, card fees and the Jail fine go to a pot that whoever lands on Town Square takes'
};
const GO_BONUS: ToggleRule = {
  id: 'goBonus', label: '$400 for landing exactly on Start', kind: 'toggle', standard: false,
  help: 'Landing exactly on Start pays $400 in all, passing it still pays $200'
};
const AUCTIONS: ToggleRule = {
  id: 'auctions', label: 'Auctions', kind: 'toggle', standard: true,
  help: 'Off: a declined property stays with the bank, and a bankrupt player\'s properties go back to it'
};

export const STREETDEEDS_RULES: HouseRule[] = [JACKPOT, GO_BONUS, AUCTIONS];

type Holder = Pick<BaseGameState, 'houseRules'>;
export const freeParkingJackpot = (state: Holder): boolean => houseRule(state, JACKPOT);
export const goBonus = (state: Holder): boolean => houseRule(state, GO_BONUS);
export const auctionsOn = (state: Holder): boolean => houseRule(state, AUCTIONS);
