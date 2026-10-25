import Dice from '../../../src/components/Dice';
import { targetScore } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  selected?: boolean[]; // which dice of the roll the viewer has picked to set aside
  onToggle?: (index: number) => void; // given only when the viewer may pick dice
};

// The roll to show: the current one, or the one that just farkled, which ended the turn
function shownRoll(state: PublicGameState): number[] {
  const { dice, lastMove } = state;
  if (dice.length > 0) return dice;
  return lastMove?.type === 'roll' && lastMove.farkle ? lastMove.dice : [];
}

function standing(state: PublicGameState, seat: Seat): string {
  if (state.winners.includes(seat)) return state.winners.length > 1 ? 'Tied for the win' : 'Winner';
  if (state.triggeredBy === seat) return `Reached ${targetScore(state).toLocaleString()}`;
  if (state.finalTurns.includes(seat)) return 'Last turn to come';
  return '';
}

// The dice in front of the player to move, what they have set aside and the turn total, then every score
export default function Table({ gameState, selected, onToggle }: TableProps) {
  const { currentPlayer, playerNames, activePlayers, scores, setAside, turnTotal, isGameOver, winners } = gameState;
  const roll = shownRoll(gameState);
  const farkled = gameState.dice.length === 0 && roll.length > 0;

  return (
    <div className="farkle-table">
      <section className="farkle-turn" aria-label="This turn">
        <header className="farkle-turn-header">
          <span>{currentPlayer !== null && !isGameOver ? `${playerNames[currentPlayer]}'s turn` : 'Last roll'}</span>
          <span className="farkle-turn-total">Turn total: {turnTotal.toLocaleString()}</span>
        </header>
        <div className="farkle-dice">
          {roll.length > 0
            ? <Dice values={roll} selected={selected} onToggle={onToggle} label="Dice to roll" animKeyPrefix="die" />
            : <span className="farkle-empty">No dice rolled yet</span>}
          {farkled && <span className="farkle-farkle">Farkle!</span>}
        </div>
        <div className="farkle-aside">
          <span className="farkle-label">Set aside</span>
          {setAside.length > 0
            ? <Dice values={setAside} label="Dice set aside" />
            : <span className="farkle-empty">Nothing yet</span>}
        </div>
      </section>
      <ol className="farkle-scores" aria-label="Scores">
        {activePlayers.map(seat => {
          const classes = ['farkle-score'];
          if (seat === currentPlayer && !isGameOver) classes.push('farkle-score-current');
          if (winners.includes(seat)) classes.push('farkle-score-winner');
          return (
            <li key={seat} className={classes.join(' ')}>
              <span className="farkle-score-name">{playerNames[seat]}</span>
              <span className="farkle-score-note">{standing(gameState, seat)}</span>
              <span className="farkle-score-points">{scores[seat]?.toLocaleString()}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
