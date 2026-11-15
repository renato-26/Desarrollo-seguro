import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/app.js';

async function withServer(db, fn) {
  const server = createApp({ pool: db, checkDatabase: async () => true }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const resource = '/api/restaurantes/1/comentarios';
const token = 'a'.repeat(64);
const headers = { 'Content-Type': 'application/json', 'X-PNK-Request': '1' };
const params = { method: 'POST', headers, body: JSON.stringify({ comentario: 'Excelente carta' }) };

test('comentarios: escritura cross-origin rechazada antes de usar PostgreSQL', async () => {
  const db = { async query() { throw new Error('No debería consultar DB'); } };
  await withServer(db, async url => {
    const res = await fetch(url + resource, { ...params, headers: { ...headers, Origin: 'https://atacante.example' } });
    assert.equal(res.status, 403);
    const noHeader = await fetch(url + resource, { ...params, headers: { 'Content-Type': 'application/json' } });
    assert.equal(noHeader.status, 403);
  });
});

test('comentarios: publicar requiere sesión válida', async () => {
  const db = { async query() { throw new Error('No debería consultar DB'); } };
  await withServer(db, async url => {
    const res = await fetch(url + resource, params);
    assert.equal(res.status, 401);
  });
});

test('comentarios: valida texto y guarda autor de sesión en consulta parametrizada', async () => {
  const user = { id: 1, nombre: 'Administrador', email: 'admin@gmail.com' };
  let insertion;
  const db = { async query(sql, values) {
    if (sql.includes('FROM auth_sessions s JOIN usuarios')) return { rows: [user] };
    if (sql.includes('INSERT INTO comentarios')) {
      insertion = { sql, values };
      return { rows: [{ id: 9, usuario: values[2], comentario: values[3] }] };
    }
    throw new Error('SQL inesperado');
  } };
  await withServer(db, async url => {
    const auth = { ...headers, Cookie: `pnk_session=${token}` };
    const tooLong = await fetch(url + resource, { method: 'POST', headers: auth, body: JSON.stringify({ comentario: 'x'.repeat(1001) }) });
    assert.equal(tooLong.status, 400);
    assert.equal(insertion, undefined);
    const empty = await fetch(url + resource, { method: 'POST', headers: auth, body: JSON.stringify({ comentario: '   ' }) });
    assert.equal(empty.status, 400);
    const comment = `<img src=x onerror=alert(1)> " ' ; --`;
    const result = await fetch(url + resource, { method: 'POST', headers: auth, body: JSON.stringify({ comentario: comment, usuario: 'falso' }) });
    assert.equal(result.status, 201);
    assert.deepEqual(await result.json(), { comentario: { id: 9, usuario: 'Administrador', comentario: comment } });
    assert.equal(insertion.values[0], 1);
    assert.equal(insertion.values[1], 1);
    assert.equal(insertion.values[2], 'Administrador');
    assert.equal(insertion.values[3], comment);
    assert.match(insertion.sql, /\$4/);
    assert.doesNotMatch(insertion.sql, /onerror=alert/);
  });
});
