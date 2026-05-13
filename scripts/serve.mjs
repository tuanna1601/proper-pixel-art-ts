import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import http from 'node:http';

const root = '/workspace/ppa-ts';
const port = 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const requestPath = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;
  const safePath = normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(root, safePath);
  if (safePath === '/') {
    filePath = join(root, 'tests-browser', 'index.html');
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`ppa-ts test server on http://127.0.0.1:${port}`);
});
