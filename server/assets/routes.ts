import type { Express } from 'express';
import { SVG_ASSETS, findSvg, type SvgAsset } from './registry.ts';
import { mountSoundRoutes } from './sounds.ts';

const IMMUTABLE = 'public, max-age=31536000, immutable';

// A URL's drawing never changes, so browsers keep it forever; a new drawing gets a new name or parameter
export function mountAssetRoutes(app: Express, assets: SvgAsset[] = SVG_ASSETS): void {
  mountSoundRoutes(app);

  app.get('/api/svg', (_req, res) => {
    res.json(assets.map(({ name, params, samples }) => ({ name, params, samples })));
  });

  app.get('/api/svg/:name{/*params}', (req, res) => {
    const asset = findSvg(req.params.name, assets);
    if (!asset) {
      res.status(404).json({ error: 'No such SVG' });
      return;
    }
    const params = (req.params as { params?: string[] }).params ?? [];
    let markup: string | null = null;
    try {
      if (params.length === asset.params.length) markup = asset.render(params);
    } catch {
      // A generator that throws on an odd parameter is the same as one that refuses it
    }
    if (markup === null) {
      res.status(400).json({ error: 'Bad SVG parameters' });
      return;
    }
    res.setHeader('Cache-Control', IMMUTABLE);
    res.type('image/svg+xml').send(markup);
  });
}
