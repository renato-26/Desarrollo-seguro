import { getHealth } from '../services/health.service.js';

export function createHealthController(checkDatabase) {
  return async (_req, res) => {
    const result = await getHealth(checkDatabase);
    res.status(result.code).json(result.body);
  };
}
