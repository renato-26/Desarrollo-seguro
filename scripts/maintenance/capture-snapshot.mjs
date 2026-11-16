// Captures a read-only audit only. This script never migrates or starts services.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configFor, parseEnvFile } from '../stack.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [target, output] = process.argv.slice(2);
assert.ok(['dev','qa'].includes(target), 'Uso: node scripts/maintenance/capture-snapshot.mjs dev|qa tmp/RUTA.json');
assert.ok(output, 'Se requiere un archivo de salida nuevo dentro de tmp/');
const destination = resolve(root, output);
const outputRelative = relative(join(root,'tmp'),destination);
assert.ok(outputRelative && !outputRelative.startsWith('..') && !isAbsolute(outputRelative), 'La salida debe permanecer en tmp/');
const envFile = target === 'dev' ? '.env' : '.env.qa';
const cfg = configFor(target,parseEnvFile(readFileSync(join(root,envFile),'utf8')));
const dbContainer = `pnksecurity-${target}-db-1`;

function docker(args,input) {
  const result = spawnSync('docker',args,{cwd:root,windowsHide:true,encoding:'utf8',input,maxBuffer:32*1024*1024});
  if (result.error || result.status !== 0) throw new Error('No se pudo completar la consulta de auditoria Docker/PostgreSQL');
  return result.stdout.trim();
}
const inspectFormat = '{"id":{{json .Id}},"image":{{json .Image}},"name":{{json .Name}},"status":{{json .State.Status}},"mounts":{{json .Mounts}}}';
const dbIdentity = JSON.parse(docker(['inspect','--format',inspectFormat,dbContainer]));
const psql = ['exec','-i','--env','PGOPTIONS=-c default_transaction_read_only=on',dbContainer,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','pnk_app','-d',cfg.spec.db];
const hasAssignments = docker([...psql,'-c',"SELECT to_regclass('public.usuario_restaurantes') IS NOT NULL"]) === 't';
const assignments = hasAssignments ? "(SELECT coalesce(jsonb_agg(jsonb_build_object('usuario_id',usuario_id,'restaurante_id',restaurante_id) ORDER BY usuario_id,restaurante_id),'[]'::jsonb) FROM public.usuario_restaurantes)" : 'null';
const sql = readFileSync(new URL('./pre-update-snapshot.sql',import.meta.url),'utf8').replace('/* assignment_rows */',assignments);
const database = JSON.parse(docker(psql,sql));
assert.equal(database.database,cfg.spec.db,'La base real debe coincidir con el ambiente');
assert.equal(database.transaction_read_only,'on');
const files = readdirSync(join(root,'database/migrations')).filter(name => name.endsWith('.sql')).sort();
const migrationFiles = Object.fromEntries(files.map(name => [name,createHash('sha256').update(readFileSync(join(root,'database/migrations',name),'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
const snapshot = {capturedAt:new Date().toISOString(),target,httpPort:cfg.spec.http,postgresPort:cfg.spec.postgres,dbIdentity,migrationFiles,database};
mkdirSync(dirname(destination),{recursive:true});
writeFileSync(destination,JSON.stringify(snapshot,null,2)+'\n',{encoding:'utf8',flag:'wx'});
console.log(JSON.stringify({file:relative(root,destination),target,readOnly:database.transaction_read_only,counts:database.counts,orphans:database.orphans,hasMigration004:database.history.some(row => row.name === 'migrate/004_admin_roles.sql')}));
