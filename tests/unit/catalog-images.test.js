import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const asset = name => new URL(`../../frontend/public/legacy/imagenes/cod1/${name}`, import.meta.url);

test('la foto ilustrativa de crema de espinacas es JPEG valido y diferente del lomo original', async () => {
  const [correcta, anterior] = await Promise.all([
    readFile(asset('crema_espinacas.jpg')), readFile(asset('item2.jpg'))
  ]);
  assert.ok(correcta.length > 10_000, 'La foto de reemplazo no debe estar vacia');
  assert.deepEqual([...correcta.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.notEqual(
    createHash('sha256').update(correcta).digest('hex'),
    createHash('sha256').update(anterior).digest('hex'),
    'No reutilizar la foto incorrecta del lomo'
  );
});

test('la correccion de fotos se distribuye como seed versionado, sin modificar datos originales', async () => {
  const sql = await readFile(new URL('../../database/seeds/002_corregir_fotos_catalogo.sql', import.meta.url), 'utf8');
  assert.match(sql, /crema_espinacas\.jpg/);
  assert.match(sql, /item5\.jpg/);
  assert.match(sql, /WHERE id = 2 AND nombre = 'Crema de espinacas'/);
  assert.match(sql, /WHERE id = 7 AND nombre = 'Lomo a lo Pobre'/);
});
