const text = (name, label, maxLength, required = false, extra = {}) => ({ name, label, maxLength, required, type: 'text', ...extra });
const flag = (name, label) => ({ name, label, type: 'checkbox' });
const relation = (name, label, resource) => ({ name, label, type: 'relation', resource, required: true });
const order = { name: 'orden', label: 'Orden', type: 'number', min: 0, max: 2147483647 };
const photo = text('foto', 'Fotografía', 200, false, { hint: 'Archivo JPG, PNG o WebP de hasta 5 MiB existente en la carpeta del restaurante. Nombre de hasta 200 caracteres; no se admiten URLs externas.' });
const active = flag('activo', 'Activo');
export const resources = {
  restaurantes: {
    title: 'Restaurantes', singular: 'restaurante', fields: [text('nombre', 'Nombre', 200, true), text('rut', 'RUT', 11, true), text('fono', 'Teléfono', 45, true), text('email', 'Correo electrónico', 100, false, { type: 'email' }), text('calle', 'Calle', 100, true), text('numero', 'Número', 15, true), text('comuna', 'Comuna', 100, true), text('region', 'Región', 100), text('mapa', 'Referencia de mapa', 200), photo, active]
  },
  cartas: { title: 'Cartas', singular: 'carta', fields: [text('nombre', 'Nombre', 45, true), relation('restautantes_id', 'Restaurante', 'restaurantes'), order, photo, active] },
  categorias: { title: 'Categorías', singular: 'categoría', fields: [text('nombre', 'Nombre', 100, true), relation('cartas_id', 'Carta', 'cartas'), order, photo, active] },
  productos: { title: 'Productos', singular: 'producto', fields: [text('nombre', 'Nombre', 100, true), relation('categorias_id', 'Categoría', 'categorias'), { name: 'precio', label: 'Precio (CLP)', type: 'number', required: true, min: 0, max: 2147483647 }, text('descripcion', 'Descripción', 300, false, { type: 'textarea' }), text('observaciones', 'Observaciones', 300, false, { type: 'textarea' }), text('tiempo', 'Tiempo de preparación', 100), photo, order, flag('destacado', 'Destacado'), flag('disponible', 'Disponible'), active] },
  usuarios: { title: 'Usuarios', singular: 'usuario', fields: [text('nombre', 'Nombre', 255, true), text('email', 'Correo electrónico', 255, true, { type: 'email' }), { name: 'password', label: 'Contraseña', type: 'password', minLength: 12, maxLength: 1024, hint: 'Mínimo 12 caracteres. Al editar, deja vacío para conservar la contraseña.' }, { name: 'rol', label: 'Rol', type: 'role', required: true }, { name: 'restaurantes', label: 'Restaurantes asignados', type: 'assignments', resource: 'restaurantes', hint: 'Selecciona las asignaciones del administrador de restaurante. Usa Ctrl/Cmd para seleccionar varias.' }, active] }
};
export function initialRecord(resource, record) {
  return Object.fromEntries(resources[resource].fields.map(field => [field.name, field.name === 'password' ? '' : record?.[field.name] ?? (field.type === 'checkbox' ? !['destacado'].includes(field.name) : field.type === 'assignments' ? [] : field.type === 'role' ? 'CLIENTE' : '')]));
}
export function formPayload(resource, values, record = null) {
  const result = {};
  const original = record ? initialRecord(resource, record) : null;
  const normalize = (field, value) => ['number', 'relation'].includes(field.type) ? value === '' ? null : Number(value) : value;
  for (const field of resources[resource].fields) {
    const value = values[field.name];
    if (field.name === 'password' && record && !value) continue;
    const normalized = normalize(field, value);
    if (original && JSON.stringify(normalized) === JSON.stringify(normalize(field, original[field.name]))) continue;
    result[field.name] = normalized;
  }
  return result;
}
