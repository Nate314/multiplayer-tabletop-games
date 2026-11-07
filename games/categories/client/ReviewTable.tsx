import gameService from '../../../src/services/gameService';
import YouTag from '../../../src/components/YouTag.tsx';
import { connectedPlayers } from '../../../shared/seating.ts';
import type { PublicGameState, Seat, Verdict } from '../types.ts';

const TAGS: Record<Exclude<Verdict, 'empty'>, string> = { valid: '+1', duplicate: 'Duplicate', wrongLetter: 'Wrong letter', rejected: 'Rejected' };

// Every active seat's answers, one card per category; viewer 0 is the history, which cannot act
export default function ReviewTable({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat }) {
  const { list, activePlayers, playerNames, answers, verdicts, roundPoints, challenges, review, isGameOver } = gameState;
  const acted = viewer !== 0 && activePlayers.includes(viewer);
  const waiting = connectedPlayers(gameState).filter(seat => !review?.acknowledged.includes(seat));
  const send = (action: Record<string, unknown>) => gameService.sendAction(action);

  return (
    <div className="review">
      <ul className="review-list" aria-label="Answers">
        {list.map((category, c) => (
          <li key={category} className="review-row">
            <h3 className="review-category">{category}</h3>
            <ul className="review-cells">
              {activePlayers.map(seat => {
                const text = answers[seat]?.[c] ?? '';
                const verdict = verdicts[seat]?.[c] ?? 'empty';
                const challenge = challenges.find(x => x.category === c && x.seat === seat);
                const open = challenge?.verdict === 'open';
                const tag = verdict === 'empty' ? '' : open && verdict === 'valid' ? 'Challenged' : TAGS[verdict];
                const votes = acted && !isGameOver && open && seat !== viewer && challenge?.votes[viewer] === undefined;
                const canChallenge = acted && !isGameOver && verdict === 'valid' && !challenge && seat !== viewer;
                const about = `${playerNames[seat]}'s answer for ${category}`;
                return (
                  <li key={seat} className={`review-cell verdict-${verdict}${open ? ' verdict-open' : ''}`}>
                    <span className="review-name">{playerNames[seat]}<YouTag when={seat === viewer} /></span>
                    <span className="review-answer">{text}</span>
                    {tag && <span className="review-tag">{tag}</span>}
                    {canChallenge && <button type="button" aria-label={`Challenge ${about}`} onClick={() => send({ type: 'challenge', category: c, seat })}>Challenge</button>}
                    {votes && (
                      <span className="review-votes">
                        <button type="button" aria-label={`Keep ${about}`} onClick={() => send({ type: 'judge', category: c, seat, reject: false })}>Keep</button>
                        <button type="button" aria-label={`Reject ${about}`} onClick={() => send({ type: 'judge', category: c, seat, reject: true })}>Reject</button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      <ul className="review-points" aria-label="Points this round">
        {activePlayers.map(seat => (
          <li key={seat}>{playerNames[seat]}: <strong>{roundPoints[seat] ?? 0}</strong></li>
        ))}
      </ul>
      {acted && !isGameOver && (
        <div className="review-continue">
          <button type="button" onClick={() => send({ type: 'continue' })} disabled={!!review?.acknowledged.includes(viewer)}>Continue</button>
          {waiting.length > 0 && <span>Waiting for {waiting.map(seat => playerNames[seat]).join(', ')}</span>}
        </div>
      )}
    </div>
  );
}
