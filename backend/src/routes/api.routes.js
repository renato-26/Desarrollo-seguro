import { Router } from 'express';
import { createHealthController } from '../controllers/health.controller.js';

export function createApiRoutes(checkDatabase) {
  const router = Router();
  router.get('/health', createHealthController(checkDatabase));
  return router;
}
