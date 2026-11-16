import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvFile, configFor } from '../../scripts/stack.mjs';

const env = (kind, db, mode) => ({
  APP_ENV: kind, NODE_ENV: mode, POSTGRES_DB: db, POSTGRES_USER: 'pnk_app',
  POSTGRES_PASSWORD: 'contraseña-ejemplo-local',
  DATABASE_URL: `postgresql://pnk_app:contrase%C3%B1a-ejemplo-local@127.0.0.1:5432/${db}`
});

test('automatización: detecta variables duplicadas y analiza claves con =', () => {
  assert.deepEqual(parseEnvFile('# test\nAPP_ENV=qa\nPOSTGRES_PASSWORD=abc=123\n'),
    { APP_ENV: 'qa', POSTGRES_PASSWORD: 'abc=123' });
  assert.throws(() => parseEnvFile('APP_ENV=qa\nAPP_ENV=prod\n'), /duplicada/);
});

test('automatización: puertos aislados para DEV, QA y PROD local', () => {
  const cases = [
    ['dev', 'pnk_security', 'development', 3101, 5433],
    ['qa', 'pnk_security_qa', 'test', 3201, 5434],
    ['prod', 'pnk_security_prod', 'production', 3301, 5435]
  ];
  for (const [name, db, mode, port, dbPort] of cases) {
    const c = configFor(name, env(name, db, mode));
    assert.equal(c.env.PORT, String(port));
    assert.equal(c.env.DB_PORT, String(dbPort));
    assert.equal(c.env.POSTGRES_DB, db);
  }
});

test('automatización: rechaza entorno y base cruzados', () => {
  assert.throws(() => configFor('qa', env('dev','pnk_security','development')), /Revisar/);
  const wrong = env('qa','pnk_security_qa','test');
  wrong.DATABASE_URL = wrong.DATABASE_URL.replace('pnk_security_qa','pnk_security');
  assert.throws(() => configFor('qa', wrong), /no coincide/);
});

test('automatización: rechaza credenciales incongruentes y conexiones externas', () => {
  const mismatched = env('prod','pnk_security_prod','production');
  mismatched.POSTGRES_PASSWORD = 'distinta';
  assert.throws(() => configFor('prod', mismatched), /no coincide/);
  const external = env('prod','pnk_security_prod','production');
  external.DATABASE_URL = external.DATABASE_URL.replace('127.0.0.1','example.org');
  assert.throws(() => configFor('prod', external), /no coincide/);
});
