import gameService from '../../../src/services/gameService';
import { namesOf } from './names.ts';
import type { PublicGameState, Seat } from '../types.ts';

// One button per choice; a seat may change its vote until everyone has voted, but never vote for its own fake.
// Anyone who cannot vote (a spectator, the history) sees the choices as a plain list
export default function VotingPanel({ gameState, playerNumber }: { gameState: PublicGameState; playerNumber: Seat }) {
  const { choices, ownChoice, myVote, voted, matched, playerNames, activePlayers } = gameState;
  const knows = matched.includes(playerNumber);

  return (
    <div className="fictionary-panel">
      {knows && <div className="fictionary-own">You wrote the real definition. Waiting for the votes.</div>}
      {!knows && activePlayers.includes(playerNumber) && (
        <div className="fictionary-choices" role="radiogroup" aria-label="Which is the real definition?">
          {choices.map((choice, index) => (
            <button key={index} type="button" role="radio" aria-checked={myVote === index} disabled={index === ownChoice}
              className={myVote === index ? 'fictionary-choice fictionary-picked' : 'fictionary-choice'}
              onClick={() => gameService.sendAction({ type: 'vote', choice: index })}>
              <span className="fictionary-text">{choice.text}</span>
              {index === ownChoice && <span className="fictionary-tag">Yours</span>}
            </button>
          ))}
        </div>
      )}
      {!knows && !activePlayers.includes(playerNumber) && (
        <ul className="fictionary-choices" aria-label="Definitions">
          {choices.map((choice, index) => <li key={index} className="fictionary-choice">{choice.text}</li>)}
        </ul>
      )}
      {voted.length > 0 && <div className="fictionary-progress">Voted: {namesOf(playerNames, voted)}</div>}
    </div>
  );
}
