import { useEffect, useState } from 'react';

const TICK_MS = 250;

// The server's clock now, corrected for this device's own clock using `serverTime` (the server's clock when the view
// was sent). Re-renders every 250 ms while `active`
export function useServerNow(active: boolean, serverTime: number | undefined): number {
  const [offset, setOffset] = useState(() => (serverTime === undefined ? 0 : serverTime - Date.now()));
  const [clientNow, setClientNow] = useState(() => Date.now());

  useEffect(() => {
    if (serverTime !== undefined) setOffset(serverTime - Date.now());
  }, [serverTime]);

  useEffect(() => {
    if (!active) return;
    setClientNow(Date.now()); // starting counts from now, not from the last tick
    const timer = setInterval(() => setClientNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [active]);

  return clientNow + offset;
}

// Milliseconds left until `deadline` (server time), or null for no deadline. Re-renders every 250 ms
export function useCountdown(deadline: number | null, serverTime: number | undefined): number | null {
  const now = useServerNow(deadline !== null, serverTime);
  return deadline === null ? null : Math.max(0, deadline - now);
}

// 'm:ss', rounded up so a clock reads 0:00 only once time is up; never below '0:00'
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// A turn clock: 'm:ss' while time remains, '+m:ss' counting up once it has run out
export function formatTurnClock(ms: number): string {
  return ms >= 0 ? formatClock(ms) : `+${formatClock(-ms)}`;
}
