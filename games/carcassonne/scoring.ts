// Scoring, by the current official rules: a feature goes to the players with the most meeples on it, ties all scoring in full.
// Completed during play: road 1 a tile, city 2 a tile and 2 a pennant, monastery 9.
// At the end: road 1 a tile, city 1 a tile and 1 a pennant, monastery 1 and 1 for each tile around it,
// and a field 3 for each completed city it borders.
import { analyze, isComplete } from './board.ts';
import type { Feature, Features } from './board.ts';
import type { FeatureKind, FinalScores, Placement, ScoreEvent, Seat } from './types.ts';

// The players with the most meeples on a feature; meeples of players no longer in the game count for nobody
export function majority(meeples: Seat[], players: Seat[]): Seat[] {
  const counts = new Map<Seat, number>();
  for (const seat of meeples) if (players.includes(seat)) counts.set(seat, (counts.get(seat) ?? 0) + 1);
  const most = Math.max(0, ...counts.values());
  return most === 0 ? [] : [...counts].filter(([, count]) => count === most).map(([seat]) => seat).sort((a, b) => a - b);
}

export function featurePoints(feature: Feature, complete: boolean, features: Features): number {
  switch (feature.kind) {
    case 'road': return feature.tiles.length;
    case 'city': return (complete ? 2 : 1) * (feature.tiles.length + feature.pennants);
    case 'monastery': return 9 - feature.openEdges;
    case 'field': return 3 * feature.cities.filter(id => isComplete(features.list[id])).length;
  }
}

function event(feature: Feature, complete: boolean, features: Features, players: Seat[]): ScoreEvent {
  return {
    kind: feature.kind,
    complete,
    tiles: feature.tiles.length,
    points: featurePoints(feature, complete, features),
    seats: majority(feature.meeples, players),
    meeples: [...feature.meeples].sort((a, b) => a - b)
  };
}

function addPoints(scores: Record<Seat, number>, events: ScoreEvent[]): Record<Seat, number> {
  const next = { ...scores };
  for (const { seats, points } of events) for (const seat of seats) next[seat] = (next[seat] ?? 0) + points;
  return next;
}

// Takes the meeples off every listed feature, back to their players
function returnMeeples(board: Placement[], scored: Feature[]): Placement[] {
  const freed = new Set(scored.flatMap(feature => feature.parts
    .filter(({ tile, index }) => board[tile].meeple?.feature.kind === feature.kind && board[tile].meeple?.feature.index === index)
    .map(({ tile }) => tile)));
  return board.map((placement, index) => (freed.has(index) ? { ...placement, meeple: null } : placement));
}

// After the tile at `tile` and its meeple are placed: every city, road and monastery that tile completed scores now,
// for features with meeples on them, and those meeples go back
export function scoreCompleted(
  board: Placement[], scores: Record<Seat, number>, tile: number, players: Seat[]
): { board: Placement[]; scores: Record<Seat, number>; events: ScoreEvent[] } {
  const features = analyze(board);
  const placed = board[tile];
  const touched = features.list.filter(feature => {
    if (feature.kind === 'field' || !isComplete(feature) || feature.meeples.length === 0) return false;
    if (feature.kind !== 'monastery') return feature.tiles.includes(tile);
    const monastery = board[feature.tiles[0]];
    return Math.abs(monastery.x - placed.x) <= 1 && Math.abs(monastery.y - placed.y) <= 1;
  });
  const events = touched.map(feature => event(feature, true, features, players));
  return { board: returnMeeples(board, touched), scores: addPoints(scores, events), events };
}

const KINDS: FeatureKind[] = ['road', 'city', 'monastery', 'field'];

// The end of the game: every feature still holding meeples scores, fields included, and the totals by kind
export function scoreFinal(
  board: Placement[], scores: Record<Seat, number>, players: Seat[]
): { scores: Record<Seat, number>; events: ScoreEvent[]; final: FinalScores } {
  const features = analyze(board);
  const events = features.list
    .filter(feature => feature.meeples.length > 0)
    .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind))
    .map(feature => event(feature, isComplete(feature), features, players));
  const final: FinalScores = Object.fromEntries(players.map(seat => [seat, { road: 0, city: 0, monastery: 0, field: 0 }]));
  for (const { kind, seats, points } of events) for (const seat of seats) final[seat][kind] += points;
  return { scores: addPoints(scores, events), events, final };
}
