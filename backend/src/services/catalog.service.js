import { findRestaurants, findRestaurant, findMenus, findCategories, findItems } from '../models/catalog.model.js';

export function parseRestaurantId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 2147483647 ? parsed : null;
}

export async function listRestaurants(db) {
  return findRestaurants(db);
}

export async function getRestaurantMenu(db, id) {
  const restaurant = await findRestaurant(db, id);
  if (!restaurant) return null;
  const [menus, categories, items] = await Promise.all([
    findMenus(db, id), findCategories(db, id), findItems(db, id)
  ]);
  const result = menus.map(menu => ({ ...menu, categorias: [] }));
  const byMenu = new Map(result.map(menu => [menu.id, menu]));
  const byCategory = new Map();
  for (const category of categories) {
    const menu = byMenu.get(category.cartas_id);
    if (!menu) continue;
    const assembled = { ...category, productos: [] };
    menu.categorias.push(assembled);
    byCategory.set(assembled.id, assembled);
  }
  const featured = [];
  for (const item of items) {
    const category = byCategory.get(item.categorias_id);
    if (!category) continue;
    category.productos.push(item);
    if (item.destacado) featured.push(item);
  }
  return { restaurante: restaurant, cartas: result, destacados: featured };
}
