export function notFound(_req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.type === 'entity.too.large' ? 413
    : error.type === 'entity.parse.failed' ? 400 : 500;
  if (status === 500) console.error('Error interno al procesar solicitud');
  res.status(status).json({ error: status === 500 ? 'Error interno del servidor' : 'Solicitud inválida' });
}
