import { createHash } from 'node:crypto';
import { findSession } from '../models/auth.model.js';

export const SESSION_COOKIE = 'pnk_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
export function readSessionCookie(header = '') {
  if (typeof header !== 'string') return null;
  const item = header.split(';').map(s => s.trim()).find(s => s.startsWith(`${SESSION_COOKIE}=`));
  const token = item?.slice(SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/i.test(token) ? token : null;
}
export function cookieOptions(environment = 'dev') {
  return { httpOnly: true, secure: environment === 'prod', sameSite: 'lax', path: '/', maxAge: SESSION_TTL_SECONDS * 1000 };
}
// La cabecera no puede enviarse desde un formulario HTML simple cross-origin;
// el navegador tampoco permite CORS para ella sin un preflight autorizado.
export function checkSameOriginWrite(req, res, next) {
  if (req.get('x-pnk-request') !== '1') return res.status(403).json({ error: 'Solicitud no autorizada' });
  const origin = req.get('origin');
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host !== req.get('host') || !['http:', 'https:'].includes(parsed.protocol))
        return res.status(403).json({ error: 'Origen no permitido' });
    } catch { return res.status(403).json({ error: 'Origen no permitido' }); }
  }
  return next();
}
export function loadOptionalSession(db) {
  return async (req, _res, next) => {
    const token = readSessionCookie(req.get('cookie'));
    req.sessionTokenHash = token ? hashSessionToken(token) : null;
    req.authUser = null;
    if (!req.sessionTokenHash) return next();
    try { req.authUser = await findSession(db, req.sessionTokenHash); return next(); }
    catch { return next(new Error('No se pudo comprobar la sesión')); }
  };
}
