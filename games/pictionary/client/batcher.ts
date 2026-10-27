// The server takes at most this many numbers (100 points) in one stroke action
const MAX_NUMBERS = 200;

// Groups one stroke's points: the first goes out at once so the others see the stroke start, the rest every
// `intervalMs`, since every action rewrites and broadcasts the whole state. One batcher per stroke
export function createBatcher(send: (points: number[]) => void, intervalMs = 100) {
  let pending: number[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let started = false;

  function flush() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    for (let i = 0; i < pending.length; i += MAX_NUMBERS) send(pending.slice(i, i + MAX_NUMBERS));
    pending = [];
  }

  return {
    add(x: number, y: number) {
      pending.push(x, y);
      if (!started) {
        started = true;
        flush();
      } else {
        timer ??= setTimeout(flush, intervalMs);
      }
    },
    flush
  };
}
