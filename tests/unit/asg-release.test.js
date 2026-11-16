import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAsg, validateTemplate, validateVersion, refreshArguments } from '../../scripts/release/asg-lib.mjs';
test('valida nombres de ASG sin aceptar inyección de comandos', () => {
  assert.equal(validateAsg('pnksecurity-asg'), 'pnksecurity-asg');
  assert.throws(() => validateAsg('pnksecurity; rm -rf /'));
});
test('exige versión numérica y plantilla explícita para rollback confiable', () => {
  assert.equal(validateTemplate('lt-0123456789abcdef0'), 'lt-0123456789abcdef0');
  assert.equal(validateVersion('3'), '3');
  assert.throws(() => validateVersion('$Latest'));
  assert.throws(() => validateVersion('$Default'));
  assert.throws(() => validateTemplate('mi-plantilla'));
});
test('generación de refresco incluye DesiredConfiguration y AutoRollback', () => {
  const a = refreshArguments({asg:'pnksecurity-asg',template:'lt-0123456789abcdef0',version:'4',region:'sa-east-1'});
  assert.equal(a[1],'start-instance-refresh');
  assert.equal(JSON.parse(a[a.indexOf('--desired-configuration')+1]).LaunchTemplate.Version, '4');
  assert.equal(JSON.parse(a[a.indexOf('--preferences')+1]).AutoRollback, true);
});
