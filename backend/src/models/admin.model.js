// Identificadores SQL exclusivamente internos; los valores siempre son parámetros.
const definitions = {
  restaurantes: {
    table:'restautantes', alias:'r', from:'restautantes r JOIN direcciones d ON d.id = r.direcciones_id',
    columns:'r.id, r.nombre, r.rut, r.fono, r.email, r.mapa, r.foto, d.calle, d.numero, d.comuna, d.region, r.id AS restaurante_id',
    active:'r.eliminado IS NULL AND d.eliminado IS NULL', scope:'r.id', locks:'r,d'
  },
  cartas: {
    table:'cartas', alias:'c', from:'cartas c JOIN restautantes r ON r.id = c.restautantes_id',
    columns:'c.id, c.nombre, c.orden, c.foto, c.restautantes_id, r.id AS restaurante_id',
    active:'c.visible IS TRUE AND c.eliminada IS NULL', scope:'r.id', locks:'c,r'
  },
  categorias: {
    table:'categorias', alias:'ca', from:'categorias ca JOIN cartas c ON c.id = ca.cartas_id JOIN restautantes r ON r.id = c.restautantes_id',
    columns:'ca.id, ca.nombre, ca.orden, ca.foto, ca.cartas_id, r.id AS restaurante_id',
    active:'ca.visible IS TRUE AND ca.eliminado IS NULL', scope:'r.id', locks:'ca,c,r'
  },
  productos: {
    table:'items', alias:'i', from:'items i JOIN categorias ca ON ca.id = i.categorias_id JOIN cartas c ON c.id = ca.cartas_id JOIN restautantes r ON r.id = c.restautantes_id',
    columns:'i.id, i.nombre, i.precio, i.descripcion, i.observaciones, i.tiempo, i.foto, i.orden, i.destacado, i.disponible, i.categorias_id, r.id AS restaurante_id',
    active:'i.visible IS TRUE AND i.eliminado IS NULL', scope:'r.id', locks:'i,ca,c,r'
  },
  usuarios: {
    table:'usuarios', alias:'u', from:'usuarios u',
    columns:`u.id, u.nombre, u.email, u.rol, ARRAY(SELECT restaurante_id FROM usuario_restaurantes WHERE usuario_id = u.id ORDER BY restaurante_id) AS restaurantes`,
    active:"(u.estado = '1') IS TRUE", scope:null, locks:'u'
  }
};
function definition(resource) {
  const item = Object.hasOwn(definitions, resource) && definitions[resource];
  if (!item) throw new Error('Recurso desconocido');
  return item;
}
function scopeFor(user) { return user.rol === 'ADMIN_GENERAL' ? null : user.restaurantes ?? []; }
export async function listAdminRecords(db, resource, user) {
  const d = definition(resource);
  const where = d.scope ? `WHERE ($1::integer[] IS NULL OR ${d.scope} = ANY($1))` : '';
  const {rows} = await db.query(`SELECT ${d.columns}, (${d.active}) AS activo FROM ${d.from} ${where} ORDER BY ${d.alias}.id`, d.scope ? [scopeFor(user)] : []);
  return rows;
}
export async function getAdminRecord(db, resource, id, lock = false) {
  const d = definition(resource);
  const {rows} = await db.query(`SELECT ${d.columns}, (${d.active}) AS activo FROM ${d.from} WHERE ${d.alias}.id = $1${lock ? ` FOR UPDATE OF ${d.locks}` : ''}`, [id]);
  return rows[0] ?? null;
}
export async function adminDashboard(db, user) {
  const scoped = scopeFor(user);
  const resources = Object.keys(definitions).filter(key => key !== 'usuarios' || user.rol === 'ADMIN_GENERAL');
  const query = resources.map(key => {
    const d = definition(key);
    return `SELECT '${key}' AS recurso, count(*)::integer AS total, count(*) FILTER (WHERE ${d.active})::integer AS activos FROM ${d.from} ${d.scope ? `WHERE ($1::integer[] IS NULL OR ${d.scope} = ANY($1))` : ''}`;
  }).join(' UNION ALL ');
  const {rows} = await db.query(query, [scoped]);
  return Object.fromEntries(rows.map(row => [row.recurso, {total:row.total, activos:row.activos}]));
}
export async function withAdminTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
export async function lockAdminActor(db, id) {
  const {rows} = await db.query(`SELECT u.id, u.rol, (u.estado = '1' AND NOT u.requiere_cambio_password) IS TRUE AS activo,
    ARRAY(SELECT restaurante_id FROM usuario_restaurantes WHERE usuario_id = u.id ORDER BY restaurante_id) AS restaurantes
    FROM usuarios u WHERE u.id = $1 FOR SHARE OF u`, [id]);
  return rows[0] ?? null;
}
export async function lockRestaurants(db, ids) {
  const {rows} = await db.query('SELECT id FROM restautantes WHERE id = ANY($1::integer[]) ORDER BY id FOR SHARE', [ids]);
  return rows;
}
export async function descendantPhotos(db, resource, id) {
  if (resource === 'categorias') {
    const {rows} = await db.query('SELECT i.foto FROM items i WHERE i.categorias_id = $1 ORDER BY i.id FOR UPDATE OF i', [id]);
    return rows;
  }
  if (resource === 'cartas') {
    const categories = await db.query('SELECT ca.foto FROM categorias ca WHERE ca.cartas_id = $1 ORDER BY ca.id FOR UPDATE OF ca', [id]);
    const products = await db.query('SELECT i.foto FROM items i JOIN categorias ca ON ca.id = i.categorias_id WHERE ca.cartas_id = $1 ORDER BY i.id FOR UPDATE OF i', [id]);
    return [...categories.rows,...products.rows];
  }
  return [];
}
export async function emailExists(db, email, exceptId = null) {
  // Todos los escritores administrativos toman el mismo advisory lock por email.
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended(lower($1), 0))', [email]);
  const {rows} = await db.query('SELECT id FROM usuarios WHERE lower(email) = lower($1) AND ($2::integer IS NULL OR id <> $2) LIMIT 1', [email, exceptId]);
  return rows.length > 0;
}
const writable = {
  restaurantes:['nombre','rut','fono','email','mapa','foto','eliminado','direcciones_id'],
  cartas:['nombre','restautantes_id','orden','foto','visible','eliminada'],
  categorias:['nombre','cartas_id','orden','foto','visible','eliminado'],
  productos:['nombre','categorias_id','precio','descripcion','observaciones','tiempo','foto','orden','destacado','disponible','visible','eliminado'],
  usuarios:['nombre','email','password_hash','requiere_cambio_password','rol','estado']
};
async function writeTable(db, table, fields, id) {
  const names = Object.keys(fields);
  const values = Object.values(fields);
  if (id != null && names.length === 0) return id;
  if (id != null) {
    values.push(id);
    const {rows} = await db.query(`UPDATE ${table} SET ${names.map((name,i) => `${name} = $${i + 1}`).join(', ')} WHERE id = $${values.length} RETURNING id`, values);
    return rows[0]?.id;
  }
  const {rows} = await db.query(`INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map((_,i) => `$${i+1}`).join(', ')}) RETURNING id`, values);
  return rows[0].id;
}
export async function saveAdminRecord(db, resource, data, id = null) {
  const d = definition(resource);
  const fields = Object.fromEntries(Object.entries(data).filter(([key]) => writable[resource].includes(key)));
  if (resource === 'restaurantes') {
    const address = Object.fromEntries(['calle','numero','comuna','region'].filter(key => Object.hasOwn(data,key)).map(key => [key,data[key]]));
    // Dirección propia por restaurante: cambiarla nunca modifica accidentalmente otro restaurante histórico.
    if (id) {
      const {rows} = await db.query('SELECT d.calle, d.numero, d.comuna, d.region FROM direcciones d JOIN restautantes r ON r.direcciones_id = d.id WHERE r.id = $1', [id]);
      Object.assign(address, {...rows[0], ...address});
    }
    fields.direcciones_id = await writeTable(db, 'direcciones', address, null);
  }
  const resultId = await writeTable(db, d.table, fields, id);
  if (resource === 'usuarios' && Object.hasOwn(data,'restaurantes')) {
    await db.query('DELETE FROM usuario_restaurantes WHERE usuario_id = $1', [resultId]);
    if (data.restaurantes.length) await db.query('INSERT INTO usuario_restaurantes(usuario_id, restaurante_id) SELECT $1, unnest($2::integer[])', [resultId,data.restaurantes]);
  }
  if (resource === 'usuarios' && (data.estado === '0' || Object.hasOwn(data,'password_hash'))) {
    await db.query('DELETE FROM auth_sessions WHERE usuario_id = $1', [resultId]);
  }
  return getAdminRecord(db, resource, resultId);
}
