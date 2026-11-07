import type { Express } from 'express';

// Lets a page hosted elsewhere (such as GitHub Pages) use the API. No route reads cookies, only an Authorization header
// or a device ID the page sends on purpose, so any origin may ask without borrowing a visitor's credentials.
export function allowCrossOrigin(app: Express): void {
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'OPTIONS') return next();
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.sendStatus(204);
  });
}
