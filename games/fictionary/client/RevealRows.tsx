import YouTag from '../../../src/components/YouTag.tsx';
import { namesOf } from './names.ts';
import type { PublicGameState, Seat } from '../types.ts';

// Each choice with who wrote it and who voted for it, then each seat's points for this word
export default function RevealRows({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { choices, votes, matched, roundPoints, playerNames } = gameState;
  const votersOf = (index: number) => Object.keys(votes).map(Number).filter(seat => votes[seat] === index);

  return (
    <div className="fictionary-reveal">
      <ul className="fictionary-choices" aria-label="Definitions">
        {choices.map((choice, index) => (
          <li key={index} className={choice.real ? 'fictionary-choice fictionary-real' : 'fictionary-choice'}>
            <span className="fictionary-text">{choice.text}</span>
            <span className="fictionary-by">
              {choice.real ? 'Real definition' : `Written by ${namesOf(playerNames, choice.authors ?? [])}`}
              {choice.real && matched.length > 0 && `, also written by ${namesOf(playerNames, matched)}`}
            </span>
            {votersOf(index).length > 0 && <span className="fictionary-by">Voted for by {namesOf(playerNames, votersOf(index))}</span>}
          </li>
        ))}
      </ul>
      <ul className="score-list" aria-label="Points this word">
        {Object.keys(roundPoints).map(Number).map(seat => (
          <li key={seat} className="score-row">
            <span className="score-name">{playerNames[seat]}<YouTag when={seat === viewer} /></span>
            <span className="score-points">+{roundPoints[seat]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The game-over screen's scoring: the last word's reveal
export function FinalRound({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return gameState.phase === 'reveal' && gameState.choices.length > 0 ? (
    <section className="game-over-round">
      <h3>Round {gameState.round}: {gameState.word}</h3>
      <RevealRows gameState={gameState} viewer={viewer} />
    </section>
  ) : null;
}
