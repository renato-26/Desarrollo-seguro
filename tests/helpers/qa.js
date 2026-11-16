import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { createPool } from '../../backend/src/config/database.js';
import { loadConfig } from '../../backend/src/config/env.js';

export async function qaFixture() {
  assert.equal(process.env.APP_ENV, 'qa', 'Las pruebas con escritura exigen APP_ENV=qa');
  const config = loadConfig();
  assert.equal(decodeURIComponent(new URL(config.databaseUrl).pathname), '/pnk_security_qa');
  const pool = createPool(config);
  const actual = await pool.query('SELECT current_database() AS name');
  assert.equal(actual.rows[0].name, 'pnk_security_qa');
  const suffix = randomBytes(8).toString('hex');
  const password = randomBytes(24).toString('base64url');
  const email = `e2e-${suffix}@qa.invalid`;
  const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const { rows } = await pool.query(`INSERT INTO usuarios(nombre,email,password_hash,estado,requiere_cambio_password,rol)
    VALUES($1,$2,$3,'1',false,'ADMIN_GENERAL') RETURNING id`, [`QA ${suffix}`, email, hash]);
  const userIds = [rows[0].id], restaurantIds = [];
  return { pool, suffix, email, password, userIds, restaurantIds, async close() {
    try {
      await pool.query("UPDATE usuarios SET estado='0' WHERE id=ANY($1::integer[])", [userIds]);
      await pool.query('UPDATE restautantes SET eliminado=now() WHERE id=ANY($1::integer[])', [restaurantIds]);
    } finally { await pool.end(); }
  } };
}
