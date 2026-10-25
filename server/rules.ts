import type { Express } from 'express';
import fs from 'fs/promises';
import path from 'path';

// Serves games/<id>/README.md for the Rules dialog. Only registry ids are looked up, so a request can never name another file
export function mountRulesRoute(app: Express, gamesDir: string, ids: string[]): void {
  const known = new Set(ids);
  app.get('/api/rules/:gameType', async (req, res) => {
    if (!known.has(req.params.gameType)) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    try {
      const text = await fs.readFile(path.join(gamesDir, req.params.gameType, 'README.md'), 'utf8');
      res.setHeader('Cache-Control', 'no-cache');
      res.type('text/markdown; charset=utf-8').send(text);
    } catch {
      res.status(404).json({ error: 'Rules not found' });
    }
  });
}
