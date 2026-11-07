import { useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import { useCountdown } from '../../../src/hooks/useCountdown.ts';
import { phaseDeadline } from '../clock.ts';
import type { PublicGameState, Seat } from '../types.ts';

const SEND_DELAY_MS = 300;
const MAX_LENGTH = 40;
const LAST_MS = 1000; // the countdown ticks every 250 ms, so this covers the last moments

// One input per category. The text lives here, so a server echo never overwrites what the player is typing;
// it is sent 300 ms after typing stops and when a field loses focus, so the server holds what the player saw.
// Mounted once per round (keyed by the round), starting from what the server already holds.
export default function AnswerSheet({ gameState, playerNumber }: { gameState: PublicGameState; playerNumber: Seat }) {
  const { list, done, activePlayers, answers } = gameState;
  const [values, setValues] = useState<string[]>(() => list.map((_, i) => answers[playerNumber]?.[i] ?? ''));
  const latest = useRef(values);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeLeft = useCountdown(phaseDeadline(gameState), gameState.serverTime);
  const finished = done.includes(playerNumber) || !activePlayers.includes(playerNumber);

  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const send = (type: 'answers' | 'done') => { clear(); gameService.sendAction({ type, answers: latest.current }); };
  useEffect(() => clear, []);

  const change = (index: number, text: string) => {
    latest.current = latest.current.map((v, i) => (i === index ? text : v));
    setValues(latest.current);
    clear();
    // Near the deadline send at once: a send after the round closes is refused, and so would a flush on unmount
    if (timeLeft !== null && timeLeft <= LAST_MS) send('answers');
    else timer.current = setTimeout(() => send('answers'), SEND_DELAY_MS);
  };

  return (
    <form className="answer-sheet" onSubmit={event => event.preventDefault()}>
      {list.map((category, index) => (
        <label key={category} className="answer-field">
          <span className="answer-category">{category}</span>
          <input
            type="text" value={values[index]} maxLength={MAX_LENGTH} disabled={finished}
            autoComplete="off" autoCapitalize="words"
            onChange={event => change(index, event.target.value)}
            onBlur={() => { if (timer.current && !finished) send('answers'); }}
          />
        </label>
      ))}
      <button type="button" onClick={() => send('done')} disabled={finished}>Done</button>
    </form>
  );
}
