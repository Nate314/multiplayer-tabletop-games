import type { GameInfo } from './gameDefinition.ts';
import { asRecord } from './messages.ts';
import type { BaseGameState, Result, Seat } from './types.ts';

export type HouseRuleValue = boolean | string | number;
export type HouseRuleValues = Record<string, HouseRuleValue>;
export type PlayerRange = { min: number; max: number };

type HouseRuleBase = {
  id: string; // key in HouseRuleValues, unique within the game
  label: string; // form and dialog label, e.g. 'Free Parking jackpot'
  help?: string; // one line under the control
  // Offered at this seat count and with these other values; omitted means always offered
  offered?(seats: number, values: HouseRuleValues): boolean;
};
export type ToggleRule = HouseRuleBase & { kind: 'toggle'; standard: boolean };
export type ChoiceRule<V extends string | number = string | number> =
  HouseRuleBase & { kind: 'choice'; standard: V; choices: { value: V; label: string }[] };
export type HouseRule = ToggleRule | ChoiceRule;

export type HouseRulesState = {
  host: Seat | null;
  values: HouseRuleValues; // exactly the rules offered at the current seat count
  maxPlayers: number | null; // the table size the host chose, null for the normal maximum
  agreed: Seat[]; // sorted ascending
  revision: number; // bumped by every change; an agreement must name the current one
};
export type HouseRulesProposal = { values: HouseRuleValues; maxPlayers: number | null };
export type HouseRuleLine = { label: string; value: string; standard: boolean };
export type RulesInfo = Pick<GameInfo, 'minPlayers' | 'maxPlayers' | 'houseRules' | 'stretchedPlayers' | 'ownTurnLimit'>;

type RulesHolder = Pick<BaseGameState, 'houseRules'>;

export const TURN_TIMER: ChoiceRule<0 | 30 | 60 | 120 | 300> = {
  id: 'turnTimer', label: 'Turn timer', kind: 'choice', standard: 0,
  help: "A warning only: nobody's turn is skipped.",
  choices: [
    { value: 0, label: 'Off' }, { value: 30, label: '30 seconds' }, { value: 60, label: '1 minute' },
    { value: 120, label: '2 minutes' }, { value: 300, label: '5 minutes' }
  ]
};

// The game's own rules, then the platform turn timer unless the game enforces its own turn limit
export function rulesOf(info: RulesInfo): HouseRule[] {
  return info.ownTurnLimit ? (info.houseRules ?? []) : [...(info.houseRules ?? []), TURN_TIMER];
}

// A game with no rules of its own still starts unprompted while the turn timer is off
export function needsAgreement(info: RulesInfo, values: HouseRuleValues): boolean {
  return (info.houseRules?.length ?? 0) > 0 || info.stretchedPlayers !== undefined || !!values.turnTimer;
}

// The values for `seats`, in declaration order: kept ones from `current`, newly offered ones standard
function normalize(info: RulesInfo, seats: number, current: HouseRuleValues): HouseRuleValues {
  const values: HouseRuleValues = {};
  for (const rule of rulesOf(info)) {
    if (rule.offered && !rule.offered(seats, values)) continue;
    values[rule.id] = rule.id in current ? current[rule.id] : rule.standard;
  }
  return values;
}

// Rooms saved before the checkbox was removed carry `override`; off meant the normal table
function fromStorage(rules: HouseRulesState & { override?: boolean }): HouseRulesState {
  if (!('override' in rules)) return rules;
  const { override, ...rest } = rules;
  return override === false ? { ...rest, maxPlayers: null } : rest;
}

export function houseRulesOf(info: RulesInfo, state: Pick<BaseGameState, 'houseRules' | 'activePlayers'>): HouseRulesState {
  return state.houseRules ? fromStorage(state.houseRules) : {
    host: state.activePlayers[0] ?? null,
    values: normalize(info, state.activePlayers.length, {}),
    maxPlayers: null,
    agreed: [],
    revision: 0
  };
}

export function houseRule(state: RulesHolder, rule: ToggleRule): boolean;
export function houseRule<V extends string | number>(state: RulesHolder, rule: ChoiceRule<V>): V;
export function houseRule(state: RulesHolder, rule: HouseRule): HouseRuleValue {
  return state.houseRules?.values[rule.id] ?? rule.standard;
}

export function tableLimit(info: RulesInfo, state: RulesHolder): number {
  return (state.houseRules && fromStorage(state.houseRules).maxPlayers) ?? info.maxPlayers;
}

// Seating below the normal minimum is a house rule that describeHouseRules lists, so everyone agrees to it
export function minimumToStart(info: RulesInfo): number {
  return info.stretchedPlayers?.min ?? info.minPlayers;
}

function nextHost(host: Seat | null, seats: Seat[]): Seat | null {
  if (host === null || seats.includes(host)) return host ?? seats[0] ?? null;
  return seats.find(seat => seat > host) ?? seats[0] ?? null;
}

