import pg from 'pg';

export function createPool(config) {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.sslMode === 'verify-full' ? { rejectUnauthorized: true } : false,
    max: 10,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
    query_timeout: 6000
  });
  pool.on('error', () => console.error('Conexión PostgreSQL interrumpida'));
  return pool;
}
