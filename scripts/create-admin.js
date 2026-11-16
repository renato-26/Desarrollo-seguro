import { pathToFileURL } from 'node:url';
import argon2 from 'argon2';
import { loadConfig } from '../backend/src/config/env.js';
import { createPool } from '../backend/src/config/database.js';
import { validateAdminInput, AdminError } from '../backend/src/services/admin.service.js';
import { withAdminTransaction, emailExists, saveAdminRecord } from '../backend/src/models/admin.model.js';

// Operación create-only: nunca concede privilegios a una cuenta preexistente.
export async function createAdministrator(db, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['nombre','email','password'].includes(key))) throw new AdminError(400,'Datos de administrador inválidos');
  const data = validateAdminInput('usuarios',input,true);
  const passwordHash = await argon2.hash(data.password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
  return withAdminTransaction(db,async client => {
    if (await emailExists(client,data.email)) throw new AdminError(409,'La cuenta ya existe; no se modificó');
    return saveAdminRecord(client,'usuarios',{
      nombre:data.nombre,email:data.email,rol:'ADMIN_GENERAL',estado:'1',password_hash:passwordHash,
      requiere_cambio_password:false,restaurantes:[]
    });
  });
}

async function main() {
  let pool;
  try {
    // Validar el entorno antes de abrir conexiones o leer credenciales.
    const config = loadConfig();
    const args = process.argv.slice(2);
    let metadata;
    if (args.length) {
      if (args.length !== 4 || args[0] !== '--nombre' || args[2] !== '--email') throw new Error('Argumentos inválidos');
      metadata = {nombre:args[1],email:args[3]};
    }
    if (process.stdin.isTTY) throw new Error('Se requieren credenciales por stdin');
    let stdin = '';
    for await (const chunk of process.stdin) {
      stdin += chunk.toString('utf8');
      if (Buffer.byteLength(stdin,'utf8') > 16384) throw new Error('Entrada demasiado extensa');
    }
    const input = metadata ? {...metadata,password:stdin.replace(/\r?\n$/, '')} : JSON.parse(stdin);
    // Toda validación sintáctica ocurre antes de conectar.
    validateAdminInput('usuarios',input,true);
    pool = createPool(config);
    const result = await createAdministrator(pool,input);
    console.log(`Administrador nuevo creado (id ${result.id}).`);
  } catch {
    console.error('No se creó el administrador. Revisa el entorno, los datos stdin y que el email sea nuevo.');
    process.exitCode = 1;
  } finally { if (pool) await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
