import { useEffect, useRef, useState } from 'react';
import gameService from '../services/gameService.ts';
import { playSounds } from '../sound/synth.ts';
import { REACTION_COOLDOWN_MS, REACTION_SHOW_MS } from '../../shared/reactions.ts';
import type { Reaction } from '../../shared/reactions.ts';
import type { Seat } from '../../shared/types.ts';

// The latest reaction per target for REACTION_SHOW_MS, a sound when it is for this player, and the end of this viewer's cooldown;
// `myName` and `spectating` tell which sent reactions are this viewer's own (a spectator name never matches a seated one)
export default function useReactions(playerNumber: Seat | null, myName: string | undefined, spectating: boolean) {
  const [bubbles, setBubbles] = useState<Record<Seat, Reaction>>({});
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const timers = useRef(new Map<Seat, ReturnType<typeof setTimeout>>());
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const pending = timers.current;
    gameService.onReaction = (reaction) => {
      clearTimeout(pending.get(reaction.target));
      setBubbles(current => ({ ...current, [reaction.target]: reaction }));
      pending.set(reaction.target, setTimeout(() => {
        setBubbles(current => {
          const { [reaction.target]: _gone, ...rest } = current;
          return rest;
        });
      }, REACTION_SHOW_MS));
      if (reaction.target === playerNumber) playSounds(['reaction']);
      if (reaction.from === myName && reaction.fromSpectator === spectating) {
        // Local clock, so a late-rendered server time cannot stretch the countdown; cleared after so the bar stops ticking
        setCooldownUntil(Date.now() + REACTION_COOLDOWN_MS);
        clearTimeout(cooldownTimer.current);
        cooldownTimer.current = setTimeout(() => setCooldownUntil(null), REACTION_COOLDOWN_MS);
      }
    };
    return () => {
      gameService.onReaction = null;
      pending.forEach(clearTimeout);
      pending.clear();
      clearTimeout(cooldownTimer.current);
    };
  }, [playerNumber, myName, spectating]);

  return { bubbles, cooldownUntil };
}
