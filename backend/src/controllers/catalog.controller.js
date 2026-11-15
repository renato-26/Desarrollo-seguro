import { listRestaurants, getRestaurantMenu, parseRestaurantId } from '../services/catalog.service.js';
import { findComments, insertComment } from '../models/catalog.model.js';

function unavailable(res) {
  return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
}

export function createCatalogController(db) {
  return {
    list: async (_req, res) => {
      try { return res.json({ restaurantes: await listRestaurants(db) }); }
      catch { return unavailable(res); }
    },
    comments: async (req, res) => {
      const id = parseRestaurantId(req.params.id);
      if (id === null) return res.status(400).json({ error: 'Identificador de restaurante inválido' });
      try { return res.json({ comentarios: await findComments(db, id) }); }
      catch { return unavailable(res); }
    },
    createComment: async (req, res) => {
      res.set('Cache-Control', 'no-store');
      const id = parseRestaurantId(req.params.id);
      if (id === null) return res.status(400).json({ error: 'Identificador de restaurante inválido' });
      if (!req.authUser) return res.status(401).json({ error: 'Debes iniciar sesión para comentar' });
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.comentario !== 'string')
        return res.status(400).json({ error: 'Comentario inválido' });
      const comentario = body.comentario.trim();
      if (comentario.length < 1 || comentario.length > 1000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(comentario))
        return res.status(400).json({ error: 'El comentario debe tener entre 1 y 1000 caracteres sin caracteres de control' });
      try {
        const usuario = req.authUser.nombre || req.authUser.email || 'Usuario';
        const creado = await insertComment(db, id, req.authUser.id, usuario, comentario);
        return creado ? res.status(201).json({ comentario: creado })
          : res.status(404).json({ error: 'Restaurante no encontrado' });
      } catch { return unavailable(res); }
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
