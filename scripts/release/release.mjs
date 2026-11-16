#!/usr/bin/env node
// Despliegue y rollback de UNA instancia Docker Compose (EC2) con PostgreSQL RDS externo.
// No aprovisiona AWS, no administra ASG, no publica Cloudflare y nunca elimina volúmenes.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { validateImageDigest, validateCommit, validateBaseUrl, releaseEntry, nextState, rollbackState } from './release-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const COMPOSE = join(ROOT, 'compose.production.yaml');
const STATE_FILE = process.env.PNK_RELEASE_STATE || join(homedir(), '.local', 'state', 'pnksecurity', 'release.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function usage() {
  console.log(`Comandos de despliegue para UNA instancia EC2:\n  node scripts/release/release.mjs deploy --image REGISTRY/REPO@sha256:DIGEST --commit SHA40 --runtime-env /ruta/runtime.env --health-url http://IP_PRIVADA:3000/ [--public-url https://dominio/] [--apply]\n  node scripts/release/release.mjs rollback --runtime-env /ruta/runtime.env --health-url http://IP_PRIVADA:3000/ [--public-url https://dominio/] [--apply]\n  node scripts/release/release.mjs status\n\nSin --apply solo muestra el plan (no cambia nada). Una migración de RDS NO se revierte con rollback.`);
}
function parseArgs(args) {
  const [action, ...rest] = args;
  if (action === '--help' || !action) return { action: 'help' };
  if (!['deploy', 'rollback', 'status'].includes(action)) throw new Error('Comando inválido');
  const opts = { action, apply: false };
  const known = { '--image': 'image', '--commit': 'commit', '--runtime-env': 'envFile', '--health-url': 'healthUrl', '--public-url': 'publicUrl' };
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (flag === '--apply') { if (opts.apply) throw new Error('--apply duplicado'); opts.apply = true; continue; }
    if (!known[flag] || !rest[i+1] || rest[i+1].startsWith('--') || opts[known[flag]]) throw new Error(`Opción inválida: ${flag}`);
    opts[known[flag]] = rest[++i];
  }
  if (action === 'deploy') { validateImageDigest(opts.image); validateCommit(opts.commit); }
  if (action !== 'status') {
    if (!opts.envFile || !opts.healthUrl) throw new Error('Faltan --runtime-env y --health-url');
    opts.healthUrl = validateBaseUrl(opts.healthUrl);
    if (opts.publicUrl) opts.publicUrl = validateBaseUrl(opts.publicUrl);
    opts.envFile = resolve(opts.envFile);
  }
  return opts;
}
function run(cmd, args, env = process.env) {
  const out = spawnSync(cmd, args, { cwd: ROOT, env, stdio: 'inherit', windowsHide: true });
  if (out.error || out.status !== 0) throw new Error(`Falló ${cmd} (código ${out.status ?? 'desconocido'})`);
}
function capture(cmd, args, env = process.env) {
  const out = spawnSync(cmd, args, { cwd: ROOT, env, encoding: 'utf8', windowsHide: true });
  if (out.error || out.status !== 0) throw new Error(`Falló la comprobación de ${cmd}`);
  return out.stdout.trim();
}
function compose(opts, image, ...args) {
  const env = { ...process.env, APP_IMAGE: image };
  run('docker', ['compose', '--env-file', opts.envFile, '-f', COMPOSE, ...args], env);
}
function readState() {
  if (!existsSync(STATE_FILE)) return null;
  const data = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  if (data.version !== 1 || !data.current) throw new Error('Estado de releases inválido');
  validateImageDigest(data.current.image); validateCommit(data.current.commit);
  if (data.previous) { validateImageDigest(data.previous.image); validateCommit(data.previous.commit); }
  return data;
}
function saveState(data) {
  mkdirSync(dirname(STATE_FILE), { recursive: true, mode: 0o700 });
  const temp = STATE_FILE + `.new-${process.pid}`;
  writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  chmodSync(temp, 0o600);
  renameSync(temp, STATE_FILE);
}
async function waitForHealthy(url, label) {
  let message = 'Sin respuesta';
  for (let i=0; i<18; i++) {
    try {
      const response = await fetch(url + '/api/health', { cache: 'no-store', signal: AbortSignal.timeout(6000) });
      const body = await response.json();
      if (response.ok && body.status === 'ok' && body.database === 'up') {
        const home = await fetch(url + '/', { cache: 'no-store', signal: AbortSignal.timeout(6000) });
        if (home.ok && (home.headers.get('content-type') || '').includes('text/html')) {
          console.log(`OK ${label}: API, PostgreSQL y frontend responden`);
          return;
        }
        message = `Frontend HTTP ${home.status}`;
      } else message = `API HTTP ${response.status}`;
    } catch { message = 'No respondió salud o frontend'; }
    if (i < 17) await sleep(3000);
  }
  throw new Error(`${label}: falló la comprobación (${message})`);
}
function verifyRevision(image, commit) {
  run('docker', ['pull', image]);
  const got = capture('docker', ['image', 'inspect', '--format', '{{ index .Config.Labels "org.opencontainers.image.revision" }}', image]);
  if (got !== commit) throw new Error('La imagen no coincide con el SHA Git declarado en su etiqueta OCI');
}
function deployCompose(opts, image) {
  compose(opts, image, 'config', '--quiet');
  compose(opts, image, 'up', '-d', '--no-deps', '--force-recreate', 'backend');
}
function takeLock() {
  mkdirSync(dirname(STATE_FILE), { recursive: true, mode: 0o700 });
  const lockPath = STATE_FILE + '.lock';
  let fd;
  try { fd = openSync(lockPath, 'wx', 0o600); }
  catch { throw new Error('Otro despliegue o bloqueo pendiente: revisar estado antes de quitar el archivo .lock'); }
  return () => { closeSync(fd); unlinkSync(lockPath); };
}
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.action === 'help') { usage(); return; }
  const state = readState();
  if (opts.action === 'status') { console.log(JSON.stringify({ current: state?.current ?? null, previous: state?.previous ?? null }, null, 2)); return; }
  const target = opts.action === 'deploy' ? releaseEntry(opts.image, opts.commit) : state?.previous;
  if (!target) throw new Error('No hay imagen anterior registrada para rollback');
  const next = opts.action === 'deploy' ? nextState(state, target) : rollbackState(state);
  console.log(`PLAN ${opts.action}: commit ${target.commit} | digest ${target.image}`);
  console.log(`Salud privada: ${opts.healthUrl}${opts.publicUrl ? ' | Público: ' + opts.publicUrl : ''}`);
  console.log('PostgreSQL RDS, datos y migraciones NO se modifican. Rollback restaura únicamente la imagen del backend.');
  if (!opts.apply) { console.log('Simulación: agregar --apply para ejecutar.'); return; }
  if (!existsSync(opts.envFile) || !existsSync(COMPOSE)) throw new Error('No existe el archivo de configuración del runtime o Compose');
  const unlock = takeLock();
  try {
    verifyRevision(target.image, target.commit);
    deployCompose(opts, target.image);
    try {
      await waitForHealthy(opts.healthUrl, 'Privado');
      if (opts.publicUrl) await waitForHealthy(opts.publicUrl, 'Cloudflare');
    } catch (error) {
      if (opts.action === 'deploy' && state?.current) {
        console.error('El nuevo release falló: intentando volver al release anterior registrado.');
        try {
          verifyRevision(state.current.image, state.current.commit);
          deployCompose(opts, state.current.image);
          await waitForHealthy(opts.healthUrl, 'Rollback automático');
          console.error('Versión anterior restaurada; el historial sigue apuntando a ella.');
        } catch { console.error('ATENCIÓN: rollback automático falló; intervención manual necesaria.'); }
      }
      throw error;
    }
    saveState(next);
    console.log(`OK ${opts.action}: commit=${next.current.commit} | digest=${next.current.image}`);
  } finally { unlock(); }
}
main().catch(e => { console.error('ERROR:', e.message); process.exitCode = 1; });
