import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import * as adminService from '../../backend/src/services/admin.service.js';
const {validateAdminInput, validateAdminPhoto, assertAdminScope, createAdminService} = adminService;
import {saveAdminRecord} from '../../backend/src/models/admin.model.js';

const general = {id:1,rol:'ADMIN_GENERAL',activo:true,restaurantes:[]};
const local = {id:2,rol:'ADMIN_RESTAURANTE',activo:true,restaurantes:[1]};
test('validation permits zero CLP, safely defaults new users and tolerates optional historical nulls', () => {
  assert.equal(validateAdminInput('productos',{nombre:'Gratis',precio:0,categorias_id:1},true).precio,0);
  const user = validateAdminInput('usuarios',{nombre:'Cliente',email:'test@example.com',password:'LargaClave2026'},true);
  assert.equal(user.rol,'CLIENTE');
  assert.deepEqual(user.restaurantes,[]);
  assert.equal(validateAdminInput('productos',{descripcion:null}).descripcion,null);
  for (const body of [{nombre:null},{activo:'true'},{precio:'1'},{password:'corta'}]) {
    const resource = Object.hasOwn(body,'password') ? 'usuarios':'productos';
    assert.throws(() => validateAdminInput(resource,body),error => error.status === 400);
  }
});
test('scope rejects source and destination restaurants outside assignments and disabled users', () => {
  assert.doesNotThrow(() => assertAdminScope(local,1,'productos'));
  assert.throws(() => assertAdminScope(local,2,'productos'),error => error.status === 403);
  assert.throws(() => assertAdminScope({...general,activo:false},1,'productos'),error => error.status === 401);
  assert.throws(() => assertAdminScope({...general,activo:null},1,'productos'),error => error.status === 401);
});
test('photos allow only existing raster files in the same restaurant', async () => {
  await validateAdminPhoto('carta1.jpg',1);
  await validateAdminPhoto('/static/legacy/imagenes/cod1/carta1.jpg',1);
  for (const photo of ['../cod1/carta1.jpg','https://example.com/a.jpg','foo.svg','data:image/png;base64,abc','/static/legacy/imagenes/cod2/carta1.jpg','no-existing-file.jpg','a..jpg']) {
    await assert.rejects(validateAdminPhoto(photo,1),error => error.status === 400);
  }
  await validateAdminPhoto(null,1);
});

test('raster validation inspects magic bytes, supported format and a 5 MiB size cap', async () => {
  assert.equal(typeof adminService.validateRasterFile,'function');
  const directory = await mkdtemp(path.join(tmpdir(),'pnk-admin-photo-'));
  try {
    for (const [name,bytes] of [
      ['fake.jpg',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
      ['large.jpg',Buffer.alloc(5*1024*1024+1)],
      ['unsupported.gif',Buffer.from('GIF89a')],
      ['mismatch.png',Buffer.from([255,216,255,224])]
    ]) {
      const candidate = path.join(directory,name);
      await writeFile(candidate,bytes);
      await assert.rejects(adminService.validateRasterFile(candidate),error => error.status === 400);
    }
  } finally {
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(tmpdir()));
    await rm(directory,{recursive:true,force:true});
  }
});

