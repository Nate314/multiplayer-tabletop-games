import { useEffect, useRef } from 'react';
import type { BasePublicState, Seat } from '../../shared/types.ts';
import { turnTimeLeft } from '../../shared/turnTimer.ts';
import { useServerNow } from '../hooks/useCountdown.ts';
import { playSounds } from './synth.ts';
import useTimerWarning from './useTimerWarning.ts';

// The turn timer for the bar: time left (negative in overtime) and whether a vote has paused it. For the player whose
// turn it is it also ticks in the last 10 seconds and plays the 'turn' chime once when time runs out
export default function useTurnTimer(
  gameState: BasePublicState, viewer: Seat | null
): { msLeft: number | null; paused: boolean } {
  const paused = typeof gameState.turnPausedAt === 'number';
  const now = useServerNow(!paused && turnTimeLeft(gameState, 0) !== null, gameState.serverTime);
  const msLeft = turnTimeLeft(gameState, now);
  const mine = viewer !== null && viewer === gameState.currentPlayer && !gameState.isGameOver;

  useTimerWarning(msLeft, mine && !paused);

  const wasAbove = useRef(false);
  const chimedFor = useRef<unknown>(null); // a latency shift can bounce msLeft across zero; chime once per turn start
  useEffect(() => {
    if (mine && !paused && wasAbove.current && msLeft !== null && msLeft <= 0 && chimedFor.current !== gameState.turnStartedAt) {
      chimedFor.current = gameState.turnStartedAt;
      playSounds(['turn']);
    }
    wasAbove.current = msLeft !== null && msLeft > 0;
  }, [msLeft, mine, paused, gameState.turnStartedAt]);

  return { msLeft, paused };
}
