export function loadConfig(env = process.env) {
  const environment = env.APP_ENV || 'dev';
  const nodeEnvironment = env.NODE_ENV || 'development';
  const port = Number(env.PORT || 3000);
  const sslMode = env.DB_SSL || 'disable';
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { /* validation below */ }
  if (!['dev', 'qa', 'prod'].includes(environment)
    || !['development', 'test', 'production'].includes(nodeEnvironment)
    || (environment === 'prod' && nodeEnvironment !== 'production')
    || !Number.isInteger(port) || port < 1 || port > 65535
    || !url || !['postgres:', 'postgresql:'].includes(url.protocol)
    || !url.hostname || url.pathname.length < 2
    || !['disable', 'verify-full'].includes(sslMode)
    || [...(url?.searchParams.keys() || [])].some(key => /ssl/i.test(key))) {
    throw new Error('Configuración inválida: revisar APP_ENV, NODE_ENV, PORT, DATABASE_URL y DB_SSL');
  }
  return Object.freeze({ environment, port, databaseUrl: env.DATABASE_URL, sslMode });
}
