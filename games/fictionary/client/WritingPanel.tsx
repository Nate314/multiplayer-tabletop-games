import { useState, type FormEvent } from 'react';
import gameService from '../../../src/services/gameService';
import { namesOf } from './names.ts';
import type { PublicGameState, Seat } from '../types.ts';

const MAX_DEFINITION = 150; // the server refuses longer

// The viewer's fake definition, kept in this browser until it is sent; a new word starts an empty box
export default function WritingPanel({ gameState, playerNumber }: { gameState: PublicGameState; playerNumber: Seat }) {
  const { submission, written, playerNames, activePlayers, phaseStartedAt, round, gameNumber } = gameState;
  const key = `${gameNumber ?? 1}:${round}`;
  const [draft, setDraft] = useState({ key, text: '' });
  if (draft.key !== key) setDraft({ key, text: '' });
  const text = draft.key === key ? draft.text : '';
  const closed = phaseStartedAt === null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    gameService.sendAction({ type: 'write', text: text.trim() });
  };

  return (
    <div className="fictionary-panel">
      {activePlayers.includes(playerNumber) && (
        <form className="fictionary-write" onSubmit={submit}>
          <label htmlFor="fictionary-definition">Your definition</label>
          <textarea id="fictionary-definition" maxLength={MAX_DEFINITION} rows={3} value={text} disabled={closed}
            onChange={event => setDraft({ key, text: event.target.value })} />
          <button type="submit" disabled={closed || text.trim() === ''}>{submission === null ? 'Submit' : 'Update'}</button>
        </form>
      )}
      {submission !== null && <div className="fictionary-own">You wrote: {submission}</div>}
      {written.length > 0 && <div className="fictionary-progress">Written: {namesOf(playerNames, written)}</div>}
    </div>
  );
}
