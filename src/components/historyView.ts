import type { GameFileStep } from '../../shared/gameFile.ts';
import type { HistoryStep, Seat } from '../../shared/types.ts';

// The step as the chosen seat saw it; the table step when no seat is chosen or the file has no view for it
export function viewOf(step: GameFileStep, viewer: Seat | null): HistoryStep {
  return (viewer !== null && step.views?.[viewer]) || step;
}
