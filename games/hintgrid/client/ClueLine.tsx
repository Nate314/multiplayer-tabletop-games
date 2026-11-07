import gameService from '../../../src/services/gameService';
import { TEAM_NAMES } from '../teams.ts';
import { plural } from '../../../shared/text.ts';
import type { PublicGameState } from '../types.ts';

export default function ClueLine({ gameState, canEnd }: { gameState: PublicGameState; canEnd: boolean }) {
  const { clue, turn, guessesLeft, left, guessesThisTurn } = gameState;
  return (
    <div className="clue-line">
      {clue && <div className="clue-text">{TEAM_NAMES[turn]}&apos;s clue: {clue.word} {clue.count} ({plural(guessesLeft, 'guess', 'guesses')} left)</div>}
      <div className="words-left">Words left: Red {left.red}, Blue {left.blue}</div>
      {canEnd && <button type="button" disabled={guessesThisTurn === 0} onClick={() => gameService.makeMove({ type: 'endGuessing' })}>End guessing</button>}
    </div>
  );
}