export function afterSeatChange(info: RulesInfo, rules: HouseRulesState | undefined, seats: Seat[]): HouseRulesState {
  const current = houseRulesOf(info, { houseRules: rules, activePlayers: seats });
  return {
    ...current,
    host: nextHost(rules?.host ?? null, seats),
    values: normalize(info, seats.length, current.values),
    agreed: [],
    revision: current.revision + 1
  };
}

function allowed(rule: HouseRule, value: unknown): boolean {
  return rule.kind === 'toggle' ? typeof value === 'boolean' : rule.choices.some(choice => choice.value === value);
}

export function setHouseRules<S extends BaseGameState>(info: RulesInfo, state: S, seat: Seat, proposal: unknown): Result<S> {
  if (state.started) return { error: 'The house rules are locked once play starts' };
  const current = houseRulesOf(info, state);
  if (seat !== current.host) return { error: 'Only the host can change the house rules' };
  const input = asRecord(proposal);
  const sent = asRecord(input?.values);
  if (!input || !sent) return { error: 'Invalid house rules' };
  const stretched = info.stretchedPlayers;

  const seated = state.activePlayers.length;
  const merged: HouseRuleValues = { ...current.values, ...(sent as HouseRuleValues) };
  const rules = rulesOf(info);
  for (const key of Object.keys(sent)) {
    const rule = rules.find(candidate => candidate.id === key);
    if (!rule || (rule.offered && !rule.offered(seated, merged))) return { error: 'That is not a house rule of this game' };
    if (!allowed(rule, sent[key])) return { error: `That value is not allowed for ${rule.label}` };
  }

  // A proposal from before the checkbox was removed may still carry `override`; maxPlayers alone decides
  const sentMax = input.maxPlayers === undefined ? current.maxPlayers : input.maxPlayers;
  let maxPlayers: number | null = null;
  if (sentMax !== null) {
    if (!stretched) return { error: 'This game has no player-count house rule' };
    if (typeof sentMax !== 'number' || !Number.isInteger(sentMax) || sentMax < stretched.min || sentMax > stretched.max) {
      return { error: `Most players must be from ${stretched.min} to ${stretched.max}` };
    }
    maxPlayers = sentMax === info.maxPlayers ? null : sentMax;
  }
  if ((maxPlayers ?? info.maxPlayers) < seated) return { error: `${seated} players are already seated` };

  const houseRules: HouseRulesState = {
    ...current,
    values: normalize(info, seated, merged),
    maxPlayers,
    agreed: [],
    revision: current.revision + 1
  };
  return { state: { ...state, houseRules, gameStatus: `${state.playerNames[seat]} changed the house rules` } };
}

export function agreeToHouseRules<S extends BaseGameState>(info: RulesInfo, state: S, seat: Seat, revision: unknown): Result<S> {
  if (state.started) return { error: 'The house rules are locked once play starts' };
  const current = houseRulesOf(info, state);
  if (revision !== current.revision) return { error: 'The house rules changed. Check them and agree again' };
  const agreed = current.agreed.includes(seat) ? current.agreed : [...current.agreed, seat].sort((a, b) => a - b);
  return { state: { ...state, houseRules: { ...current, agreed } } };
}

// True while the table still has to agree to the house rules before it can start
export function agreementPending(info: RulesInfo, state: Pick<BaseGameState, 'houseRules' | 'activePlayers'>): boolean {
  return needsAgreement(info, houseRulesOf(info, state).values) && !everyoneAgreed(info, state);
}

export function everyoneAgreed(info: RulesInfo, state: Pick<BaseGameState, 'houseRules' | 'activePlayers'>): boolean {
  const { agreed } = houseRulesOf(info, state);
  return state.activePlayers.every(seat => agreed.includes(seat));
}

export function describeHouseRules(info: RulesInfo, rules: HouseRulesState, seated: number): HouseRuleLine[] {
  const lines: HouseRuleLine[] = [];
  for (const rule of rulesOf(info)) {
    if (!(rule.id in rules.values)) continue;
    const value = rules.values[rule.id];
    const text = rule.kind === 'toggle'
      ? (value ? 'On' : 'Off')
      : (rule.choices.find(choice => choice.value === value)?.label ?? String(value));
    lines.push({ label: rule.label, value: text, standard: value === rule.standard });
  }
  // Fewer than the stretched minimum is still waiting for players, not a smaller table
  if (seated < info.minPlayers && seated >= minimumToStart(info)) lines.push({ label: 'Players', value: String(seated), standard: false });
  if (rules.maxPlayers !== null && rules.maxPlayers > info.maxPlayers) {
    lines.push({ label: 'Most players', value: String(rules.maxPlayers), standard: false });
  }
  return lines;
}

export function targetScoreRule(standard: number, others: number[], label = 'Target score'): ChoiceRule<number> {
  const values = [...new Set([standard, ...others])].sort((a, b) => a - b);
  return {
    id: 'targetScore', label, kind: 'choice', standard,
    choices: values.map(value => ({ value, label: value.toLocaleString('en-US') }))
  };
}
