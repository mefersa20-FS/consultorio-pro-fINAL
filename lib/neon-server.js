import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks;
export async function requireUser(req) {
  const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
  if (!token) throw Object.assign(new Error('Inicia sesión para continuar'), { status: 401 });
  const base = process.env.NEON_AUTH_BASE_URL;
  if (!base || !process.env.NEON_AUTH_JWKS_URL) throw Object.assign(new Error('Acceso Neon pendiente de configurar'), { status: 503 });
  jwks ||= createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: new URL(base).origin, algorithms: ['EdDSA'] });
    if (!payload.sub || !payload.exp) throw new Error('Missing identity');
    return { id: payload.sub };
  } catch {
    throw Object.assign(new Error('Sesión no válida'), { status: 401 });
  }
}

export function database() {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('Base Neon pendiente de configurar'), { status: 503 });
  const sql = neon(process.env.DATABASE_URL, { fetchOptions: { signal: AbortSignal.timeout(15000) } });
  // API handlers use a query(text, params) interface. Neon HTTP returns a callable function.
  return { query: (text, params = []) => sql(text, params) };
}

export function fail(res, error) {
  if (!error.status) console.error('PsicoVida API database error', { code:error.code, name:error.name, message:error.message });
  return res.status(error.status || 500).json({ error: error.status ? error.message : 'Error interno al guardar. Código: '+(typeof error.code === 'string' && /^[A-Z0-9]{3,8}$/.test(error.code) ? error.code : 'SERVIDOR') });
}
