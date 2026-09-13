// Test fixture only. This is not the production backend.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(req.url, 'http://fixture.local');
    if (url.pathname === '/fixture') {
      const mode = url.searchParams.get('mode');
      const delay = mode === 'slow' ? 4000 : mode === 'delay' ? 800 : 100;
      const timer = setTimeout(() => {
        res.writeHead(mode === 'fail' ? 503 : 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ value: new Date().toISOString(), mode }));
      }, delay);
      res.on('close', () => clearTimeout(timer));
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
});
server.listen(port, host, () => {
  console.log(`Production spike: http://${host}:${port}`);
  if (host === '0.0.0.0') {
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses || []) {
        if (address.family === 'IPv4' && !address.internal) console.log(`LAN candidate: http://${address.address}:${port}`);
      }
    }
  }
});
