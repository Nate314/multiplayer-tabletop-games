import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import gameService from '../../../src/services/gameService';
import type { PublicGameState, Seat } from '../types.ts';

type ChatProps = { gameState: PublicGameState; playerNumber: Seat };

// The chat, which doubles as guessing: the server decides whether a message is a guess, a near miss or just chat
export default function Chat({ gameState, playerNumber }: ChatProps) {
  const { chat, playerNames, phase, drawer, guessed, activePlayers, isGameOver } = gameState;
  const [text, setText] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const drawing = phase === 'drawing' && !isGameOver;
  const isDrawer = drawing && drawer === playerNumber;
  const guessing = drawing && !isDrawer && activePlayers.includes(playerNumber) && !guessed.includes(playerNumber);
  const label = guessing ? 'Guess' : 'Chat';
  const lastId = chat[chat.length - 1]?.id;

  // Keep the newest line in view
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lastId]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    gameService.sendAction({ type: 'chat', text });
    setText('');
  }

  return (
    <section className="pictionary-chat" aria-label="Chat">
      <ul className="chat-lines" ref={listRef}>
        {chat.map(line => (
          <li key={line.id} className={`chat-line chat-${line.kind}`}>
            {line.kind === 'chat' && line.seat !== null && <span className="chat-name">{playerNames[line.seat]}: </span>}
            {line.text}
            {line.audience === 'guessed' && <span className="chat-audience">Only players who guessed can see this</span>}
          </li>
        ))}
      </ul>
      <form className="chat-form" onSubmit={submit}>
        <label className="chat-label" htmlFor="pictionary-chat-input">{label}</label>
        <input
          id="pictionary-chat-input"
          type="text"
          autoComplete="off"
          maxLength={100}
          value={isDrawer ? '' : text}
          placeholder={isDrawer ? 'You are drawing' : ''}
          disabled={isDrawer || isGameOver}
          onChange={event => setText(event.target.value)}
        />
        <button type="submit" disabled={isDrawer || isGameOver || !text.trim()}>Send</button>
      </form>
    </section>
  );
}
