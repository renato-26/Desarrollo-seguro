import { Router } from 'express';
import { loadOptionalSession, checkSameOriginWrite } from '../middleware/auth.js';
import { createAdminController } from '../controllers/admin.controller.js';

export function createAdminRoutes(db) {
  const router = Router();
  const controller = createAdminController(db);
  router.use(loadOptionalSession(db));
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.authUser || req.authUser.activo !== true) return res.status(401).json({error:'Se requiere iniciar sesión'});
    if (!['ADMIN_GENERAL','ADMIN_RESTAURANTE'].includes(req.authUser.rol)) return res.status(403).json({error:'Acceso denegado'});
    return next();
  });
  router.get('/dashboard', controller.dashboard);
  for (const resource of ['restaurantes','cartas','categorias','productos','usuarios']) {
    const permission = (req, res, next) => {
      if (req.authUser.rol !== 'ADMIN_GENERAL' && (resource === 'usuarios' || (resource === 'restaurantes' && req.method === 'POST')))
        return res.status(403).json({error:'Acceso denegado'});
      return next();
    };
    router.get('/' + resource, permission, controller.list(resource));
    router.get('/' + resource + '/:id', permission, controller.get(resource));
    router.post('/' + resource, checkSameOriginWrite, permission, controller.save(resource));
    router.patch('/' + resource + '/:id', checkSameOriginWrite, permission, controller.save(resource));
  }
  return router;
}
