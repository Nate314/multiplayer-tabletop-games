import { useCallback, useRef, useState } from 'react';
import useDismiss from '../hooks/useDismiss.ts';
import { formatClock } from '../hooks/useCountdown.ts';
import gameService from '../services/gameService.ts';
import { loadRecentReactions, saveRecentReactions } from '../services/settings.ts';
import { isSingleEmoji } from '../../shared/reactions.ts';
import { keepOnScreen } from './keepOnScreen.ts';
import { rememberReaction } from './reactions.ts';
import type { Seat } from '../../shared/types.ts';

type ReactionPickerProps = {
  target: Seat;
  name: string;
  disabled: boolean; // the game is not running
  cooldownMs: number; // 0 when this player may send
};

const EMOJI_HINT = /Windows/.test(navigator.userAgent) ? 'Win + .' : 'Emoji keyboard';

// A player's name as a button that opens the emoji picker under it; the cooldown counts down in the picker, so it never crowds the turn clock
export default function ReactionPicker({ target, name, disabled, cooldownMs }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState(loadRecentReactions);
  const [typed, setTyped] = useState('');
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => { setOpen(false); setTyped(''); }, []);
  useDismiss(wrapperRef, open, close);

  const cooling = cooldownMs > 0;
  const send = (emoji: string) => {
    gameService.react(target, emoji);
    const next = rememberReaction(recent, emoji);
    setRecent(next);
    saveRecentReactions(next);
    close();
  };

  return (
    <span className="reaction-anchor" ref={wrapperRef}>
      <button type="button" className="presence-name" aria-haspopup="dialog" aria-expanded={open} disabled={disabled}
        onClick={() => { if (open) close(); else { setRecent(loadRecentReactions()); setOpen(true); } }}>
        {name}
      </button>
      {open && !disabled && (
        <div className="reaction-picker" ref={keepOnScreen} role="dialog" aria-label={`React to ${name}`}>
          <h2>{`React to ${name}`}</h2>
          {cooling && <div className="reaction-cooldown">{formatClock(cooldownMs)}</div>}
          <div className="reaction-recent">
            {recent.map(emoji => (
              <button key={emoji} type="button" aria-label={emoji} disabled={cooling} onClick={() => send(emoji)}>{emoji}</button>
            ))}
          </div>
          <form className="reaction-custom" onSubmit={(e) => { e.preventDefault(); if (!cooling && isSingleEmoji(typed.trim())) send(typed.trim()); }}>
            <input aria-label="Any emoji" placeholder={EMOJI_HINT} value={typed} disabled={cooling} onChange={(e) => setTyped(e.target.value)} />
            <button type="submit" disabled={cooling || !isSingleEmoji(typed.trim())}>Send</button>
          </form>
        </div>
      )}
    </span>
  );
}
