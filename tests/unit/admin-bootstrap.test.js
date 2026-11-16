import test from 'node:test';
import assert from 'node:assert/strict';

test('bootstrap exports an explicit create-only administrator operation', async () => {
  const module = await import('../../scripts/create-admin.js').catch(() => ({}));
  assert.equal(typeof module.createAdministrator,'function');
});

test('bootstrap refuses an existing email and never updates or elevates it', async () => {
  const {createAdministrator} = await import('../../scripts/create-admin.js').catch(() => ({}));
  assert.equal(typeof createAdministrator,'function');
  const statements = [];
  const client = {async query(sql) {
    statements.push(sql);
    return {rows: sql.startsWith('SELECT id FROM usuarios') ? [{id:1}] : []};
  },release(){}};
  await assert.rejects(createAdministrator({async connect(){return client;}},{nombre:'Nuevo',email:'exists@example.com',password:'UnaClaveSegura2026'}),error => error.status === 409);
  assert.equal(statements.some(sql => /^(INSERT|UPDATE)/.test(sql)),false);
  assert.ok(statements.includes('ROLLBACK'));
});

test('bootstrap creates ADMIN_GENERAL with Argon2id and does not return credentials', async () => {
  const {createAdministrator} = await import('../../scripts/create-admin.js').catch(() => ({}));
  assert.equal(typeof createAdministrator,'function');
  let inserted;
  const client = {async query(sql,params=[]) {
    if (sql.startsWith('INSERT INTO usuarios')) { inserted = {sql,params}; return {rows:[{id:88}]}; }
    if (sql.includes('FROM usuarios u')) return {rows:[{id:88,nombre:'Nuevo',email:'new@example.com',rol:'ADMIN_GENERAL',activo:true,restaurantes:[]}]};
    return {rows:[]};
  },release(){}};
  const result = await createAdministrator({async connect(){return client;}},{nombre:'Nuevo',email:'new@example.com',password:'UnaClaveSegura2026'});
  assert.equal(result.rol,'ADMIN_GENERAL');
  assert.ok(inserted.params.some(value => typeof value === 'string' && value.startsWith('$argon2id$')));
  assert.equal(inserted.params.includes('UnaClaveSegura2026'),false);
  assert.equal(Object.hasOwn(result,'password_hash'),false);
});
