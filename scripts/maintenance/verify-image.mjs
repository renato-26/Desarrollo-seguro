// Intended for a read-only audit bind mount in a one-off image container.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

assert.equal(Number(process.versions.node.split('.')[0]),24);
assert.notEqual(process.getuid(),0,'La imagen debe ejecutar como usuario no root');
const appRoot = '/app';
const require = createRequire(`${appRoot}/package.json`);
const pkg = JSON.parse(readFileSync(`${appRoot}/package.json`,'utf8'));
for (const name of Object.keys(pkg.dependencies)) require.resolve(name);
const argon2 = require('argon2');
const probe = 'image-native-dependency-probe';
const hash = await argon2.hash(probe,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
assert.ok(await argon2.verify(hash,probe),'La dependencia nativa Argon2 debe funcionar');
const html = readFileSync(`${appRoot}/frontend/dist/index.html`,'utf8');
assert.match(html,/id="root"/);
assert.match(html,/<script\b[^>]*type="module"/);
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(m => m[1]);
assert.ok(assets.some(path => path.endsWith('.js')));
assert.ok(assets.some(path => path.endsWith('.css')));
for (const asset of assets) {
  assert.ok(!asset.includes('..'));
  assert.ok(existsSync(resolve(`${appRoot}/frontend/dist`,asset.slice(1))),`Falta asset compilado: ${asset}`);
}
for (const path of ['frontend/public/legacy/css/style.css','frontend/public/legacy/vendors/bootstrap/bootstrap.min.css','backend/src/server.js','database/runner.js','database/migrations/004_admin_roles.sql','scripts/create-admin.js']) assert.ok(existsSync(`${appRoot}/${path}`),`Falta ${path}`);
for (const path of ['.env','.env.qa','.env.prod','node_modules/vite','node_modules/@playwright/test']) assert.equal(existsSync(`${appRoot}/${path}`),false,`No debe incluirse ${path}`);
const dependencies = spawnSync('npm',['ls','--omit=dev','--depth=0'],{cwd:appRoot,stdio:'inherit'});
assert.equal(dependencies.status,0,'Dependencias de runtime invalidas');
console.log('OK: Node 24, usuario no root, dependencias nativas, React compilado y recursos presentes; sin Vite ni Playwright de runtime. No se consulto PostgreSQL.');
