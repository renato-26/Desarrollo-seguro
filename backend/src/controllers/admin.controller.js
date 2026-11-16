import { createAdminService, adminId, AdminError } from '../services/admin.service.js';

export function createAdminController(db) {
  const service = createAdminService(db);
  const handle = action => async (req,res) => {
    try { await action(req,res); }
    catch (error) {
      if (error instanceof AdminError) return res.status(error.status).json({error:error.message});
      if (['23505','23503','40001','40P01'].includes(error.code)) return res.status(409).json({error:'Conflicto de datos; actualiza y vuelve a intentar'});
      return res.status(503).json({error:'Administración temporalmente no disponible'});
    }
  };
  return {
    dashboard:handle(async (req,res) => res.json({dashboard:await service.dashboard(req.authUser)})),
    list:resource => handle(async (req,res) => res.json({registros:await service.list(resource,req.authUser)})),
    get:resource => handle(async (req,res) => res.json({registro:await service.get(resource,adminId(req.params.id),req.authUser)})),
    save:resource => handle(async (req,res) => {
      const id = req.params.id == null ? null : adminId(req.params.id);
      const registro = await service.save(resource,id,req.body,req.authUser);
      res.status(id == null ? 201 : 200).json({registro});
    })
  };
}
