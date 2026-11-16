#!/usr/bin/env node
// Orquestación de AWS Auto Scaling. Requiere Launch Template numerado con la imagen del commit.
import { spawnSync } from 'node:child_process';
import { validateAsg, refreshArguments } from './asg-lib.mjs';
function usage() { console.log(`Uso:\n  node scripts/release/asg-refresh.mjs refresh --asg NOMBRE --template lt-xxxxxxxx --version N --region sa-east-1 [--apply]\n  node scripts/release/asg-refresh.mjs rollback-active --asg NOMBRE --region sa-east-1 [--apply]\n  node scripts/release/asg-refresh.mjs status --asg NOMBRE --region sa-east-1\n\nSin --apply, solo plan. La plantilla seleccionada DEBE arrancar el digest ECR inmutable asociado al commit.`); }
function args(argv) {
  const [action, ...a] = argv;
  if (!action || action === '--help') return { action: 'help' };
  if (!['refresh','rollback-active','status'].includes(action)) throw new Error('Acción inválida');
  const opts = { action, apply: false };
  const accepted = { '--asg':'asg', '--template':'template', '--version':'version', '--region':'region' };
  for (let i=0;i<a.length;i++) {
    if (a[i] === '--apply') { opts.apply = true; continue; }
    const key = accepted[a[i]];
    if (!key || !a[i+1] || opts[key] || a[i+1].startsWith('--')) throw new Error('Argumento inválido');
    opts[key] = a[++i];
  }
  validateAsg(opts.asg);
  if (!/^[a-z]{2}(?:-[a-z0-9]+)+-\d$/.test(opts.region || '')) throw new Error('Región inválida');
  if (action === 'refresh') refreshArguments(opts);
  if (action !== 'refresh' && (opts.template || opts.version)) throw new Error('No usar --template/--version con esta acción');
  return opts;
}
function run(args) {
  const r = spawnSync('aws', args, { stdio: 'inherit', windowsHide: true });
  if (r.error || r.status !== 0) throw new Error('Falló AWS CLI; verificar IAM, cuenta, región y estado del ASG');
}
try {
  const opt = args(process.argv.slice(2));
  if (opt.action === 'help') usage();
  else if (opt.action === 'status') run(['autoscaling','describe-instance-refreshes','--auto-scaling-group-name',opt.asg,'--max-records','5','--region',opt.region,'--output','table']);
  else {
    const cmd = opt.action === 'refresh' ? refreshArguments(opt)
      : ['autoscaling','rollback-instance-refresh','--auto-scaling-group-name',opt.asg,'--region',opt.region,'--output','json'];
    console.log('PLAN', opt.action, 'ASG:', opt.asg, opt.template ? `Launch Template ${opt.template} versión ${opt.version}` : 'rollback refresh activo');
    console.log('Requiere salud ALB y condiciones para AutoRollback; no revierte cambios SQL.');
    if (!opt.apply) console.log('Simulación: agregar --apply para efectuar la operación AWS.');
    else run(cmd);
  }
} catch (error) { console.error('ERROR:',error.message); process.exitCode=1; }