function transactionPool(actor, records = {}) {
  const calls = [];
  const client = {async query(sql,params=[]) {
    calls.push({sql,params});
    if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return {rows:[]};
    if (sql.includes('FROM usuarios u WHERE u.id')) return {rows:actor ? [actor] : []};
    const resource = sql.includes('FROM items i') ? 'productos' : sql.includes('FROM categorias ca') ? 'categorias' : sql.includes('FROM cartas c') ? 'cartas' : sql.includes('FROM restautantes r') ? 'restaurantes' : '';
    if (resource) return {rows:records[resource]?.[params[0]] ? [records[resource][params[0]]] : []};
    throw new Error('Unexpected SQL: '+sql);
  },release(){calls.push({sql:'release'});}};
  return {pool:{async connect(){return client;}},calls};
}
test('writes recheck live role, and rollback when privileges were revoked', async () => {
  const {pool,calls} = transactionPool({...local,rol:'CLIENTE'});
  await assert.rejects(createAdminService(pool).save('productos',2,{precio:0},local),error => error.status === 403);
  assert.ok(calls.some(call => call.sql === 'ROLLBACK'));
  assert.equal(calls.at(-1).sql,'release');
});
test('product edits check both the existing record and the new category ownership', async () => {
  for (const [source,destination] of [[2,1],[1,2]]) {
    const {pool,calls} = transactionPool(local,{
      productos:{10:{id:10,restaurante_id:source,categorias_id:20}},
      categorias:{30:{id:30,restaurante_id:destination}}
    });
    await assert.rejects(createAdminService(pool).save('productos',10,{categorias_id:30},local),error => error.status === 403);
    assert.ok(calls.some(call => call.sql === 'ROLLBACK'));
    assert.equal(calls.some(call => /^(UPDATE|INSERT)/.test(call.sql)),false);
  }
});
test('category edits check both existing ownership and destination menu ownership', async () => {
  const {pool} = transactionPool(local,{categorias:{20:{id:20,restaurante_id:1,cartas_id:2}},cartas:{3:{id:3,restaurante_id:2}}});
  await assert.rejects(createAdminService(pool).save('categorias',20,{cartas_id:3},local),error => error.status === 403);
});
test('assignment-only user PATCH does not generate an empty SQL UPDATE or leak hashes', async () => {
  const statements = [];
  const db = {async query(sql,params) {
    statements.push(sql);
    if (sql.startsWith('UPDATE')) throw new Error('Empty updates are invalid');
    if (sql.startsWith('SELECT')) return {rows:[{id:3,nombre:'User',email:'a@example.com',rol:'CLIENTE',activo:true,restaurantes:[1]}]};
    return {rows:[]};
  }};
  const saved = await saveAdminRecord(db,'usuarios',{restaurantes:[1]},3);
  assert.deepEqual(saved.restaurantes,[1]);
  assert.equal(Object.hasOwn(saved,'password_hash'),false);
  assert.ok(statements.some(sql => sql.startsWith('INSERT INTO usuario_restaurantes')));
});

test('clearing a historical invalid photo is allowed without revalidating the removed value', async () => {
  const writes = [];
  const client = {async query(sql,params=[]) {
    if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return {rows:[]};
    if (sql.includes('FROM usuarios u WHERE')) return {rows:[general]};
    if (sql.includes('FROM items i')) return {rows:[{id:10,restaurante_id:1,categorias_id:20,foto:'https://legacy.example/image.jpg'}]};
    if (sql.includes('FROM categorias ca')) return {rows:[{id:20,restaurante_id:1}]};
    if (sql.startsWith('UPDATE items')) { writes.push(params); return {rows:[{id:10}]}; }
    throw new Error('Unexpected SQL: '+sql);
  },release(){}};
  await createAdminService({async connect(){return client;}}).save('productos',10,{foto:null},general);
  assert.equal(writes.length,1);
  assert.equal(writes[0][0],null);
});

test('moving a category validates all descendant image associations in the destination restaurant', async () => {
  const statements = [];
  const client = {async query(sql) {
    statements.push(sql);
    if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return {rows:[]};
    if (sql.includes('FROM usuarios u WHERE')) return {rows:[general]};
    if (sql.includes('FROM categorias ca')) return {rows:[{id:20,restaurante_id:1,cartas_id:10,foto:null}]};
    if (sql.includes('FROM cartas c')) return {rows:[{id:30,restaurante_id:2}]};
    if (sql.includes('FROM items i')) return {rows:[{foto:'/static/legacy/imagenes/cod1/carta1.jpg'}]};
    if (sql.startsWith('UPDATE categorias')) return {rows:[{id:20}]};
    throw new Error('Unexpected SQL: '+sql);
  },release(){}};
  await assert.rejects(createAdminService({async connect(){return client;}}).save('categorias',20,{cartas_id:30},general),error => error.status === 400);
  assert.equal(statements.some(sql => sql.startsWith('UPDATE')),false);
});
