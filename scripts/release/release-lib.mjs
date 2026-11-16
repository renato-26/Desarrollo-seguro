// Funciones puras para validar manifiestos de despliegue de pnkSecurity.
export function validateImageDigest(image) {
  if (typeof image !== 'string' || !/^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/.test(image)) {
    throw new Error('La imagen debe indicar un repositorio y un digest inmutable @sha256:<64 hex>');
  }
  return image;
}

export function validateCommit(commit) {
  if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error('Usar el SHA completo de Git: 40 caracteres hexadecimales');
  }
  return commit;
}

export function validateBaseUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('La URL de comprobación es inválida'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Usar una URL HTTP(S) de origen sin ruta, parámetros ni credenciales; terminar en /');
  }
  return url.toString().replace(/\/$/, '');
}

export function releaseEntry(image, commit, now = new Date()) {
  return Object.freeze({ image: validateImageDigest(image), commit: validateCommit(commit), deployedAt: now.toISOString() });
}

export function nextState(before, next) {
  if (before && (typeof before !== 'object' || !before.current || !before.current.image || !before.current.commit)) {
    throw new Error('Historial de despliegue dañado; no se modificará');
  }
  if (before?.current?.image === next.image) throw new Error('Esa imagen ya está desplegada');
  return { version: 1, current: next, previous: before?.current || null,
    history: [...(before?.history || []), next].slice(-30) };
}

export function rollbackState(before, now = new Date()) {
  if (!before?.current || !before.previous) throw new Error('No existe una versión anterior registrada para revertir');
  const chosen = { ...before.previous, deployedAt: now.toISOString() };
  return { version: 1, current: chosen, previous: before.current,
    history: [...(before.history || []), chosen].slice(-30) };
}
