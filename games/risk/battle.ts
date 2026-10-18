// Attacks: rolling the dice, losses, capturing a territory, moving in, and eliminating a player
import { adjacent, territoryName } from './map.ts';
import { TRADE_AFTER_TAKING_AT, takeCards } from './cards.ts';
import { checkGameOver, nameOf, note, plural, territoriesHeld } from './state.ts';
import type { Battle, GameState, Random, Result, Seat } from './types.ts';

export const MAX_ATTACK_DICE = 3;
export const MAX_DEFEND_DICE = 2;
const MAX_BLITZ_ROLLS = 1000; // a blitz always ends; the cap only guards against a broken random

function rollDie(random: Random): number {
  return Math.min(6, Math.floor(random() * 6) + 1);
}

function roll(count: number, random: Random): number[] {
  return Array.from({ length: count }, () => rollDie(random)).sort((a, b) => b - a);
}

// The highest dice are paired off; each pair kills one army of the lower side, and a tie goes to the defender
export function compareDice(attack: number[], defend: number[]): { attackerLost: number; defenderLost: number } {
  let attackerLost = 0;
  let defenderLost = 0;
  for (let i = 0; i < Math.min(attack.length, defend.length); i++) {
    if (attack[i] > defend[i]) defenderLost++;
    else attackerLost++;
  }
  return { attackerLost, defenderLost };
}

export function attackError(state: GameState, seat: Seat, from: string, to: string): string | null {
  if (state.phase !== 'attack') return 'You can attack only in the attack phase';
  if (state.owners[from] !== seat) return 'Attack from a territory you hold';
  if (state.owners[to] === seat) return 'You cannot attack your own territory';
  if (!adjacent(from, to)) return `${territoryName(from)} does not border ${territoryName(to)}`;
  if (state.armies[from] < 2) return 'You need at least 2 armies to attack, as one must stay behind';
  return null;
}

// One roll: the attacker's chosen dice against as many as the defender may roll (at most 2, and no more than its armies)
function rollOnce(state: GameState, seat: Seat, from: string, to: string, dice: number, random: Random): { state: GameState; battle: Battle } {
  const attackDice = roll(dice, random);
  const defendDice = roll(Math.min(MAX_DEFEND_DICE, state.armies[to]), random);
  const { attackerLost, defenderLost } = compareDice(attackDice, defendDice);
  const armies = { ...state.armies, [from]: state.armies[from] - attackerLost, [to]: state.armies[to] - defenderLost };
  const battle: Battle = {
    from, to, attacker: seat, defender: state.owners[to], attackDice, defendDice, attackerLost, defenderLost, rolls: 1,
    conquered: armies[to] === 0
  };
  return { state: { ...state, armies }, battle };
}

function describeBattle(state: GameState, battle: Battle): string {
  const defender = nameOf(state, battle.defender);
  const rolled = battle.rolls === 1
    ? `rolled ${battle.attackDice.join(', ')} against ${battle.defendDice.join(', ')}`
    : `blitzed ${plural(battle.rolls, 'roll')}`;
  return `${nameOf(state, battle.attacker)} attacked ${territoryName(battle.to)} (${defender}) from ${territoryName(battle.from)}, ` +
    `${rolled}: the attacker lost ${battle.attackerLost}, the defender ${battle.defenderLost}`;
}

// A captured territory changes hands; the attacker then moves in. A defender left with no territory is eliminated,
// and their cards go to the attacker.
function capture(state: GameState, battle: Battle, minimum: number): GameState {
  const { from, to, attacker, defender } = battle;
  let next: GameState = {
    ...state,
    owners: { ...state.owners, [to]: attacker },
    phase: 'conquer',
    conquest: { from, to, minimum },
    conqueredThisTurn: true
  };
  next = note(next, `${nameOf(state, attacker)} captured ${territoryName(to)}`);
  if (defender !== null && territoriesHeld(next, defender).length === 0) {
    next = note({ ...next, eliminated: [...next.eliminated, defender] }, `${nameOf(state, defender)} was eliminated`);
    next = takeCards(next, defender, attacker);
  }
  const over = checkGameOver(next);
  // The last capture of the game moves in the dice that won it, so the map shows no empty territory
  if (over.isGameOver) return { ...over, phase: 'attack', armies: { ...over.armies, [from]: over.armies[from] - minimum, [to]: minimum } };
  return over;
}

function finishBattle(state: GameState, battle: Battle, dice: number): GameState {
  const fought = note({ ...state, battle }, describeBattle(state, battle));
  return battle.conquered ? capture(fought, battle, dice) : fought;
}

export function attack(state: GameState, seat: Seat, from: string, to: string, dice: number, random: Random): Result<GameState> {
  const error = attackError(state, seat, from, to);
  if (error) return { error };
  if (!Number.isInteger(dice) || dice < 1 || dice > Math.min(MAX_ATTACK_DICE, state.armies[from] - 1)) {
    return { error: `Roll 1 to ${Math.min(MAX_ATTACK_DICE, state.armies[from] - 1)} dice` };
  }
  const rolled = rollOnce(state, seat, from, to, dice, random);
  return { state: finishBattle(rolled.state, rolled.battle, dice) };
}

// Attacks with the most dice again and again, until the territory falls or only 1 army is left to attack with
export function blitz(state: GameState, seat: Seat, from: string, to: string, random: Random): Result<GameState> {
  const error = attackError(state, seat, from, to);
  if (error) return { error };
  let current = state;
  let total: Battle | null = null;
  let dice = 0;
  for (let rolls = 0; rolls < MAX_BLITZ_ROLLS && current.armies[from] > 1 && current.armies[to] > 0; rolls++) {
    dice = Math.min(MAX_ATTACK_DICE, current.armies[from] - 1);
    const rolled = rollOnce(current, seat, from, to, dice, random);
    current = rolled.state;
    const { battle } = rolled;
    total = total === null ? battle : {
      ...battle,
      attackerLost: total.attackerLost + battle.attackerLost,
      defenderLost: total.defenderLost + battle.defenderLost,
      rolls: total.rolls + 1
    };
  }
  return total ? { state: finishBattle(current, total, dice) } : { error: 'Nothing to attack with' };
}

// Moves armies into the captured territory, at least the dice of the winning roll and all but one at most.
// Holding 6 or more cards after taking an eliminated player's, the attacker must trade them now.
export function occupy(state: GameState, seat: Seat, armies: number): Result<GameState> {
  const { conquest } = state;
  if (state.phase !== 'conquer' || !conquest) return { error: 'There is no captured territory to move into' };
  const most = state.armies[conquest.from] - 1;
  if (!Number.isInteger(armies) || armies < conquest.minimum || armies > most) {
    return { error: `Move ${conquest.minimum === most ? conquest.minimum : `${conquest.minimum} to ${most}`} armies` };
  }
  let next: GameState = {
    ...state,
    armies: { ...state.armies, [conquest.from]: state.armies[conquest.from] - armies, [conquest.to]: armies },
    conquest: null,
    phase: 'attack'
  };
  next = note(next, `${nameOf(state, seat)} moved ${plural(armies, 'army', 'armies')} into ${territoryName(conquest.to)}`);
  if ((next.hands[seat]?.length ?? 0) >= TRADE_AFTER_TAKING_AT) {
    next = note({ ...next, phase: 'reinforce', midTurnTrade: true, reinforcements: 0 }, `${nameOf(state, seat)} must trade cards`);
  }
  return { state: next };
}
