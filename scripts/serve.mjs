// Minimal static file server for previewing Ezra's Blocks.
//   node scripts/serve.mjs          (serves on port 8000)
//   PORT=3000 node scripts/serve.mjs
// Sets correct MIME types for ES modules and disables caching so reloads
// always show the latest files.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = path.join(ROOT, path.normalize(pathname));

  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + pathname);
      console.log(res.statusCode, req.method, pathname);
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(data);
    console.log(res.statusCode, req.method, pathname);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ezra's Blocks preview running at http://0.0.0.0:${PORT}  (serving ${ROOT})`);
});
