import type { Express } from 'express';
import type { OpenGame } from '../shared/types.ts';

// no-store: the list changes as people join and leave, so a cached copy would show games that are gone
export function mountOpenGamesRoute(app: Express, list: () => OpenGame[]): void {
  app.get('/api/open-games', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ games: list() });
  });
}
