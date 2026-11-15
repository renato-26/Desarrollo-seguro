import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import argon2 from 'argon2';
import { loadConfig } from '../backend/src/config/env.js';
import { createPool } from '../backend/src/config/database.js';

const id = Number(process.argv[2]);
if (!Number.isSafeInteger(id) || id < 1) {
  console.error('Uso: node --env-file=.env scripts/set-user-password.js ID_USUARIO');
  process.exit(1);
}
if (!process.stdin.isTTY) {
  console.error('Ejecutar en una terminal interactiva para ocultar la contraseña.');
  process.exit(1);
}

function askSecret(prompt) {
  return new Promise((resolve, reject) => {
    const silent = new Writable({ write(_chunk, _enc, callback) { callback(); } });
    const rl = createInterface({ input: process.stdin, output: silent, terminal: true });
    process.stdout.write(prompt);
    rl.question('', answer => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    rl.once('SIGINT', () => { rl.close(); reject(new Error('Cancelado')); });
  });
}
let db;
try {
  const config = loadConfig();
  if (!['dev', 'qa'].includes(config.environment)) throw new Error('Solo permitido en DEV o QA');
  db = createPool(config);
  const account = await db.query('SELECT id, nombre, email FROM usuarios WHERE id = $1 AND estado = $2', [id, '1']);
  if (!account.rowCount) throw new Error('Usuario no encontrado o inactivo');
  console.log(`Configurar contraseña de ${account.rows[0].email || account.rows[0].nombre} (ID ${id})`);
  const one = await askSecret('Nueva contraseña (mínimo 12 caracteres): ');
  const two = await askSecret('Repetir contraseña: ');
  if (one !== two || one.length < 12 || one.length > 128) throw new Error('Contraseñas distintas o longitud inválida (12–128)');
  const hash = await argon2.hash(one, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await db.query('UPDATE usuarios SET password_hash = $1, requiere_cambio_password = false WHERE id = $2', [hash, id]);
  await db.query('DELETE FROM auth_sessions WHERE usuario_id = $1', [id]);
  console.log('Cuenta habilitada con hash Argon2id. Sesiones anteriores revocadas.');
} catch (error) { console.error('No fue posible configurar la cuenta:', error.message); process.exitCode = 1; }
finally { if (db) await db.end(); }
