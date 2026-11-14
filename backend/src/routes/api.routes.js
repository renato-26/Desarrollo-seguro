import { Router } from 'express';
import { createHealthController } from '../controllers/health.controller.js';
import { createCatalogController } from '../controllers/catalog.controller.js';

export function createApiRoutes(checkDatabase, db) {
  const router = Router();
  const catalog = createCatalogController(db);
  router.get('/health', createHealthController(checkDatabase));
  router.get('/restaurantes', catalog.list);
  router.get('/restaurantes/:id/carta', catalog.menu);
  return router;
}
