import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/app.js';

async function withServer(checkDatabase, run) {
  const server = createApp({ checkDatabase }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('health devuelve 200 y cabeceras de seguridad con DB disponible', async () => {
  await withServer(async () => true, async base => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', database: 'up' });
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  });
});

test('health devuelve 503 sin filtrar errores internos de DB', async () => {
  await withServer(async () => { throw new Error('postgres://secret@internal'); }, async base => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'degraded', database: 'down' });
  });
});

test('rutas desconocidas y PHP original no se exponen', async () => {
  await withServer(async () => true, async base => {
    for (const path of ['/missing', '/pnkSecurity/index.php', '/Script_BD/pnk_security.sql', '/.env']) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Recurso no encontrado' });
    }
  });
});

test('JSON inválido pasa por manejo centralizado de errores', async () => {
  await withServer(async () => true, async base => {
    const response = await fetch(`${base}/api/health`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{secret'
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Solicitud inválida' });
  });
});
