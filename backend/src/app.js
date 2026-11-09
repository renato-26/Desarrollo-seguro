import express from 'express';
import helmet from 'helmet';
import { createApiRoutes } from './routes/api.routes.js';
import { notFound, errorHandler } from './middleware/errors.js';

export function createApp({ checkDatabase }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', createApiRoutes(checkDatabase));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
