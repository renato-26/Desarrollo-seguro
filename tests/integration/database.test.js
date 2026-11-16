import test from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../../backend/src/config/database.js';
import { loadConfig } from '../../backend/src/config/env.js';
import { runSqlDirectory } from '../../database/runner.js';
import { getRestaurantMenu, listRestaurants } from '../../backend/src/services/catalog.service.js';
import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { findUserForLogin } from '../../backend/src/models/auth.model.js';
import { findComments } from '../../backend/src/models/catalog.model.js';

// QA admite fixtures adicionales; las aserciones comerciales se limitan a los IDs históricos.
test('PostgreSQL: migraciones, seed, relaciones, credenciales e historial', async () => {
  assert.equal(process.env.APP_ENV, 'qa', 'La integración exige APP_ENV=qa y una DB desechable');
  const pool = createPool(loadConfig());
  try {
    const actual = await pool.query('SELECT current_database() AS name');
    assert.equal(actual.rows[0].name, 'pnk_security_qa', 'Prohibido escribir fuera de la DB QA');
    await runSqlDirectory(pool, 'migrate');
    await runSqlDirectory(pool, 'seed');
    await runSqlDirectory(pool, 'migrate');
    await runSqlDirectory(pool, 'seed');
    for (const [table, [expected, maxId]] of Object.entries({
      restautantes: [7,7], direcciones: [8,8], cartas: [11,12], categorias: [14,14], items: [6,7], usuarios: [2,2]
    })) {
      const result = await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE id <= $1`, [maxId]);
      assert.equal(result.rows[0].n, expected, table);
    }
    assert.deepEqual((await pool.query('SELECT id FROM restautantes WHERE id <= 7 ORDER BY id')).rows.map(r => r.id), [1,2,3,4,5,6,7]);
    assert.deepEqual((await pool.query('SELECT id FROM items WHERE id <= 7 ORDER BY id')).rows.map(r => r.id), [1,2,3,4,5,7]);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM usuarios WHERE id <= 2 AND password_hash IS NULL AND requiere_cambio_password')).rows[0].n, 2);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM items i
      JOIN categorias c ON c.id=i.categorias_id JOIN cartas ca ON ca.id=c.cartas_id
      JOIN restautantes r ON r.id=ca.restautantes_id WHERE i.id <= 7`)).rows[0].n, 6);
    await assert.rejects(pool.query("INSERT INTO cartas(nombre,restautantes_id) VALUES ('test',99999)"), { code: '23503' });
    const sequence = await pool.query('SELECT last_value, is_called FROM restautantes_id_seq');
    assert.ok(Number(sequence.rows[0].last_value) >= 7);
    assert.equal(sequence.rows[0].is_called, true);
    // EVA3: validar el catálogo real y aislamiento entre restaurantes.
    const restaurants = await listRestaurants(pool);
    assert.deepEqual(restaurants.filter(r => r.id <= 7).map(r => r.id), [1,2,3,4,5,6,7]);
    const firstMenu = await getRestaurantMenu(pool, 1);
    assert.equal(firstMenu.restaurante.id, 1);
    const visibleIds = firstMenu.cartas.flatMap(c => c.categorias.flatMap(k => k.productos.map(p => p.id))).sort((a,b) => a-b);
    assert.deepEqual(visibleIds, [1, 2, 4, 5, 7]);
    assert.deepEqual(firstMenu.destacados.map(p => p.id).sort((a,b) => a-b), [2, 5, 7]);
    const secondMenu = await getRestaurantMenu(pool, 2);
    assert.equal(secondMenu.restaurante.id, 2);
    assert.equal(secondMenu.cartas.flatMap(c => c.categorias.flatMap(k => k.productos)).length, 0);
    assert.equal(await getRestaurantMenu(pool, 999), null);
    const history = await pool.query("SELECT checksum FROM schema_history WHERE name='migrate/001_initial_schema.sql'");
    try {
      await pool.query("UPDATE schema_history SET checksum='tampered' WHERE name='migrate/001_initial_schema.sql'");
      await assert.rejects(runSqlDirectory(pool, 'migrate'), /Checksum diferente/);
    } finally {
      await pool.query("UPDATE schema_history SET checksum=$1 WHERE name='migrate/001_initial_schema.sql'", [history.rows[0].checksum]);
    }
  } finally { await pool.end(); }
});

