import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRestaurantId, getRestaurantMenu } from '../../backend/src/services/catalog.service.js';

test('ID positivo de PostgreSQL válido y rechazo de entradas maliciosas', () => {
  for (const value of ['0', '-1', '1 OR 1=1', '1;DROP TABLE items', '../2', '1.5', '', '2147483648']) {
    assert.equal(parseRestaurantId(value), null, `Debe rechazar ${value}`);
  }
  assert.equal(parseRestaurantId('2'), 2);
});

test('carta anidada sin mezclar productos de otros restaurantes ni categorías invisibles', async () => {
  const calls = [];
  const rows = [
    [{ id: 1, nombre: 'Restaurante A' }],
    [{ id: 10, nombre: 'Principales' }],
    [{ id: 20, cartas_id: 10, nombre: 'Carnes' }],
    [{ id: 30, categorias_id: 20, nombre: 'Lomo', destacado: true }]
  ];
  const db = { async query(sql, params) { calls.push({ sql, params }); return { rows: rows[calls.length - 1] }; } };
  const result = await getRestaurantMenu(db, 1);
  assert.equal(result.restaurante.nombre, 'Restaurante A');
  assert.equal(result.cartas[0].categorias[0].productos[0].nombre, 'Lomo');
  assert.equal(result.destacados.length, 1);
  assert.equal(calls.length, 4);
  for (const call of calls) {
    assert.deepEqual(call.params, [1]);
    assert.match(call.sql, /\$1/);
    assert.match(call.sql, /eliminad[oa] IS NULL/);
  }
});

test('restaurante inexistente no consulta menús de otros restaurantes', async () => {
  let count=0;
  const db={async query() {count++;return {rows:[]};}};
  assert.equal(await getRestaurantMenu(db,99),null);
  assert.equal(count,1);
});
