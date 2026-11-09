export function createDatabaseCheck(pool) {
  return async () => {
    await pool.query('SELECT 1');
    return true;
  };
}
