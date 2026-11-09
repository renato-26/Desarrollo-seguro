import { loadConfig } from './config/env.js';
import { createPool } from './config/database.js';
import { createDatabaseCheck } from './models/health.model.js';
import { createApp } from './app.js';

try {
  const config = loadConfig();
  const pool = createPool(config);
  const server = createApp({ checkDatabase: createDatabaseCheck(pool) })
    .listen(config.port, '0.0.0.0', () => console.log(`PNKSecurity escuchando en puerto ${config.port}`));
  server.on('error', () => {
    console.error('No fue posible iniciar el servidor HTTP');
    pool.end().finally(() => { process.exitCode = 1; });
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      const timeout = setTimeout(() => process.exit(1), 10000).unref();
      server.close(() => pool.end().finally(() => clearTimeout(timeout)));
    });
  }
} catch {
  console.error('Configuración inválida: revisar las variables de entorno');
  process.exitCode = 1;
}
