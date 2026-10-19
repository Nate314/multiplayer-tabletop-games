import express, { type Express } from 'express';
import type { createGameManager } from './games.ts';
import type { BaseGameState, Random } from '../shared/types.ts';

// Test hooks for the Playwright suite in e2e/, mounted only when the server starts with E2E=1.
// A test crafts a game state and picks the next random numbers here, then plays everything else in the browser.

type Manager = ReturnType<typeof createGameManager>;
export type E2eRandom = { random: Random; queue: number[] };

// Queued numbers come out first; after them a fixed-seed generator, so an unscripted shuffle is the same every run
export function createE2eRandom(): E2eRandom {
  const queue: number[] = [];
  let seed = 1;
  function seeded(): number {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return { queue, random: () => queue.shift() ?? seeded() };
}

export function mountE2eRoutes(app: Express, manager: Manager, e2eRandom: E2eRandom, broadcast: (roomId: string) => void): void {
  app.use('/api/e2e', express.json({ limit: '1mb' }));

  // Replaces the queue: { values: number[] }, each in [0, 1)
  app.post('/api/e2e/random', (req, res) => {
    const values: unknown = req.body?.values;
    if (!Array.isArray(values) || !values.every(value => typeof value === 'number' && value >= 0 && value < 1)) {
      res.status(400).json({ error: 'values must be numbers from 0 up to 1' });
      return;
    }
    e2eRandom.queue.splice(0, e2eRandom.queue.length, ...values);
    res.json({ ok: true });
  });

  app.get('/api/e2e/state/:gameType/:gameId', (req, res) => {
    const state = manager.rawState(`${req.params.gameType}/${req.params.gameId}`);
    if (state) res.json(state);
    else res.status(404).json({ error: 'Game not found' });
  });

  // Merges the body's fields over the live state and sends every player their new view
  app.post('/api/e2e/state/:gameType/:gameId', (req, res) => {
    const roomId = `${req.params.gameType}/${req.params.gameId}`;
    const current = manager.rawState(roomId);
    if (!current) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    manager.replaceState(roomId, { ...current, ...(req.body as Partial<BaseGameState>) });
    broadcast(roomId);
    res.json({ ok: true });
  });
}
