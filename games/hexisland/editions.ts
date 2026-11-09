// Which edition a table plays: the base game, or the 5-6 player extension once five are seated
import { type Board, BASE_BOARD, FIVE_SIX_BOARD } from './board.ts';
import { DEV_DECK, FIVE_SIX_DEV_DECK } from './devCards.ts';
import { BANK_SIZE, FIVE_SIX_BANK_SIZE } from './resources.ts';
import type { DevCard } from './types.ts';
import { FIVE_SIX_FROM } from './options.ts';

export type Edition = { board: Board; bankSize: number; devDeck: DevCard[] };

const BASE: Edition = { board: BASE_BOARD, bankSize: BANK_SIZE, devDeck: DEV_DECK };
const FIVE_SIX: Edition = { board: FIVE_SIX_BOARD, bankSize: FIVE_SIX_BANK_SIZE, devDeck: FIVE_SIX_DEV_DECK };

export const editionFor = (players: number): Edition => players >= FIVE_SIX_FROM ? FIVE_SIX : BASE;
