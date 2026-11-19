import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleCrmApi } from '../module/mod-crm/api/server.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(root, 'public');
const crmRoot = path.resolve(root, '../module/mod-crm/public');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3200);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Invalid PORT configuration');
}

function hasSession(req) {
  const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('orva_session='));
  if (!cookie) return false;
  try {
    verifyAccessToken(decodeURIComponent(cookie.slice('orva_session='.length)), process.env.ORVA_AUTH_SECRET);
    return true;
  } catch { return false; }
}

function resolveInside(base, relativePath) {
  const target = path.resolve(base, relativePath);
  return target === base || target.startsWith(base + path.sep) ? target : null;
}

function sendFile(req, res, file) {
  fs.stat(file, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not Found');
    }

    res.writeHead(200, {
      'Content-Type': contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': 'no-cache'
    });

    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    return res.end('Bad Request');
  }

  if (pathname.startsWith('/api/crm/')) {
    try {
      const handled = await handleCrmApi(req, res, pathname);
      if (handled) return;
    } catch (error) {
      console.error('ORVA CRM API error:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
      return;
    }
  }

  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }

  if (pathname === '/login') return sendFile(req, res, path.join(webRoot, 'login.html'));
  if (pathname === '/' || pathname === '/dashboard' || pathname === '/crm' || pathname.startsWith('/crm/')) {
    if (!hasSession(req)) { res.writeHead(302, { Location: '/login', 'Cache-Control': 'no-store' }); return res.end(); }
  }
  if (pathname === '/') return sendFile(req, res, path.join(webRoot, 'index.html'));
  if (pathname === '/dashboard') return sendFile(req, res, path.join(webRoot, 'dashboard.html'));
  if (pathname === '/crm' || pathname.startsWith('/crm/')) {
    const relative = pathname === '/crm' || pathname === '/crm/' ? 'index.html' : pathname.slice(5);
    const file = resolveInside(crmRoot, relative);
    if (!file) { res.writeHead(403); return res.end('Forbidden'); }
    return sendFile(req, res, file);
  }

  const asset = resolveInside(webRoot, pathname.replace(/^\/+/, ''));
  if (!asset || path.extname(pathname) === '') {
    res.writeHead(404);
    return res.end('Not Found');
  }

  return sendFile(req, res, asset);
});

server.on('error', (error) => {
  console.error('ORVA web server error:', error);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`ORVA web listening on ${host}:${port}`);
});
