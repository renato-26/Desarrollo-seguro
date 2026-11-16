import test from 'node:test';
import assert from 'node:assert/strict';
import { initialRecord, formPayload } from '../../frontend/src/admin/resources.js';

test('React PATCH sólo envía cambios y conserva fotografía histórica y opcionales nulos', () => {
  const original = { nombre: 'Histórico', rut: '258-3', fono: '223366', calle: 'Miraflores', numero: '36', comuna: 'Ovalle', region: null, mapa: null, foto: 'logo_empresa_comodin.png', email: null, activo: true };
  const values = initialRecord('restaurantes', original);
  values.fono = '512222222';
  assert.deepEqual(formPayload('restaurantes', values, original), { fono: '512222222' });
  assert.equal(original.foto, 'logo_empresa_comodin.png');
});

test('React edición numérica normaliza CLP y contraseña vacía conserva el hash existente', () => {
  const original = { nombre: 'Plato', categorias_id: 3, precio: 4500, orden: null, activo: true, disponible: true, destacado: false };
  const values = initialRecord('productos', original);
  values.precio = '4500';
  assert.deepEqual(formPayload('productos', values, original), {});
  values.precio = '0';
  assert.deepEqual(formPayload('productos', values, original), { precio: 0 });
  const user = { nombre: 'Usuario', email: 'a@example.com', rol: 'CLIENTE', restaurantes: [], activo: true };
  assert.deepEqual(formPayload('usuarios', initialRecord('usuarios', user), user), {});
});
