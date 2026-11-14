// Consultas solo de lectura: ningún valor externo se concatena en SQL.
export async function findRestaurants(db) {
  const { rows } = await db.query(`
    SELECT r.id, r.nombre, r.foto, d.comuna, d.region
      FROM restautantes AS r
      JOIN direcciones AS d ON d.id = r.direcciones_id
     WHERE r.eliminado IS NULL AND d.eliminado IS NULL
     ORDER BY r.id`);
  return rows;
}

export async function findRestaurant(db, id) {
  const { rows } = await db.query(`
    SELECT r.id, r.nombre, r.foto, r.fono, r.email,
           d.calle, d.numero, d.comuna, d.region
      FROM restautantes AS r
      JOIN direcciones AS d ON d.id = r.direcciones_id
     WHERE r.id = $1 AND r.eliminado IS NULL AND d.eliminado IS NULL`, [id]);
  return rows[0] ?? null;
}

export async function findMenus(db, id) {
  const { rows } = await db.query(`
    SELECT id, nombre, orden, foto
      FROM cartas
     WHERE restautantes_id = $1 AND visible IS TRUE AND eliminada IS NULL
     ORDER BY orden NULLS LAST, id`, [id]);
  return rows;
}

export async function findCategories(db, id) {
  const { rows } = await db.query(`
    SELECT ca.id, ca.nombre, ca.orden, ca.cartas_id
      FROM categorias AS ca
      JOIN cartas AS c ON c.id = ca.cartas_id
     WHERE c.restautantes_id = $1 AND c.visible IS TRUE AND c.eliminada IS NULL
       AND ca.visible IS TRUE AND ca.eliminado IS NULL
     ORDER BY ca.orden NULLS LAST, ca.id`, [id]);
  return rows;
}

export async function findItems(db, id) {
  const { rows } = await db.query(`
    SELECT i.id, i.nombre, i.descripcion, i.tiempo, i.precio, i.foto,
           i.destacado, i.puntuacion, i.categorias_id
      FROM items AS i
      JOIN categorias AS ca ON ca.id = i.categorias_id
      JOIN cartas AS c ON c.id = ca.cartas_id
     WHERE c.restautantes_id = $1 AND c.visible IS TRUE AND c.eliminada IS NULL
       AND ca.visible IS TRUE AND ca.eliminado IS NULL
       AND i.visible IS TRUE AND i.eliminado IS NULL
     ORDER BY i.orden NULLS LAST, i.id`, [id]);
  return rows;
}
