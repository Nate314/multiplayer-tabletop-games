import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames, list }: Pick<PublicGameState, 'lastMove' | 'playerNames' | 'list'>): string {
  if (!lastMove) return '';
  switch (lastMove.type) {
    case 'closeAnswers': return lastMove.reason === 'allDone' ? 'Everyone is done' : 'Time is up';
    case 'nextRound': return `Round ${lastMove.round}: the letter is ${lastMove.letter}`;
    case 'verdict': return `${playerNames[lastMove.seat]}'s answer for ${list[lastMove.category]} was ${lastMove.rejected ? 'rejected' : 'kept'}`;
    case 'answers': return `${playerNames[lastMove.playerNumber]} started answering`;
    case 'done': return `${playerNames[lastMove.playerNumber]} is done`;
    case 'continue': return `${playerNames[lastMove.playerNumber]} is ready for the next round`;
    case 'challenge': return `${playerNames[lastMove.playerNumber]} challenged ${playerNames[lastMove.seat]}'s answer for ${list[lastMove.category]}`;
    case 'judge': return `${playerNames[lastMove.playerNumber]} voted on ${playerNames[lastMove.seat]}'s answer for ${list[lastMove.category]}`;
  }
}
