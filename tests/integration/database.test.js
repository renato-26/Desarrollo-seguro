import test from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../../backend/src/config/database.js';
import { loadConfig } from '../../backend/src/config/env.js';
import { runSqlDirectory } from '../../database/runner.js';

// Usar exclusivamente una DB de pruebas vacía; no ejecutar sobre datos de negocio.
test('PostgreSQL: migraciones, seed, relaciones, credenciales e historial', async () => {
  assert.equal(process.env.APP_ENV, 'qa', 'La integración exige APP_ENV=qa y una DB desechable');
  const pool = createPool(loadConfig());
  try {
    await runSqlDirectory(pool, 'migrate');
    await runSqlDirectory(pool, 'seed');
    await runSqlDirectory(pool, 'migrate');
    await runSqlDirectory(pool, 'seed');
    for (const [table, expected] of Object.entries({
      restautantes: 7, direcciones: 8, cartas: 11, categorias: 14, items: 6, usuarios: 2, comentarios: 0
    })) {
      const result = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
      assert.equal(result.rows[0].n, expected, table);
    }
    assert.deepEqual((await pool.query('SELECT id FROM restautantes ORDER BY id')).rows.map(r => r.id), [1,2,3,4,5,6,7]);
    assert.deepEqual((await pool.query('SELECT id FROM items ORDER BY id')).rows.map(r => r.id), [1,2,3,4,5,7]);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM usuarios WHERE password_hash IS NULL AND requiere_cambio_password')).rows[0].n, 2);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM items i
      JOIN categorias c ON c.id=i.categorias_id JOIN cartas ca ON ca.id=c.cartas_id
      JOIN restautantes r ON r.id=ca.restautantes_id`)).rows[0].n, 6);
    await assert.rejects(pool.query("INSERT INTO cartas(nombre,restautantes_id) VALUES ('test',99999)"), { code: '23503' });
    const sequence = await pool.query('SELECT last_value, is_called FROM restautantes_id_seq');
    assert.equal(Number(sequence.rows[0].last_value), 7);
    assert.equal(sequence.rows[0].is_called, true);
    const history = await pool.query("SELECT checksum FROM schema_history WHERE name='migrate/001_initial_schema.sql'");
    try {
      await pool.query("UPDATE schema_history SET checksum='tampered' WHERE name='migrate/001_initial_schema.sql'");
      await assert.rejects(runSqlDirectory(pool, 'migrate'), /Checksum diferente/);
    } finally {
      await pool.query("UPDATE schema_history SET checksum=$1 WHERE name='migrate/001_initial_schema.sql'", [history.rows[0].checksum]);
    }
  } finally { await pool.end(); }
});
