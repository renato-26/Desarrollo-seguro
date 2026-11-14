import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/app.js';

async function serve(db, callback) {
  const server = createApp({ checkDatabase: async () => true, pool: db }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('API de restaurantes: status, contenido JSON y ausencia de encabezado de tecnología', async () => {
  const db = { async query() { return { rows: [{ id: 1, nombre: 'Demo' }] }; } };
  await serve(db, async base => {
    const response = await fetch(`${base}/api/restaurantes`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.deepEqual(await response.json(), { restaurantes: [{ id: 1, nombre: 'Demo' }] });
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /PNK.*Carta Digital/);
    const legacy = await fetch(`${base}/pnkSecurity/index.php`);
    assert.equal(legacy.status, 404);
  });
});

test('API rechaza SQLi y 404 antes de consultar cartas', async () => {
  let queries = 0;
  const db = { async query() { queries++; return { rows: [] }; } };
  await serve(db, async base => {
    const attack = await fetch(`${base}/api/restaurantes/1%20OR%201%3D1/carta`);
    assert.equal(attack.status, 400);
    assert.deepEqual(await attack.json(), { error: 'Identificador de restaurante inválido' });
    assert.equal(queries, 0);
    const missing = await fetch(`${base}/api/restaurantes/999/carta`);
    assert.equal(missing.status, 404);
    assert.equal(queries, 1);
  });
});

test('API responde 503 sin filtrar secretos cuando PostgreSQL falla', async () => {
  const db = { async query() { throw new Error('postgresql://usuario:secreto@privado'); } };
  await serve(db, async base => {
    const response = await fetch(`${base}/api/restaurantes`);
    assert.equal(response.status, 503);
    const body = JSON.stringify(await response.json());
    assert.doesNotMatch(body, /secreto|privado|postgresql:/);
  });
});
