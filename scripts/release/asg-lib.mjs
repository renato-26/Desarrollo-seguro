// Operaciones puras de despliegue de una flota de Auto Scaling (sin credenciales).
export function validateAsg(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9._\/-]{1,255}$/.test(name)) throw new Error('Nombre de ASG inválido');
  return name;
}
export function validateTemplate(id) {
  if (typeof id !== 'string' || !/^lt-[a-f0-9]{8,17}$/.test(id)) throw new Error('ID de Launch Template inválido');
  return id;
}
export function validateVersion(version) {
  if (typeof version !== 'string' || !/^[1-9][0-9]{0,7}$/.test(version)) throw new Error('Usar una versión numérica del Launch Template; no $Latest/$Default');
  return version;
}
export function refreshArguments({ asg, template, version, region }) {
  validateAsg(asg); validateTemplate(template); validateVersion(version);
  if (!/^[a-z]{2}(?:-[a-z0-9]+)+-\d$/.test(region || '')) throw new Error('Región AWS inválida');
  return ['autoscaling', 'start-instance-refresh', '--auto-scaling-group-name', asg,
    '--desired-configuration', JSON.stringify({ LaunchTemplate: { LaunchTemplateId: template, Version: version } }),
    '--preferences', JSON.stringify({ MinHealthyPercentage: 90, InstanceWarmup: 120, AutoRollback: true }),
    '--region', region, '--output', 'json'];
}
