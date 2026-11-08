// Old game ids from before the generic renames; the only place they appear.
// `keepsSaves`: a saved state of the old game is still a valid state of the new one.
export type LegacyId = { id: string; keepsSaves: boolean };
export type LegacyIds = Readonly<Record<string, LegacyId>>;

export const LEGACY_IDS: LegacyIds = {
  thecrew: { id: 'missiontricks', keepsSaves: true },
};

export function currentId(id: string, legacy: LegacyIds = LEGACY_IDS): string {
  return Object.hasOwn(legacy, id) ? legacy[id].id : id;
}

export function keepsSaves(id: string, legacy: LegacyIds = LEGACY_IDS): boolean {
  return !Object.hasOwn(legacy, id) || legacy[id].keepsSaves;
}
