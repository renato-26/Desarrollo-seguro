import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/app.js';

async function withServer(db, run) {
  const server = createApp({ checkDatabase: async () => true, pool: db }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('frontend conserva nombre, clases, estilos y elementos de la interfaz de pnkSecurity', async () => {
  await withServer({ async query(){return {rows: []};} }, async base => {
    const response = await fetch(base);
    assert.equal(response.status, 200);
    const html = await response.text();
    for (const pattern of [/PNK.*Carta Digital/i, /Menús Destacados/, /Productos Seleccionados/, /Comentarios/, /food-card|pestanas-cartas/, /legacy\/css\/style\.css/]) {
      assert.match(html, pattern);
    }
    assert.equal((await fetch(base + '/static/legacy/css/style.css')).status, 200);
    assert.equal((await fetch(base + '/static/legacy/img/logo.png')).status, 200);
    assert.equal((await fetch(base + '/carrito/1')).status, 200);
    assert.equal((await fetch(base + '/pnkSecurity/index.php')).status, 404);
    assert.equal((await fetch(base + '/.env')).status, 404);
  });
});

test('comentarios consultados con parámetro seguro y límite, ataques rechazados', async () => {
  const queries = [];
  const db = { async query(query, params) {queries.push([query,params]);return {rows:[]};} };
  await withServer(db, async base => {
    assert.equal((await fetch(base + '/api/restaurantes/1/comentarios')).status,200);
    assert.equal((await fetch(base + '/api/restaurantes/1%20OR%201=1/comentarios')).status,400);
    assert.equal(queries.length,1);
    assert.deepEqual(queries[0][1],[1]);
    assert.match(queries[0][0], /LIMIT 100/);
  });
});
