export async function getHealth(checkDatabase) {
  try {
    if (!await checkDatabase()) throw new Error('Unavailable');
    return { code: 200, body: { status: 'ok', database: 'up' } };
  } catch {
    return { code: 503, body: { status: 'degraded', database: 'down' } };
  }
}
