import express, { type Express, type Request, type Response } from 'express';
import { hashDeviceId } from '../devices.ts';
import { ARCHIVE_TTL_MS } from '../games.ts';
import { createLinkCodes, type LinkCodes } from './linkCodes.ts';
import type { StatsStore } from './store.ts';

const USED_CODE = 'That code has expired or was already used';

// Every route is a POST whose body carries the device ID, so the ID never shows in a URL or a log.
// Answers carry names, places, scores, counts and codes only: never a hash or a person
export function mountStatsRoutes(app: Express, stats: StatsStore, codes: LinkCodes = createLinkCodes()): void {
  const json = express.json({ limit: '1kb' });
  const cleared = (hash: string) => stats.resultsFor(hash) === 'cleared';

  // The requesting device's hash, or null once a 400 has answered
  function deviceOf(req: Request, res: Response): string | null {
    const hash = hashDeviceId(req.body?.deviceId);
    if (!hash) res.status(400).json({ error: 'Missing device' });
    return hash;
  }

  app.post('/api/stats', json, (req, res) => {
    const hash = deviceOf(req, res);
    if (!hash) return;
    const games = stats.resultsFor(hash);
    if (games === 'cleared') {
      res.json({ cleared: true });
      return;
    }
    // The archive is written when the result is, so a result is in the archive until it ages out
    const archivedSince = Date.now() - ARCHIVE_TTL_MS;
    res.json({
      games: games.map(game => ({ ...game, historyAvailable: game.finishedAt > archivedSince })),
      devices: stats.deviceCount(hash)
    });
  });

  app.post('/api/stats/clear', json, (req, res) => {
    const hash = deviceOf(req, res);
    if (hash) res.json(stats.clear(hash));
  });

  app.post('/api/stats/link-code', json, (req, res) => {
    const hash = deviceOf(req, res);
    if (hash) res.json(codes.issue(hash));
  });

  // A cleared device is never linked: linking would give its hash a person again
  app.post('/api/stats/link', json, (req, res) => {
    const hash = deviceOf(req, res);
    if (!hash) return;
    if (cleared(hash)) {
      res.json({ cleared: true });
      return;
    }
    const owner = codes.redeem(req.body.code);
    const linked = owner === null || cleared(owner) ? { error: USED_CODE } : stats.link(hash, owner);
    if ('error' in linked) res.status(400).json(linked);
    else res.json(linked);
  });
}
