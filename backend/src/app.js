import express from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { createApiRoutes } from './routes/api.routes.js';
import { notFound, errorHandler } from './middleware/errors.js';

const webRoot = fileURLToPath(new URL('../../frontend/public/', import.meta.url));
const home = fileURLToPath(new URL('../../frontend/public/index.html', import.meta.url));

export function createApp({ checkDatabase, pool }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', createApiRoutes(checkDatabase, pool));
  // Se sirve exclusivamente el frontend nuevo, nunca PHP, SQL ni .env del repositorio.
  app.use('/static', express.static(webRoot, { dotfiles: 'deny', index: false, maxAge: '1h' }));
  app.get('/', (_req, res) => res.sendFile(home));
  app.get('/carta/:id', (_req, res) => res.sendFile(home));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
