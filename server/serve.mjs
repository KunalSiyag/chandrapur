/**
 * Production server: serves the built game from dist/ and the villagers'
 * conversation API. `npm run build && npm start` (PORT, default 8080).
 * Reads .env from the project root if present.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { npcApi } from './npc-brain.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch { /* env from the host */ }

const dist = path.join(root, 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const api = npcApi(process.env);

http.createServer((req, res) => {
  api(req, res, () => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(dist, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(dist + path.sep)) { res.statusCode = 403; return res.end(); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.statusCode = 404; return res.end('Not found'); }
      res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
      res.setHeader('Content-Length', st.size);
      fs.createReadStream(file).pipe(res);
    });
  });
}).listen(Number(process.env.PORT) || 8080, () => console.log(`Chandrapur on http://localhost:${Number(process.env.PORT) || 8080}`));
