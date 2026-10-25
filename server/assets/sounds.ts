import type { Express } from 'express';
import { SOUNDS } from '../../shared/sounds.ts';

export function mountSoundRoutes(app: Express): void {
  app.get('/api/sound', (_req, res) => {
    res.json(SOUNDS);
  });

  app.get('/api/sound/:name', (req, res) => {
    const sound = SOUNDS.find(entry => entry.name === req.params.name);
    if (sound) res.json(sound);
    else res.status(404).json({ error: 'No such sound' });
  });
}
