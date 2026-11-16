#!/usr/bin/env node
// Automatización de entornos Docker locales para pnkSecurity EVA 3.
// No administra AWS ni archivos .env. Nunca borra volúmenes.
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const environments = Object.freeze({
  dev:  { file: '.env',      http: 3101, postgres: 5433, node: 'development', db: 'pnk_security' },
  qa:   { file: '.env.qa',   http: 3201, postgres: 5434, node: 'test',        db: 'pnk_security_qa' },
  prod: { file: '.env.prod', http: 3301, postgres: 5435, node: 'production',  db: 'pnk_security_prod' }
});

export function parseEnvFile(contents) {
  const result = {};
  for (const line of contents.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(stripped);
    if (!match) throw new Error('Archivo de entorno con una línea inválida');
    const [, key, original] = match;
    if (Object.hasOwn(result, key)) throw new Error(`Variable duplicada: ${key}`);
    let val = original.trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1,-1);
    result[key] = val;
  }
  return result;
}

export function configFor(name, fileVars) {
  const spec = environments[name];
  if (!spec) throw new Error('Ambiente inválido: usar dev, qa o prod');
  if (fileVars.APP_ENV !== name || fileVars.NODE_ENV !== spec.node || fileVars.POSTGRES_DB !== spec.db)
    throw new Error(`Revisar APP_ENV, NODE_ENV y POSTGRES_DB en ${spec.file}`);
  if (fileVars.POSTGRES_USER !== 'pnk_app' || !fileVars.POSTGRES_PASSWORD || !fileVars.DATABASE_URL)
    throw new Error(`Faltan credenciales PostgreSQL en ${spec.file}`);
  let dbUrl;
  try { dbUrl = new URL(fileVars.DATABASE_URL); } catch { throw new Error('DATABASE_URL inválida'); }
  if (!['postgresql:', 'postgres:'].includes(dbUrl.protocol) || !['127.0.0.1','localhost'].includes(dbUrl.hostname)
      || decodeURIComponent(dbUrl.pathname) !== `/${spec.db}` || decodeURIComponent(dbUrl.username) !== fileVars.POSTGRES_USER
      || decodeURIComponent(dbUrl.password) !== fileVars.POSTGRES_PASSWORD)
    throw new Error('DATABASE_URL no coincide con las credenciales y DB del ambiente local');
  const env = { ...process.env, ...fileVars, APP_ENV: name, NODE_ENV: spec.node,
    PORT: String(spec.http), DB_PORT: String(spec.postgres) };
  return { name, spec, env, dbUrl };
}

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw new Error(`No se pudo ejecutar ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Falló ${command} (código ${result.status ?? 'desconocido'})`);
}

function docker(spec, cfg, ...args) { run('docker', ['compose', '--env-file', spec.file, ...args], cfg.env); }
function node(cfg, ...args) { run(process.execPath, args, cfg.env); }

async function check(cfg) {
  const base = `http://127.0.0.1:${cfg.spec.http}`;
  const call = async (path) => {
    const abort = AbortSignal.timeout(10000);
    const response = await fetch(base + path, { signal: abort });
    if (!response.ok) throw new Error(`HTTP ${response.status} en ${path}`);
    return response.json();
  };
  const health = await call('/api/health');
  if (health.status !== 'ok' || health.database !== 'up') throw new Error('El backend o la base no están saludables');
  const restaurants = await call('/api/restaurantes');
  // No presuponer forma específica de la API; se verifica un 200 y JSON válido.
  console.log(`OK: ${cfg.name} ${base}, PostgreSQL conectado; catálogo respondió JSON (${Array.isArray(restaurants) ? 'lista' : 'objeto'}).`);
}

function usage() {
  console.log(`Uso: node scripts/stack.mjs <comando> <ambiente>\n\nComandos:\n  up dev|qa|prod     Construir/iniciar y migrar; en DEV/QA aplicar seeds\n  seed dev|qa|prod   Aplicar seeds pendientes (PROD local solo explícitamente)\n  status dev|qa|prod Mostrar estados sin modificar\n  check dev|qa|prod  Probar salud HTTP y catálogo\n  down dev|qa|prod   Detener contenedores SIN eliminar volúmenes\n  test qa            Unitarias, integración contra QA Docker y E2E\n\nSolo Docker local. AWS y Cloudflare se configuran por separado.`);
}

async function main(argv) {
  const [action, name] = argv;
  if (!action || action === '--help' || !name) { usage(); if (action !== '--help') process.exitCode = 1; return; }
  if (!['up','seed','status','check','down','test'].includes(action)) throw new Error('Comando no admitido');
  const spec = environments[name];
  if (!spec) throw new Error('Ambiente inválido');
  if (action === 'test' && name !== 'qa') throw new Error('Las pruebas de integración solo están autorizadas en QA');
  let fileVars;
  try { fileVars = parseEnvFile(readFileSync(join(root, spec.file), 'utf8')); }
  catch (error) { throw new Error(`Revisar ${spec.file}: ${error.message}`); }
  const cfg = configFor(name, fileVars);
  console.log(`Ambiente: ${name} | HTTP: ${spec.http} | PostgreSQL Docker: ${spec.postgres}`);
  if (action === 'up') {
    docker(spec, cfg, 'up', '-d', '--build');
    if (name !== 'prod') {
      docker(spec, cfg, 'run', '--rm', 'migrate', 'node', 'database/run.js', 'seed');
    } else {
      console.log('PROD local: seeds NO automáticos. Ejecutar "seed prod" solo si se desea importar datos de demostración.');
    }
    await check(cfg);
  } else if (action === 'seed') {
    docker(spec, cfg, 'run', '--rm', 'migrate', 'node', 'database/run.js', 'seed');
  } else if (action === 'status') {
    docker(spec, cfg, 'ps', '-a');
  } else if (action === 'check') {
    await check(cfg);
  } else if (action === 'down') {
    docker(spec, cfg, 'down'); // nunca --volumes
  } else if (action === 'test') {
    // La integración modifica schema_history para comprobar checksums: exclusivamente DB QA.
    docker(spec, cfg, 'ps');
    const qaUrl = new URL(fileVars.DATABASE_URL);
    qaUrl.hostname = '127.0.0.1';
    qaUrl.port = String(spec.postgres);
    const testCfg = { ...cfg, env: { ...cfg.env, DATABASE_URL: qaUrl.href, EXPECT_DATABASE_UP: '1', E2E_PORT: '3401' } };
    const unitTests = readdirSync(join(root, 'tests/unit'))
      .filter(n => n.endsWith('.test.js')).sort().map(n => `tests/unit/${n}`);
    node(testCfg, '--test', ...unitTests);
    node(testCfg, '--test', 'tests/integration/database.test.js');
    node(testCfg, 'node_modules/playwright/cli.js', 'test');
    console.log('OK: pruebas unitarias, integración QA Docker y E2E completadas.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`ERROR: ${error.message}`); // sin imprimir secretos
    process.exitCode = 1;
  });
}
