import { listRestaurants, getRestaurantMenu, parseRestaurantId } from '../services/catalog.service.js';

function unavailable(res) {
  return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
}

export function createCatalogController(db) {
  return {
    list: async (_req, res) => {
      try { return res.json({ restaurantes: await listRestaurants(db) }); }
      catch { return unavailable(res); }
    },
    menu: async (req, res) => {
      const id = parseRestaurantId(req.params.id);
      if (id === null) return res.status(400).json({ error: 'Identificador de restaurante inválido' });
      try {
        const menu = await getRestaurantMenu(db, id);
        return menu ? res.json(menu) : res.status(404).json({ error: 'Restaurante no encontrado' });
      } catch { return unavailable(res); }
    }
  };
}
