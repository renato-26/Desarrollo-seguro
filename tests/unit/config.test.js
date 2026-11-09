import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../../backend/src/config/env.js';

const valid = { DATABASE_URL: 'postgresql://app:example@localhost:5432/pnk_security' };
test('configuración aplica DEV por defecto', () => {
  assert.equal(loadConfig(valid).environment, 'dev');
  assert.equal(loadConfig(valid).port, 3000);
});
test('configuración rechaza valores inválidos sin exponer secretos', () => {
  for (const change of [
    { DATABASE_URL: '' }, { DATABASE_URL: 'https://secret' },
    { PORT: '0' }, { PORT: 'abc' }, { PORT: '65536' },
    { APP_ENV: 'unknown' }, { NODE_ENV: 'unknown' },
    { APP_ENV: 'prod', NODE_ENV: 'development' }, { DB_SSL: 'false' }
  ]) assert.throws(() => loadConfig({ ...valid, ...change }), /Configuración inválida/);
});
