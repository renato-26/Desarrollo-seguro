// Read-only PostgreSQL backup to a new local file. No restore is implemented.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { openSync, closeSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, relative, isAbsolute, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configFor, parseEnvFile } from '../stack.mjs';

const root = fileURLToPath(new URL('../../',import.meta.url));
const [target,path] = process.argv.slice(2);
assert.ok(['dev','qa'].includes(target) && path,'Uso: node scripts/maintenance/backup-database.mjs dev|qa tmp/ARCHIVO.dump');
const destination = resolve(root,path);
const local = relative(join(root,'tmp'),destination);
assert.ok(local && !local.startsWith('..') && !isAbsolute(local),'El backup debe permanecer dentro de tmp/');
const cfg = configFor(target,parseEnvFile(readFileSync(join(root,target === 'dev' ? '.env' : '.env.qa'),'utf8')));
const container = `pnksecurity-${target}-db-1`;
mkdirSync(dirname(destination),{recursive:true});
const fd = openSync(destination,'wx');
let result;
try {
  result = spawnSync('docker',['exec','--env','PGOPTIONS=-c default_transaction_read_only=on',container,'pg_dump','--username=pnk_app',`--dbname=${cfg.spec.db}`,'--format=custom','--no-owner','--no-privileges','--no-password'],{cwd:root,windowsHide:true,stdio:['ignore',fd,'pipe']});
} finally { closeSync(fd); }
assert.ok(!result.error && result.status === 0,'Backup incompleto; no continuar');
const archive = readFileSync(destination);
assert.equal(archive.subarray(0,5).toString('ascii'),'PGDMP','Formato de backup inesperado');
const listing = spawnSync('docker',['exec','-i',container,'pg_restore','--list'],{cwd:root,windowsHide:true,input:archive,maxBuffer:8*1024*1024});
assert.ok(!listing.error && listing.status === 0,'El archivo no tiene un indice de backup legible');
assert.ok(listing.stdout.toString('utf8').includes(cfg.spec.db),'La cabecera del backup debe indicar la base esperada');
console.log(`Backup ${target} guardado; formato custom e indice legibles. No se ejecuto ninguna restauracion.`);
