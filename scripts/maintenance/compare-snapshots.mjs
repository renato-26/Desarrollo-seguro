// Local file comparison only. No Docker, SQL or service operations.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const [beforePath,afterPath,mode] = process.argv.slice(2);
assert.ok(beforePath && afterPath,'Uso: node scripts/maintenance/compare-snapshots.mjs ANTES.json DESPUES.json');
assert.ok(mode === undefined || mode === '--unchanged','Modo no permitido');
const before = JSON.parse(readFileSync(beforePath,'utf8'));
const after = JSON.parse(readFileSync(afterPath,'utf8'));
assert.equal(after.target,before.target,'Ambientes distintos');
assert.deepEqual(after.dbIdentity,before.dbIdentity,'El contenedor, imagen y montaje PostgreSQL deben conservarse');
assert.deepEqual(after.migrationFiles,before.migrationFiles,'Cambio de SQL durante el procedimiento');
const a = before.database, b = after.database;
assert.equal(a.transaction_read_only,'on');
assert.equal(b.transaction_read_only,'on');
assert.equal(b.database,a.database);
if (mode === '--unchanged') {
  assert.deepEqual(b,a,'La validacion de QA no debe modificar DEV');
  console.log(`OK ${before.target}: datos, esquema y PostgreSQL sin cambios.`);
  process.exit(0);
}
for (const key of ['counts','legacy_row_fingerprints','sequences','restaurants','addresses','menus','categories','products','auth_sessions','auth_attempts']) {
  assert.deepEqual(b[key],a[key],`Cambio inesperado: ${key}`);
}
assert.ok(Object.values(a.orphans).every(n => n === 0),'Existen relaciones huerfanas antes de migrar');
assert.deepEqual(b.orphans,a.orphans,'Cambio de integridad referencial');
const migration = 'migrate/004_admin_roles.sql';
const applied = b.history.find(h => h.name === migration);
assert.ok(applied,'Falta migracion 004');
assert.equal(applied.checksum,after.migrationFiles['004_admin_roles.sql']);
for (const history of a.history) assert.deepEqual(b.history.find(h => h.name === history.name),history,'Historial previo modificado');
assert.deepEqual(b.history.filter(h => h.name !== migration),a.history.filter(h => h.name !== migration));
const had004 = a.history.some(h => h.name === migration);
if (had004) {
  for (const key of ['history','roles','availability','assignments','columns','constraints','indexes']) assert.deepEqual(b[key],a[key],`004 debe ser omitida si ya fue aplicada: ${key}`);
} else {
  assert.deepEqual(b.roles,a.roles.map(row => ({...row,rol:'CLIENTE'})),'Ninguna cuenta existente debe recibir privilegios');
  assert.deepEqual(b.availability,a.availability.map(row => ({...row,disponible:true})),'La disponibilidad inicial debe conservar la oferta');
  assert.deepEqual(b.assignments,[],'La migracion no debe asignar administradores');
  const newFields = new Set(['usuarios.rol','items.disponible','usuario_restaurantes.usuario_id','usuario_restaurantes.restaurante_id']);
  assert.deepEqual(b.columns.filter(c => newFields.has(`${c.tabla}.${c.columna}`)).map(c => `${c.tabla}.${c.columna}`).sort(),[...newFields].sort(),'Columnas nuevas inesperadas');
  assert.deepEqual(b.columns.filter(c => !newFields.has(`${c.tabla}.${c.columna}`)),a.columns,'Columnas historicas alteradas');
  assert.deepEqual(b.constraints.filter(c => a.constraints.some(p => p.tabla === c.tabla && p.nombre === c.nombre)),a.constraints,'Restricciones historicas alteradas');
  assert.deepEqual(b.indexes.filter(c => a.indexes.some(p => p.tabla === c.tabla && p.nombre === c.nombre)),a.indexes,'Indices historicos alterados');
  assert.deepEqual(b.constraints.filter(c => !a.constraints.some(p => p.tabla === c.tabla && p.nombre === c.nombre)).map(c => `${c.tabla}.${c.nombre}`).sort(),['usuarios.usuarios_rol_check','usuario_restaurantes.usuario_restaurantes_pkey','usuario_restaurantes.usuario_restaurantes_usuario_id_fkey','usuario_restaurantes.usuario_restaurantes_restaurante_id_fkey'].sort(),'Restricciones nuevas inesperadas');
  assert.deepEqual(b.indexes.filter(c => !a.indexes.some(p => p.tabla === c.tabla && p.nombre === c.nombre)).map(c => c.nombre).sort(),['usuario_restaurantes_pkey','usuario_restaurantes_restaurante_idx'].sort(),'Indices nuevos inesperados');
}
for (const [table,column,defaultText] of [['usuarios','rol','CLIENTE'],['items','disponible','true']]) {
  const definition = b.columns.find(c => c.tabla === table && c.columna === column);
  assert.equal(definition?.nullable,'NO',`${table}.${column} debe ser NOT NULL`);
  assert.ok(definition.default?.includes(defaultText),`Default inesperado: ${table}.${column}`);
}
const roleCheck = b.constraints.find(c => c.tabla === 'usuarios' && c.nombre === 'usuarios_rol_check');
assert.ok(roleCheck?.validada && ['CLIENTE','ADMIN_GENERAL','ADMIN_RESTAURANTE'].every(role => roleCheck.definicion.includes(role)),'Falta CHECK de roles validado');
const assignmentConstraints = b.constraints.filter(c => c.tabla === 'usuario_restaurantes');
assert.ok(assignmentConstraints.some(c => c.validada && c.definicion.startsWith('PRIMARY KEY (usuario_id, restaurante_id)')));
for (const key of ['usuario_id','restaurante_id']) assert.ok(assignmentConstraints.some(c => c.validada && c.definicion.startsWith(`FOREIGN KEY (${key})`) && c.definicion.includes('ON DELETE RESTRICT')));
console.log(`OK ${before.target}: datos, relaciones, secuencias, sesiones, volumen y restricciones previas conservados; 004 validada.`);
