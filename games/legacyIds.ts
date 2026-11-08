// Old game ids from before the generic renames; the only place they appear.
// `keepsSaves`: a saved state of the old game is still a valid state of the new one.
export type LegacyId = { id: string; keepsSaves: boolean };
export type LegacyIds = Readonly<Record<string, LegacyId>>;

export const LEGACY_IDS: LegacyIds = {
  monopoly: { id: 'streetdeeds', keepsSaves: true },
  tickettoride: { id: 'railroutes', keepsSaves: false },
  azul: { id: 'palacewalls', keepsSaves: true },
  carcassonne: { id: 'roadsandfields', keepsSaves: true },
  catan: { id: 'hexisland', keepsSaves: true },
  connectfour: { id: 'fourinarow', keepsSaves: true },
  jenga: { id: 'blocktower', keepsSaves: true },
  parchisi: { id: 'pachisi', keepsSaves: true },
  quoridor: { id: 'pawnsandwalls', keepsSaves: true },
  rummikub: { id: 'rummytiles', keepsSaves: true },
  scrabble: { id: 'lettergrid', keepsSaves: true },
  splendor: { id: 'jewelguild', keepsSaves: true },
  phase10: { id: 'stagerummy', keepsSaves: true },
  pictionary: { id: 'drawandguess', keepsSaves: true },
  racko: { id: 'inorder', keepsSaves: true },
  rook: { id: 'nest', keepsSaves: true },
  skipbo: { id: 'spiteandmalice', keepsSaves: true },
  uno: { id: 'rainboweights', keepsSaves: true },
  yahtzee: { id: 'fivedice', keepsSaves: true },
  thecrew: { id: 'missiontricks', keepsSaves: true },
  risk: { id: 'territories', keepsSaves: false },
};

export function currentId(id: string, legacy: LegacyIds = LEGACY_IDS): string {
  return Object.hasOwn(legacy, id) ? legacy[id].id : id;
}

export function keepsSaves(id: string, legacy: LegacyIds = LEGACY_IDS): boolean {
  return !Object.hasOwn(legacy, id) || legacy[id].keepsSaves;
}
