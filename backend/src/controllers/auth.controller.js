import { randomBytes, createHash } from 'node:crypto';
import argon2 from 'argon2';
import { findUserForLogin, isBlocked, recordFailure, clearFailures, insertSession, revokeSession } from '../models/auth.model.js';
import { cookieOptions, SESSION_COOKIE, SESSION_TTL_SECONDS } from '../middleware/auth.js';

const MAX_EMAIL_LENGTH = 255;
function validLogin(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const { identifier, password } = body;
  return typeof identifier === 'string' && identifier.trim().length > 0
    && identifier.trim().length <= MAX_EMAIL_LENGTH
    && typeof password === 'string' && password.length > 0 && password.length <= 1024;
}
function publicUser(row) { return { id: row.id, nombre: row.nombre, email: row.email }; }
function keyForAttempt(req, identifier) {
  return createHash('sha256').update(`${req.ip}|${identifier.toLowerCase()}`).digest('hex');
}
export function createAuthController(db, environment = 'dev') {
  return {
    me: (req, res) => res.json({ usuario: req.authUser ? publicUser(req.authUser) : null }),
    login: async (req, res) => {
      res.set('Cache-Control', 'no-store');
      if (!validLogin(req.body)) return res.status(400).json({ error: 'Datos de acceso inválidos' });
      const identifier = req.body.identifier.trim().toLowerCase();
      const attemptKey = keyForAttempt(req, identifier);
      try {
        if (await isBlocked(db, attemptKey)) return res.status(429).json({ error: 'Demasiados intentos. Vuelve a probar más tarde.' });
        const user = await findUserForLogin(db, identifier);
        let valid = false;
        if (user?.password_hash && !user.requiere_cambio_password) {
          valid = await argon2.verify(user.password_hash, req.body.password);
        } else {
          // Trabajo Argon2id adicional para reducir diferencias de tiempo entre cuentas.
          await argon2.hash(req.body.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
        }
        if (!valid) {
          const blocked = await recordFailure(db, attemptKey);
          return res.status(blocked ? 429 : 401).json({ error: blocked
            ? 'Demasiados intentos. Vuelve a probar más tarde.' : 'Credenciales incorrectas' });
        }
        await clearFailures(db, attemptKey);
        const token = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(token).digest('hex');
        await insertSession(db, tokenHash, user.id, SESSION_TTL_SECONDS);
        res.cookie(SESSION_COOKIE, token, cookieOptions(environment));
        return res.json({ usuario: publicUser(user) });
      } catch { return res.status(503).json({ error: 'Autenticación temporalmente no disponible' }); }
    },
    logout: async (req, res) => {
      res.set('Cache-Control', 'no-store');
      try {
        if (req.sessionTokenHash) await revokeSession(db, req.sessionTokenHash);
        res.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, secure: environment === 'prod', sameSite: 'lax' });
        return res.status(204).end();
      } catch { return res.status(503).json({ error: 'No fue posible cerrar la sesión' }); }
    }
  };
}
