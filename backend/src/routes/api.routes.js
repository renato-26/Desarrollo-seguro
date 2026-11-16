import { Router } from 'express';
import { createHealthController } from '../controllers/health.controller.js';
import { createCatalogController } from '../controllers/catalog.controller.js';
import { createAuthController } from '../controllers/auth.controller.js';
import { checkSameOriginWrite, loadOptionalSession } from '../middleware/auth.js';
import { createAdminRoutes } from './admin.routes.js';

export function createApiRoutes(checkDatabase, db, environment = 'dev') {
  const router = Router();
  const catalog = createCatalogController(db);
  const auth = createAuthController(db, environment);
  router.use('/admin', createAdminRoutes(db));
  router.get('/auth/me', loadOptionalSession(db), auth.me);
  router.post('/auth/login', checkSameOriginWrite, auth.login);
  router.post('/auth/logout', checkSameOriginWrite, loadOptionalSession(db), auth.logout);
  router.get('/health', createHealthController(checkDatabase));
  router.get('/restaurantes', catalog.list);
  router.get('/restaurantes/:id/carta', catalog.menu);
  router.get('/restaurantes/:id/comentarios', catalog.comments);
  router.post('/restaurantes/:id/comentarios', checkSameOriginWrite, loadOptionalSession(db), catalog.createComment);
  return router;
}
