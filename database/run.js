import { loadConfig } from '../backend/src/config/env.js';
import { createPool } from '../backend/src/config/database.js';
import { runSqlDirectory } from './runner.js';

let pool;
try {
  pool = createPool(loadConfig());
  await runSqlDirectory(pool, process.argv[2]);
} catch {
  console.error('No se pudo aplicar SQL. Revisar conexión, orden de migraciones e historial de checksums.');
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
