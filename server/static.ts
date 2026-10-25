import express, { type Express } from 'express';
import path from 'path';

const IMMUTABLE = 'public, max-age=31536000, immutable';

// Serves the built client. Vite names everything in assets/ by its content hash, so browsers keep those forever;
// every other file (index.html, sw.js, the manifest, icons) is checked with the server on each load, so a new build
// shows on the next reload.
export function serveClient(app: Express, distDir: string): void {
  const assetsDir = path.join(distDir, 'assets') + path.sep;
  app.use(express.static(distDir, {
    setHeaders(res, filePath) {
      res.setHeader('Cache-Control', filePath.startsWith(assetsDir) ? IMMUTABLE : 'no-cache');
    }
  }));

  // Any other path without an extension gets the app; a missing file such as /missing.js is a 404, never index.html
  app.use((req, res) => {
    if (path.extname(req.path)) {
      res.sendStatus(404);
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    // With root, only the file name is checked for dot segments, so a checkout under a folder like .claude still works
    res.sendFile('index.html', { root: distDir });
  });
}
