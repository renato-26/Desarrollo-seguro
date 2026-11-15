import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createApp } from '../../backend/src/app.js';
import { readSessionCookie, hashSessionToken, cookieOptions } from '../../backend/src/middleware/auth.js';

test('cookie: token con 256 bits, hash irreversible y opciones seguras', () => {
  const token = randomBytes(32).toString('hex');
  assert.equal(readSessionCookie(`otro=foo; pnk_session=${token}; x=1`), token);
  assert.equal(readSessionCookie('pnk_session=abc'), null);
  assert.notEqual(hashSessionToken(token), token);
  assert.equal(cookieOptions('prod').secure, true);
  assert.equal(cookieOptions('dev').secure, false);
  assert.equal(cookieOptions('dev').httpOnly, true);
});

test('autenticación rechaza POST sin protección de origen sin consultar DB', async () => {
  let queries = 0;
  const db = { async query() { queries++; return { rows: [] }; } };
  const server = createApp({ pool: db, checkDatabase: async () => true }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const bad = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'a', password: 'b' }) });
    assert.equal(bad.status, 403);
    const cross = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-PNK-Request':'1', Origin:'https://sitio-atacante.example' }, body: JSON.stringify({ identifier: 'a', password: 'b' }) });
    assert.equal(cross.status, 403);
    assert.equal(queries, 0);
    const me = await fetch(base + '/api/auth/me');
    assert.deepEqual(await me.json(), { usuario: null });
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('login correcto genera cookie opaca, /me reconoce sesión y logout la revoca', async () => {
  const argon2 = (await import('argon2')).default;
  const password = 'ClavePrivadaDePrueba2026';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const sessions = new Map();
  const user = { id: 1, nombre: 'Administrador', email: 'admin@gmail.com', password_hash: passwordHash, requiere_cambio_password: false };
  const db = { async query(sql, params = []) {
    if (sql.includes('FROM auth_attempts WHERE attempt_hash')) return { rows: [] };
    if (sql.includes('FROM usuarios') && sql.includes('lower(email)')) return { rows: [user] };
    if (sql.startsWith('DELETE FROM auth_attempts')) return { rows: [] };
    if (sql.startsWith('INSERT INTO auth_sessions')) { sessions.set(params[0], params[1]); return { rows: [] }; }
    if (sql.includes('FROM auth_sessions s JOIN usuarios')) {
      return { rows: sessions.has(params[0]) ? [user] : [] };
    }
    if (sql.startsWith('DELETE FROM auth_sessions')) { sessions.delete(params[0]); return { rows: [] }; }
    throw new Error('SQL inesperado: ' + sql);
  } };
  const server = createApp({ pool: db, checkDatabase: async () => true }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type':'application/json', 'X-PNK-Request':'1' },
      body: JSON.stringify({identifier: user.email, password})
    });
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), { usuario: { id: 1, nombre: user.nombre, email: user.email } });
    const setCookie = login.headers.get('set-cookie');
    assert.match(setCookie, /pnk_session=[a-f0-9]{64}/);
    assert.match(setCookie, /httponly/i);
    assert.match(setCookie, /samesite=lax/i);
    const cookie = setCookie.split(';')[0];
    const me = await fetch(base + '/api/auth/me', { headers: {Cookie: cookie} });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).usuario.id, 1);
    const logout = await fetch(base + '/api/auth/logout', { method:'POST', headers: {Cookie:cookie,'X-PNK-Request':'1'} });
    assert.equal(logout.status, 204);
    const after = await fetch(base + '/api/auth/me', { headers: {Cookie:cookie} });
    assert.deepEqual(await after.json(), { usuario: null });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
