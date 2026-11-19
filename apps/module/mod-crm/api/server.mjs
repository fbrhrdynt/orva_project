import { Pool } from 'pg';
import { verifyAccessToken } from './auth.mjs';

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'orva',
  user: process.env.PGUSER || 'orva_app',
  password: process.env.PGPASSWORD_B64 ? Buffer.from(process.env.PGPASSWORD_B64, 'base64').toString('utf8') : process.env.PGPASSWORD,
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  application_name: 'orva-crm-api'
});

const send = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(body));
};

async function readJson(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1024 * 1024) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { status: 400 });
  }
}

function authorize(claims, permission) {
  if (!claims.permissions.includes(permission) && !claims.permissions.includes('crm:*') && !claims.permissions.includes('*')) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
}

export async function handleCrmApi(req, res, pathname) {
  if (!pathname.startsWith('/api/crm/')) return false;

  if (pathname === '/api/crm/health' && req.method === 'GET') {
    try {
      await pool.query('SELECT 1');
      send(res, 200, { status: 'ok', module: 'crm', database: 'connected' });
    } catch (error) {
      console.error('CRM database health check failed:', error.message);
      send(res, 503, { error: 'Database unavailable' });
    }
    return true;
  }

  if (pathname !== '/api/crm/leads' || !['GET', 'POST'].includes(req.method)) {
    send(res, 404, { error: 'Endpoint not found' });
    return true;
  }

  const bearer = (req.headers.authorization || '').match(/^Bearer ([A-Za-z0-9._-]+)$/);
  const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('orva_session='));
  const token = bearer?.[1] || (cookie ? decodeURIComponent(cookie.slice('orva_session='.length)) : null);
  if (!token) {
    send(res, 401, { error: 'Authentication required' });
    return true;
  }

  let claims;
  try {
    claims = verifyAccessToken(token, process.env.ORVA_AUTH_SECRET);
  } catch {
    send(res, 401, { error: 'Invalid or expired access token' });
    return true;
  }

  try {
    const access = await pool.query(
      `SELECT 1
         FROM core.memberships m
         JOIN core.organizations o ON o.id = m.organization_id
         JOIN core.organization_modules om ON om.organization_id = m.organization_id
        WHERE m.user_id = $1 AND m.organization_id = $2
          AND m.status = 'active' AND o.status = 'active'
          AND om.module_key = 'crm' AND om.enabled = true
          AND ($3 = true OR EXISTS (
            SELECT 1 FROM core.user_module_access a
             WHERE a.user_id = m.user_id AND a.organization_id = m.organization_id
               AND a.module_key = 'crm' AND a.can_access = true
          ))
        LIMIT 1`,
      [claims.sub, claims.organization_id, claims.is_platform_owner === true]
    );
    if (!access.rowCount) {
      send(res, 403, { error: 'CRM access is not assigned to this account' });
      return true;
    }

    if (req.method === 'GET') {
      authorize(claims, 'crm.leads:read');
      const result = await pool.query(
        `SELECT id, organization_id, name, company, email, phone, source, status,
                assigned_to, created_at, updated_at
           FROM crm.leads
          WHERE organization_id = $1
          ORDER BY created_at DESC
          LIMIT 200`,
        [claims.organization_id]
      );
      send(res, 200, { data: result.rows });
      return true;
    }

    authorize(claims, 'crm.leads:create');
    const body = await readJson(req);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 160) {
      send(res, 422, { error: 'name is required (max 160 characters)' });
      return true;
    }

    const result = await pool.query(
      `INSERT INTO crm.leads
        (organization_id, name, company, email, phone, source, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id, organization_id, name, company, email, phone, source, status,
                 assigned_to, created_at, updated_at`,
      [
        claims.organization_id,
        name,
        typeof body.company === 'string' ? body.company.trim().slice(0, 160) : null,
        typeof body.email === 'string' ? body.email.trim().slice(0, 254) : null,
        typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : null,
        typeof body.source === 'string' ? body.source.trim().slice(0, 80) : null,
        claims.sub
      ]
    );
    send(res, 201, { data: result.rows[0] });
    return true;
  } catch (error) {
    if (error.status) {
      send(res, error.status, { error: error.message });
      return true;
    }
    console.error('CRM API request failed:', error);
    send(res, 500, { error: 'Internal server error' });
    return true;
  }
}

export async function closeCrmPool() {
  await pool.end();
}
