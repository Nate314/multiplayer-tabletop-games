// Resource counts: building costs, adding and taking cards, and reading counts from the network
import { asRecord } from '../../shared/messages.ts';
import { RESOURCES } from './board.ts';
import type { Resource, Resources } from './types.ts';

export const BANK_SIZE = 19; // of each resource
export const FIVE_SIX_BANK_SIZE = 24;

export function noResources(): Resources {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
}

export function resources(counts: Partial<Resources>): Resources {
  return { ...noResources(), ...counts };
}

export const COSTS = {
  road: resources({ wood: 1, brick: 1 }),
  settlement: resources({ wood: 1, brick: 1, sheep: 1, wheat: 1 }),
  city: resources({ wheat: 2, ore: 3 }),
  devCard: resources({ sheep: 1, wheat: 1, ore: 1 })
};

export function total(counts: Resources): number {
  return RESOURCES.reduce((sum, resource) => sum + counts[resource], 0);
}

export function add(a: Resources, b: Resources): Resources {
  return resources(Object.fromEntries(RESOURCES.map(resource => [resource, a[resource] + b[resource]])));
}

export function subtract(a: Resources, b: Resources): Resources {
  return resources(Object.fromEntries(RESOURCES.map(resource => [resource, a[resource] - b[resource]])));
}

export function covers(have: Resources, need: Resources): boolean {
  return RESOURCES.every(resource => have[resource] >= need[resource]);
}

export function isResource(value: unknown): value is Resource {
  return RESOURCES.some(resource => resource === value);
}

// Reads whole, non-negative counts of each resource (missing ones are 0), or null if it is not shaped like that
export function parseResources(value: unknown): Resources | null {
  const input = asRecord(value);
  if (!input) return null;
  const counts = noResources();
  for (const resource of RESOURCES) {
    const count = input[resource] ?? 0;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > FIVE_SIX_BANK_SIZE * 5) return null;
    counts[resource] = count;
  }
  return counts;
}

// e.g. '2 wheat and 1 ore', or 'nothing'
export function describeResources(counts: Resources): string {
  const parts = RESOURCES.filter(resource => counts[resource] > 0).map(resource => `${counts[resource]} ${resource}`);
  if (parts.length === 0) return 'nothing';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
