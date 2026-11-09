import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export async function runSqlDirectory(pool, kind) {
  if (!['migrate', 'seed'].includes(kind)) throw new Error('Usar migrate o seed');
  const directory = fileURLToPath(new URL(kind === 'migrate' ? './migrations/' : './seeds/', import.meta.url));
  const files = (await readdir(directory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock(72841001)');
    locked = true;
    await client.query(`CREATE TABLE IF NOT EXISTS schema_history (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const file of files) {
      const name = `${kind}/${file}`;
      const sql = await readFile(`${directory}/${file}`, 'utf8');
      const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
      const existing = await client.query('SELECT checksum FROM schema_history WHERE name = $1', [name]);
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Checksum diferente: ${name}`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_history(name, checksum) VALUES ($1, $2)', [name, checksum]);
        await client.query('COMMIT');
        console.log(`Aplicado: ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    try {
      if (locked) await client.query('SELECT pg_advisory_unlock(72841001)');
    } finally { client.release(); }
  }
}
