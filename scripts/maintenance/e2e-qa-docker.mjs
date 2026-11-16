// Explicit execution command for AFTER an approved QA update. Never targets DEV.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { configFor, parseEnvFile } from '../stack.mjs';

const root = fileURLToPath(new URL('../../',import.meta.url));
const cfg = configFor('qa',parseEnvFile(readFileSync(new URL('../../.env.qa',import.meta.url),'utf8')));
const url = new URL(cfg.env.DATABASE_URL);
url.hostname = '127.0.0.1'; url.port = String(cfg.spec.postgres);
assert.equal(url.pathname,'/pnk_security_qa');
assert.equal(cfg.spec.http,3201);
// Verify the actual Docker backend is wired exclusively to the QA database
// before any test can POST a login (even failed logins write auth_attempts).
const inspect = spawnSync('docker',['inspect','pnksecurity-qa-backend-1','pnksecurity-qa-db-1'],{cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024});
assert.equal(inspect.status,0,'No se pudo inspeccionar el aislamiento QA');
const [backend,database] = JSON.parse(inspect.stdout);
for (const container of [backend,database]) {
  assert.equal(container.Config.Labels['com.docker.compose.project'],'pnksecurity-qa');
  assert.ok(Object.keys(container.NetworkSettings.Networks).every(name => name === 'pnksecurity-qa_default'),'Red ajena a QA');
}
const environment = Object.fromEntries(backend.Config.Env.map(entry => { const i=entry.indexOf('='); return [entry.slice(0,i),entry.slice(i+1)]; }));
assert.equal(environment.APP_ENV,'qa');
assert.equal(environment.PGDATABASE,'pnk_security_qa');
assert.equal(environment.PGHOST,'db');
assert.equal(environment.PGPORT,'5432');
assert.equal(new URL(environment.DATABASE_URL).hostname,'db');
assert.equal(new URL(environment.DATABASE_URL).pathname,'/pnk_security_qa');
const base = 'http://127.0.0.1:3201';
const health = await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(10000)});
assert.equal(health.status,200);
assert.deepEqual(await health.json(),{status:'ok',database:'up'});
const carta = await fetch(`${base}/carta/1`,{signal:AbortSignal.timeout(10000)});
assert.match(await carta.text(),/id="root"/,'QA Docker debe servir React antes de ejecutar E2E');
const admin = await fetch(`${base}/api/admin/dashboard`,{signal:AbortSignal.timeout(10000)});
assert.equal(admin.status,401,'El backend administrativo debe estar activo y protegido');
const result = spawnSync(process.execPath,['node_modules/playwright/cli.js','test','--config','scripts/maintenance/playwright.qa-docker.config.mjs'],{
  cwd:root,windowsHide:true,stdio:'inherit',env:{...cfg.env,DATABASE_URL:url.href,EXPECT_DATABASE_UP:'1'}
});
if (result.error || result.status !== 0) process.exitCode = 1;
