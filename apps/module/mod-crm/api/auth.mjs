import { createHmac, timingSafeEqual } from 'node:crypto';

const decode = (value) => Buffer.from(value, 'base64url').toString('utf8');

export function verifyAccessToken(token, secret) {
  if (!secret) throw new Error('ORVA_AUTH_SECRET is not configured');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = JSON.parse(decode(encodedHeader));
  const claims = JSON.parse(decode(encodedPayload));

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Unsupported token algorithm');
  }

  const expected = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const actual = Buffer.from(encodedSignature, 'base64url');

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('Invalid token signature');
  }

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(claims.exp) || claims.exp <= now) throw new Error('Expired token');
  if (claims.nbf && claims.nbf > now) throw new Error('Token not active');
  if (process.env.ORVA_TOKEN_ISSUER && claims.iss !== process.env.ORVA_TOKEN_ISSUER) {
    throw new Error('Invalid token issuer');
  }
  if (process.env.ORVA_TOKEN_AUDIENCE && claims.aud !== process.env.ORVA_TOKEN_AUDIENCE) {
    throw new Error('Invalid token audience');
  }
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('Missing subject');
  if (typeof claims.organization_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(claims.organization_id)) {
    throw new Error('Missing or invalid organization_id');
  }
  if (!Array.isArray(claims.permissions)) throw new Error('Missing permissions claim');

  return claims;
}