test('PostgreSQL QA: el correo tiene prioridad sobre nombres y los nombres ambiguos no autentican', async () => {
  assert.equal(process.env.APP_ENV, 'qa');
  const pool = createPool(loadConfig());
  const client = await pool.connect();
  try {
    assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'pnk_security_qa');
    await client.query('BEGIN');
    const suffix = randomBytes(8).toString('hex');
    const email = `email-${suffix}@qa.invalid`;
    await client.query("INSERT INTO usuarios(nombre,email,estado) VALUES($1,$2,'1')", [email,`other-${suffix}@qa.invalid`]);
    const account = await client.query("INSERT INTO usuarios(nombre,email,estado) VALUES($1,$2,'1') RETURNING id", [`Real ${suffix}`,email]);
    assert.equal((await findUserForLogin(client,email))?.id,account.rows[0].id);
    const name = `Duplicado ${suffix}`;
    await client.query("INSERT INTO usuarios(nombre,email,estado) VALUES($1,$2,'1'),($1,$3,'1')", [name,`one-${suffix}@qa.invalid`,`two-${suffix}@qa.invalid`]);
    assert.equal(await findUserForLogin(client,name),null);
    assert.equal((await findUserForLogin(client,`Real ${suffix}`))?.id,account.rows[0].id);
  } finally { await client.query('ROLLBACK'); client.release(); await pool.end(); }
});

test('PostgreSQL QA: comentarios conserva los cien mas recientes en orden cronologico', async () => {
  assert.equal(process.env.APP_ENV, 'qa');
  const pool = createPool(loadConfig());
  const client = await pool.connect();
  try {
    assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'pnk_security_qa');
    await client.query('BEGIN');
    const prefix = `Comentario QA ${randomBytes(8).toString('hex')} `;
    const inserted = await client.query("INSERT INTO comentarios(usuario,comentario,id_restaurante) SELECT 'QA regression', $1 || n::text, 1 FROM generate_series(1,105) AS n RETURNING id",[prefix]);
    const comments = await findComments(client,1);
    assert.equal(comments.length,100);
    assert.equal(comments.at(-1).comentario,`${prefix}105`);
    assert.equal(comments[0].id,inserted.rows[5].id);
    assert.ok(comments.every((row,i) => i === 0 || comments[i-1].id < row.id));
  } finally { await client.query('ROLLBACK'); client.release(); await pool.end(); }
});

test('PostgreSQL: instalación limpia con migraciones 001–004 y seeds, aislada y revertida en QA', async () => {
  assert.equal(process.env.APP_ENV, 'qa');
  const config = loadConfig();
  assert.equal(new URL(config.databaseUrl).pathname, '/pnk_security_qa');
  const pool = createPool(config);
  const client = await pool.connect();
  const schema = `qa_install_${randomBytes(8).toString('hex')}`;
  try {
    assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'pnk_security_qa');
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}`);
    for (const directory of ['migrations', 'seeds']) {
      const path = new URL(`../../database/${directory}/`, import.meta.url);
      for (const file of (await readdir(path)).filter(f => f.endsWith('.sql')).sort()) {
        await client.query(await readFile(new URL(file, path), 'utf8'));
      }
    }
    assert.equal((await client.query('SELECT count(*)::int AS n FROM restautantes')).rows[0].n, 7);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM usuarios WHERE rol='CLIENTE' AND password_hash IS NULL")).rows[0].n, 2);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM items WHERE disponible')).rows[0].n, 6);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM items WHERE destacado AND visible AND eliminado IS NULL AND disponible')).rows[0].n, 3);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    try {
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM pg_namespace WHERE nspname=$1', [schema])).rows[0].n, 0);
    } finally { await pool.end(); }
  }
});
