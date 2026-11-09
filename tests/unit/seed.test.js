import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('seed conserva todos los datos comerciales del dump original', async () => {
  const source = await readFile(new URL('../../Script_BD/pnk_security.sql', import.meta.url), 'utf8');
  const seed = await readFile(new URL('../../database/seeds/001_original_data.sql', import.meta.url), 'utf8');
  for (const table of ['direcciones', 'restautantes', 'cartas', 'categorias', 'items']) {
    const original = source.match(new RegExp('INSERT INTO `' + table + '` VALUES [^;]+;'))[0];
    const converted = original.replaceAll('`', '').replaceAll("b'1'", 'true').replaceAll("b'0'", 'false');
    assert.ok(seed.includes(converted), `Datos alterados en ${table}`);
  }
  assert.doesNotMatch(seed, /admin01|alondra01/);
  assert.match(seed, /password_hash,estado,requiere_cambio_password/);
});
