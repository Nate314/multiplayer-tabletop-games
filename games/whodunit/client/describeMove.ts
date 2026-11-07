import { nameOf } from '../content.ts';
import type { Position } from '../board.ts';
import type { Accusation, PublicGameState, Solution } from '../types.ts';

type Described = Pick<PublicGameState, 'lastMove' | 'playerNames' | 'suspectOf' | 'positions' | 'suggestions' | 'accusations'>;

export const placeName = (to: Position): string => ('room' in to ? `the ${nameOf(to.room)}` : `row ${to.row + 1}, column ${to.col + 1}`);
export const trio = ({ suspect, object, room }: Solution): string => `${nameOf(suspect)} with the ${nameOf(object)} in the ${nameOf(room)}`;

// The move that produced this state, for the history dialog. A shown card is never named: History is public
export function describeMove({ lastMove, playerNames, suspectOf, positions, suggestions, accusations }: Described): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  const suggestion = suggestions.at(-1);
  switch (lastMove.type) {
    case 'roll': return `${name} rolled ${lastMove.dice![0]} and ${lastMove.dice![1]}`;
    case 'moveTo': return `${name} moved to ${placeName(lastMove.to!)}`;
    case 'passage': return `${name} took the secret passage to ${placeName(lastMove.to!)}`;
    case 'stay': return `${name} stayed in ${placeName(positions[suspectOf[lastMove.playerNumber]])}`;
    case 'stayPut': return `${name} stayed put`;
    case 'suggest': {
      const said = `${name} suggested ${trio(suggestion!)}`;
      if (suggestion!.shownBy !== null) return `${said}. ${playerNames[suggestion!.shownBy]} showed ${name} a card`;
      return suggestion!.awaiting === null ? `${said}. Nobody could show ${name} a card` : said;
    }
    case 'show': return `${name} showed ${playerNames[suggestion!.by]} a card`;
    case 'accuse': {
      const accusation: Accusation = accusations.at(-1)!;
      return `${name} accused ${trio(accusation)} and was ${accusation.correct ? 'right' : 'wrong'}`;
    }
    case 'endTurn': return `${name} ended the turn`;
  }
}
