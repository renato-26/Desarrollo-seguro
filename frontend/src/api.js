export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options, credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.method && options.method !== 'GET' ? { 'X-PNK-Request': '1' } : {}), ...options.headers }
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || 'No fue posible completar la operación.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function cash(value) {
  return value !== null && Number.isFinite(Number(value))
    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value)
    : 'Consultar';
}

export const productFallback = '/static/legacy/imagenes/producto.jpg';
export const logoFallback = '/static/legacy/img/logo_empresa_comodin.png';
export function imagePath(id, file, fallback = logoFallback) {
  if (typeof file !== 'string') return fallback;
  if (/^[\w.-]+\.(jpg|jpeg|png|webp)$/i.test(file) && !file.includes('..'))
    return `/static/legacy/imagenes/cod${Number(id)}/${encodeURIComponent(file)}`;
  if (file.startsWith(`/static/legacy/imagenes/cod${Number(id)}/`) && !file.includes('..') && /\/[^/]+\.(jpg|jpeg|png|webp)$/i.test(file)) return file;
  return fallback;
}
