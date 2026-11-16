import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/app.js';

const token = 'a'.repeat(64);
async function withApi(user, action) {
  const queries = [];
  const db = { async query(sql, params) {
    queries.push({sql, params});
    if (sql.includes('FROM auth_sessions s JOIN usuarios')) return {rows: user ? [user] : []};
    throw new Error('Unexpected SQL');
  }};
  const server = createApp({pool: db, checkDatabase: async () => true}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await action(`http://127.0.0.1:${server.address().port}`, queries); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const request = (base, path, body, headers = {}) => fetch(base + '/api/admin/' + path, {
  method: body ? 'POST' : 'GET', headers: {Cookie: `pnk_session=${token}`, 'Content-Type':'application/json', ...headers},
  ...(body ? {body: JSON.stringify(body)} : {})
});

test('admin requires a session for every collection and dashboard', async () => {
  await withApi(null, async base => {
    for (const resource of ['dashboard','restaurantes','cartas','categorias','productos','usuarios']) {
      assert.equal((await request(base, resource)).status, 401);
    }
  });
});
test('admin rejects CLIENTE and restaurant administrator user access', async () => {
  for (const rol of ['CLIENTE', 'ADMIN_RESTAURANTE']) {
    await withApi({id: 9, rol, activo:true, restaurantes:[1]}, async base => {
      assert.equal((await request(base, 'usuarios')).status, 403);
      if (rol === 'CLIENTE') assert.equal((await request(base, 'productos')).status, 403);
      else assert.equal((await request(base, 'restaurantes', {nombre:'Local'}, {'X-PNK-Request':'1'})).status, 403);
    });
  }
});
test('admin writes require CSRF header and reject foreign origins before SQL mutation', async () => {
  await withApi({id:1, rol:'ADMIN_GENERAL', activo:true, restaurantes:[]}, async (base, queries) => {
    assert.equal((await request(base, 'productos', {nombre:'Plato'})).status, 403);
    assert.equal((await request(base, 'productos', {nombre:'Plato'}, {'X-PNK-Request':'1', Origin:'https://evil.example'})).status, 403);
    assert.equal(queries.some(({sql}) => /INSERT|UPDATE|DELETE/.test(sql)), false);
  });
});
test('admin rejects unknown fields, invalid prices, overlong values and invalid IDs before writes', async () => {
  await withApi({id:1, rol:'ADMIN_GENERAL', activo:true, restaurantes:[]}, async base => {
    for (const body of [
      {nombre:'Plato', categorias_id:1, precio:1, sql:'DROP'},
      {nombre:'Plato', categorias_id:1, precio:-1},
      {nombre:'Plato', categorias_id:1, precio:1.5},
      {nombre:'Plato', categorias_id:1, precio:2147483648},
      {nombre:'x'.repeat(101), categorias_id:1, precio:1}
    ]) assert.equal((await request(base, 'productos', body, {'X-PNK-Request':'1'})).status, 400);
    assert.equal((await request(base, 'productos/1%20OR%201=1')).status, 400);
  });
});
