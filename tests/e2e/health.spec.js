import { test, expect } from '@playwright/test';

test('contrato HTTP de salud sobre Express real', async ({ request }) => {
  const response = await request.get('/api/health');
  const expectedStatus = process.env.EXPECT_DATABASE_UP === '1' ? 200 : 503;
  expect(response.status()).toBe(expectedStatus);
  expect(await response.json()).toEqual(expectedStatus === 200
    ? { status: 'ok', database: 'up' } : { status: 'degraded', database: 'down' });
  expect(response.headers()['x-powered-by']).toBeUndefined();
});

test('archivos internos y PHP no son accesibles desde Express', async ({ request }) => {
  for (const path of ['/.env', '/pnkSecurity/index.php', '/Script_BD/pnk_security.sql']) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'Recurso no encontrado' });
  }
});
