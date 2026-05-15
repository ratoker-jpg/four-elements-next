// ARCH-LAB-01A — Cross-platform Node static file server for Playwright E2E tests.
//
// Purpose: provide a zero-dependency static server that works on both
// Windows (where `python` may be `py`) and Linux/CI without requiring
// Python at all. Uses only Node built-in modules (http, fs, path).
//
// Usage:
//   node tests/e2e/static_server.cjs [port] [root]
//   node tests/e2e/static_server.cjs        → port 8010, serving repo root
//   node tests/e2e/static_server.cjs 9000   → port 9000

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2] || '8010', 10);
const ROOT = process.argv[3] || path.resolve(__dirname, '..', '..');

// MIME map for common game asset types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.cjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.wav':  'audio/wav',
  '.mp3':  'audio/mpeg',
  '.webm': 'video/webm',
};

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  // Strip query string for file resolution
  const urlPath = (req.url || '/').split('?')[0];

  // Default to index.html for directory requests
  let resolved = path.join(ROOT, urlPath);
  if (urlPath.endsWith('/') || urlPath === '') {
    resolved = path.join(resolved, 'index.html');
  }

  // Prevent path traversal
  if (!resolved.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else if (err.code === 'EISDIR') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }

    const mime = guessMime(resolved);
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  // Signal readiness on stdout — Playwright webServer.url checks this
  console.log(`FE static server listening on http://127.0.0.1:${PORT}/ serving ${ROOT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT',  () => { server.close(); process.exit(0); });
