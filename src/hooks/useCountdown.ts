import { useEffect, useState } from 'react';

const TICK_MS = 250;

// Milliseconds left until `deadline` (server time), or null for no deadline. `serverTime` is the server's clock when
// the view was sent, so a device whose own clock is off still counts down correctly. Re-renders every 250 ms
export function useCountdown(deadline: number | null, serverTime: number | undefined): number | null {
  const [offset, setOffset] = useState(() => (serverTime === undefined ? 0 : serverTime - Date.now()));
  const [clientNow, setClientNow] = useState(() => Date.now());

  useEffect(() => {
    if (serverTime !== undefined) setOffset(serverTime - Date.now());
  }, [serverTime]);

  useEffect(() => {
    if (deadline === null) return;
    setClientNow(Date.now()); // a new deadline counts from now, not from the last tick
    const timer = setInterval(() => setClientNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [deadline]);

  return deadline === null ? null : Math.max(0, deadline - (clientNow + offset));
}

// 'm:ss', rounded up so a clock reads 0:00 only once time is up; never below '0:00'
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
