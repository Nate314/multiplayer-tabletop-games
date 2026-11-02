import GuessRows from './GuessRows';
import RaceProgress from './RaceProgress';
import { Totals } from './RoundRows';
import { houseRule } from '../../../shared/houseRules.ts';
import { modeOf } from '../../../shared/puzzleModes.ts';
import { CODEBREAKER_MODE, CODE_RULE, codeShape } from '../options.ts';
import type { PublicGameState, Seat } from '../types.ts';

// The boards as they stood after one move, newest guess outlined; also the spectator's live table. Nothing can be pressed.
// Race shows only the boards this view holds (the viewer's own, every board for a spectator or once the game is over)
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { activePlayers, playerNames, board, boards, code, lastMove, maker, round } = gameState;
  const mode = modeOf(gameState, CODEBREAKER_MODE);
  const { pegs } = codeShape(houseRule(gameState, CODE_RULE));

  if (mode === 'race') {
    const seats = activePlayers.filter(seat => boards[seat]);
    return (
      <div className="cb-history">
        <div className="cb-history-boards">
          {seats.map(seat => (
            <div key={seat} className="cb-history-board">
              <div className="cb-board-title">{playerNames[seat]}</div>
              <GuessRows board={boards[seat]!} code={code} pegs={pegs} label={`${playerNames[seat]}'s guesses`}
                highlightLast={lastMove?.type === 'raceGuess' && lastMove.playerNumber === seat} />
            </div>
          ))}
        </div>
        <RaceProgress gameState={gameState} exclude={null} viewer={viewer} />
      </div>
    );
  }

  return (
    <div className="cb-history">
      {mode === 'classic' && maker !== null && <div className="cb-board-title">Round {round}: {playerNames[maker]}'s code</div>}
      <GuessRows board={board} code={code} pegs={pegs} names={mode === 'together' ? playerNames : null} highlightLast={lastMove?.type === 'guess'} />
      {mode === 'classic' && <Totals gameState={gameState} viewer={viewer} />}
    </div>
  );
}
