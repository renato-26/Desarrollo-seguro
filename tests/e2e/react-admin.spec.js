import { test, expect } from '@playwright/test';
import { qaFixture } from '../helpers/qa.js';

let fixture;
test.beforeAll(async () => { fixture = await qaFixture(); });
test.afterAll(async () => { await fixture?.close(); });

async function login(request) {
  const response = await request.post('/api/auth/login', { headers: { 'X-PNK-Request': '1' }, data: { identifier: fixture.email, password: fixture.password } });
  expect(response.status()).toBe(200);
}
async function create(request, resource, data) {
  const response = await request.post(`/api/admin/${resource}`, { headers: { 'X-PNK-Request': '1' }, data });
  expect(response.status(), await response.text()).toBe(201);
  const result = (await response.json()).registro;
  if (resource === 'restaurantes') fixture.restaurantIds.push(result.id);
  if (resource === 'usuarios') fixture.userIds.push(result.id);
  return result;
}
const restaurantData = name => ({ nombre: name, rut: '12345678-9', fono: '512345678', calle: 'QA', numero: '1', comuna: 'La Serena', activo: true });
async function saveForm(page, resource) {
  const response = page.waitForResponse(r => r.url().includes(`/api/admin/${resource}`) && ['POST', 'PATCH'].includes(r.request().method()));
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const result = await response;
  expect(result.ok(), await result.text()).toBeTruthy();
  await expect(page.getByRole('status')).toContainText('guardado');
  return (await result.json()).registro;
}

test('React renderiza carta original, imágenes y navegación de los siete restaurantes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/carta/1');
  await expect(page.locator('[data-react-page="carta"]')).toBeVisible();
  await expect(page.locator('#restaurante-nombre')).toHaveText('Afríca Restobar');
  await expect(page.getByRole('heading', { name: 'Menús Destacados' })).toBeVisible();
  await expect(page.locator('#destacados .featured-item')).toHaveCount(3);
  await expect(page.getByRole('tab', { name: 'Vinos', exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.screenshot({ path: 'test-results/carta-desktop.png', fullPage: true });
  await expect(page.locator('#destacados').getByText('$12.500', { exact: true })).toBeVisible();
  const broken = await page.locator('#destacados img').evaluateAll(imgs => imgs.filter(img => img.complete && img.naturalWidth === 0).length);
  expect(broken).toBe(0);
  await page.goto('/?id=2');
  await expect(page.locator('#restaurante-nombre')).toHaveText('Restaurant la Bahía');
  for (let id = 2; id <= 7; id++) {
    await page.getByLabel('Restaurante', { exact: true }).selectOption(String(id));
    await expect(page).toHaveURL(new RegExp(`/carta/${id}$`));
    await expect(page.locator('#restaurante-nombre')).not.toBeEmpty();
    await expect(page.locator('#destacados')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('carrito React conserva selección entre recargas y aísla restaurantes', async ({ page }) => {
  await page.goto('/carta/1');
  await page.locator('#destacados .featured-item').filter({ hasText: 'Crema de espinacas' }).getByRole('button', { name: 'Seleccionar' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.locator('#carrito-enlace').click();
  await expect(page.locator('#filas-carrito')).toContainText('Crema de espinacas');
  await page.reload();
  await expect(page.locator('#filas-carrito')).toContainText('$2.000');
  await page.goto('/carrito/2');
  await expect(page.locator('#filas-carrito')).toContainText('No hay productos');
  await page.goto('/carrito/1');
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.locator('#filas-carrito')).toContainText('No hay productos');
});

test('flujo QA obligatorio: login, CRUD completo, precio público, comentarios, usuarios y desactivación', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/admin/login');
  await page.getByLabel('Correo o usuario').fill(fixture.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-desktop.png', fullPage: true });
  await page.getByRole('navigation', { name: 'Administración' }).getByRole('link', { name: 'Restaurantes', exact: true }).click();
  await page.getByRole('button', { name: 'Crear restaurante', exact: true }).click();
  const name = `Restaurante QA ${fixture.suffix}`;
  for (const [label, value] of [['Nombre', name], ['RUT', '12345678-9'], ['Teléfono', '512345678'], ['Calle', 'Prueba'], ['Número', '10'], ['Comuna', 'La Serena']]) await page.getByLabel(label, { exact: false }).fill(value);
  const restaurant = await saveForm(page, 'restaurantes'); fixture.restaurantIds.push(restaurant.id);
  await page.goto('/admin/cartas'); await page.getByRole('button', { name: 'Crear carta', exact: true }).click();
  await page.getByLabel('Nombre', { exact: false }).fill(`Carta QA ${fixture.suffix}`);
  await page.getByLabel('Restaurante', { exact: false }).last().selectOption(String(restaurant.id));
  const menu = await saveForm(page, 'cartas');
  await page.goto('/admin/categorias'); await page.getByRole('button', { name: 'Crear categoría', exact: true }).click();
  await page.getByLabel('Nombre', { exact: false }).fill(`Categoría QA ${fixture.suffix}`);
  await page.getByLabel('Carta', { exact: false }).selectOption(String(menu.id));
  const category = await saveForm(page, 'categorias');
  await page.goto('/admin/productos'); await page.getByRole('button', { name: 'Crear producto', exact: true }).click();
  const productName = `Plato QA ${fixture.suffix}`;
  await page.getByLabel('Nombre', { exact: false }).fill(productName);
  await page.getByLabel('Categoría', { exact: false }).selectOption(String(category.id));
  await page.getByLabel('Precio (CLP)', { exact: false }).fill('4500');
  await page.getByLabel('Observaciones', { exact: false }).fill('Preparación QA visible');
  const product = await saveForm(page, 'productos');
  await page.goto(`/carta/${restaurant.id}`);
  await expect(page.getByRole('heading', { name: productName, exact: true })).toBeVisible();
  await expect(page.locator(`[data-product-id="${product.id}"]`)).toContainText('$4.500');
  await expect(page.locator(`[data-product-id="${product.id}"]`)).toContainText('Preparación QA visible');
  await page.goto('/admin/productos');
  const row = page.getByRole('row').filter({ hasText: productName });
  await row.getByRole('button', { name: 'Ver / editar' }).click();
  await page.getByLabel('Precio (CLP)', { exact: false }).fill('5900'); await saveForm(page, 'productos');
  await page.goto(`/carta/${restaurant.id}`);
  await expect(page.locator(`[data-product-id="${product.id}"]`)).toContainText('$5.900');
  const malicious = `<img src=x onerror=alert(1)> QA ${fixture.suffix}`;
  await page.getByLabel('Deja tu comentario').fill(malicious);
  await page.getByRole('button', { name: 'Publicar comentario' }).click();
  await expect(page.locator('#comentarios-lista')).toContainText(malicious);
  await expect(page.locator('#comentarios-lista img')).toHaveCount(0);
  await page.reload(); await expect(page.locator('#comentarios-lista')).toContainText(malicious);
  await page.goto('/admin/usuarios'); await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
  const userName = `Usuario QA ${fixture.suffix}`;
  await page.getByLabel('Nombre', { exact: false }).fill(userName);
  await page.getByLabel('Correo electrónico', { exact: false }).fill(`scoped-${fixture.suffix}@qa.invalid`);
  await page.getByLabel('Contraseña', { exact: false }).fill(fixture.password);
  await page.getByLabel('Rol', { exact: false }).selectOption('ADMIN_RESTAURANTE');
  await page.getByLabel('Restaurantes asignados').selectOption([String(restaurant.id)]);
  const user = await saveForm(page, 'usuarios'); fixture.userIds.push(user.id);
  await page.getByRole('row').filter({ hasText: userName }).getByRole('button', { name: 'Ver / editar' }).click();
  await page.getByLabel('Nombre', { exact: false }).fill(`${userName} editado`); await saveForm(page, 'usuarios');
  await expect(page.getByRole('row').filter({ hasText: `${userName} editado` })).toBeVisible();
  await page.goto('/admin/productos');
  await page.getByRole('row').filter({ hasText: productName }).getByRole('button', { name: 'Desactivar', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: productName })).toContainText('Inactivo');
  await page.goto(`/carta/${restaurant.id}`); await expect(page.locator(`[data-product-id="${product.id}"]`)).toHaveCount(0);
  await page.goto('/admin/dashboard'); await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await page.request.get('/api/admin/productos')).status()).toBe(401);
});

test('roles, aislamiento entre restaurantes, SQLi, CSRF y revocación de sesión con PostgreSQL real', async ({ request, playwright, baseURL }) => {
  await login(request);
  const own = await create(request, 'restaurantes', restaurantData(`Propio ${fixture.suffix}`));
  const other = await create(request, 'restaurantes', restaurantData(`Ajeno ${fixture.suffix}`));
  const menu = await create(request, 'cartas', { nombre: 'Carta propia', restautantes_id: own.id });
  const foreignMenu = await create(request, 'cartas', { nombre: 'Carta ajena', restautantes_id: other.id });
  const category = await create(request, 'categorias', { nombre: 'Categoría propia', cartas_id: menu.id });
  const foreignCategory = await create(request, 'categorias', { nombre: 'Categoría ajena', cartas_id: foreignMenu.id });
  const product = await create(request, 'productos', { nombre: "Plato ' OR 1=1 --", categorias_id: category.id, precio: 0 });
  const scopedEmail = `role-${fixture.suffix}@qa.invalid`;
  const user = await create(request, 'usuarios', { nombre: 'Administrador acotado', email: scopedEmail, password: fixture.password, rol: 'ADMIN_RESTAURANTE', restaurantes: [own.id] });
  const scoped = await playwright.request.newContext({ baseURL });
  try {
    const signed = await scoped.post('/api/auth/login', { headers: { 'X-PNK-Request': '1' }, data: { identifier: scopedEmail, password: fixture.password } });
    expect(signed.status()).toBe(200); expect(JSON.stringify(await signed.json())).not.toContain('password');
    const list = await scoped.get('/api/admin/restaurantes');
    expect((await list.json()).registros.map(r => r.id)).toEqual([own.id]);
    for (const path of [`restaurantes/${other.id}`, `cartas/${foreignMenu.id}`, `categorias/${foreignCategory.id}`, 'usuarios']) expect((await scoped.get(`/api/admin/${path}`)).status()).toBe(403);
    const headers = { 'X-PNK-Request': '1' };
    expect((await scoped.patch(`/api/admin/productos/${product.id}`, { headers, data: { categorias_id: foreignCategory.id } })).status()).toBe(403);
    expect((await scoped.patch(`/api/admin/categorias/${category.id}`, { headers, data: { cartas_id: foreignMenu.id } })).status()).toBe(403);
    expect((await scoped.post('/api/admin/restaurantes', { headers, data: restaurantData('Prohibido') })).status()).toBe(403);
    expect((await request.patch(`/api/admin/productos/${product.id}`, { data: { precio: 9000 } })).status()).toBe(403);
    expect((await request.patch(`/api/admin/productos/${product.id}`, { headers: { ...headers, Origin: 'https://atacante.invalid' }, data: { precio: 9000 } })).status()).toBe(403);
    expect((await request.get('/api/admin/productos/1%20OR%201=1')).status()).toBe(400);
    expect((await request.patch(`/api/admin/productos/${product.id}`, { headers, data: { precio: 1.5 } })).status()).toBe(400);
    expect((await request.patch(`/api/admin/productos/${product.id}`, { headers, data: { foto: '../escape.svg' } })).status()).toBe(400);
    const dashboard = (await (await scoped.get('/api/admin/dashboard')).json()).dashboard;
    expect(dashboard.restaurantes.total).toBe(1); expect(dashboard.usuarios).toBeUndefined();
    const revoke = await request.patch(`/api/admin/usuarios/${user.id}`, { headers, data: { restaurantes: [] } });
    expect(revoke.status()).toBe(200);
    expect((await (await scoped.get('/api/admin/restaurantes')).json()).registros).toEqual([]);
    expect((await request.patch(`/api/admin/usuarios/${user.id}`, { headers, data: { activo: false } })).status()).toBe(200);
    expect((await scoped.get('/api/admin/dashboard')).status()).toBe(401);
  } finally { await scoped.dispose(); }
});

test('carta y administración responden correctamente en móvil sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/carta/1'); await expect(page.locator('#restaurante-nombre')).toHaveText('Afríca Restobar');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/carta-mobile.png', fullPage: true });
  await page.goto('/admin/login'); await expect(page.getByRole('heading', { name: 'Acceso administrativo' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/admin-mobile.png', fullPage: true });
});

test('CRUD QA verifica orden, disponibilidad y edicion/desactivacion de toda la jerarquia', async ({ request }) => {
  await login(request);
  const patch = async (resource,id,data) => {
    const response = await request.patch(`/api/admin/${resource}/${id}`,{headers:{'X-PNK-Request':'1'},data});
    expect(response.status(),await response.text()).toBe(200);
    return (await response.json()).registro;
  };
  const restaurant = await create(request,'restaurantes',restaurantData(`CRUD QA ${fixture.suffix}`));
  const edited = await patch('restaurantes',restaurant.id,{nombre:`Editado QA ${fixture.suffix}`,fono:'598765432'});
  expect(edited.nombre).toBe(`Editado QA ${fixture.suffix}`);
  const detail = await request.get(`/api/admin/restaurantes/${restaurant.id}`);
  expect((await detail.json()).registro.fono).toBe('598765432');
  const menu = await create(request,'cartas',{nombre:'Carta CRUD',restautantes_id:restaurant.id});
  await patch('cartas',menu.id,{nombre:'Carta editada'});
  const first = await create(request,'categorias',{nombre:'Primera',cartas_id:menu.id,orden:0});
  const second = await create(request,'categorias',{nombre:'Segunda',cartas_id:menu.id,orden:1});
  await patch('categorias',first.id,{nombre:'Primera editada',orden:2});
  const product = await create(request,'productos',{nombre:'Producto CRUD',categorias_id:first.id,precio:1234,disponible:true});
  const publicMenu = async () => {
    const response = await request.get(`/api/restaurantes/${restaurant.id}/carta`);
    expect(response.status()).toBe(200); return response.json();
  };
  let data = await publicMenu();
  expect(data.cartas[0].nombre).toBe('Carta editada');
  expect(data.cartas[0].categorias.map(c=>c.id)).toEqual([second.id,first.id]);
  const products = value => value.cartas.flatMap(m=>m.categorias.flatMap(c=>c.productos));
  await patch('productos',product.id,{disponible:false});
  expect(products(await publicMenu()).some(p=>p.id===product.id)).toBe(false);
  await patch('productos',product.id,{disponible:true,precio:5678});
  expect(products(await publicMenu()).find(p=>p.id===product.id).precio).toBe(5678);
  await patch('categorias',first.id,{activo:false});
  expect(products(await publicMenu()).some(p=>p.id===product.id)).toBe(false);
  await patch('categorias',first.id,{activo:true});
  expect(products(await publicMenu()).some(p=>p.id===product.id)).toBe(true);
  await patch('cartas',menu.id,{activo:false});
  expect((await publicMenu()).cartas).toEqual([]);
  await patch('cartas',menu.id,{activo:true});
  expect(products(await publicMenu()).some(p=>p.id===product.id)).toBe(true);
  const user = await create(request,'usuarios',{nombre:'Cliente CRUD',email:`crud-${fixture.suffix}@qa.invalid`,password:fixture.password});
  await patch('usuarios',user.id,{rol:'ADMIN_RESTAURANTE',restaurantes:[restaurant.id]});
  expect((await (await request.get(`/api/admin/usuarios/${user.id}`)).json()).registro.restaurantes).toEqual([restaurant.id]);
  await patch('usuarios',user.id,{activo:false});
  await patch('productos',product.id,{activo:false});
  expect(products(await publicMenu()).some(p=>p.id===product.id)).toBe(false);
  await patch('restaurantes',restaurant.id,{activo:false});
  expect((await request.get(`/api/restaurantes/${restaurant.id}/carta`)).status()).toBe(404);
  await patch('restaurantes',restaurant.id,{activo:true});
  expect((await publicMenu()).restaurante.nombre).toBe(`Editado QA ${fixture.suffix}`);
  const dashboard = (await (await request.get('/api/admin/dashboard')).json()).dashboard;
  expect(dashboard.restaurantes.total).toBeGreaterThan(0);
});

test('fotografia existente se asocia por API y se muestra realmente en React', async ({ page,request }) => {
  await login(request);
  let menu,product;
  const headers = {'X-PNK-Request':'1'};
  try {
    menu = await create(request,'cartas',{nombre:`Foto QA ${fixture.suffix}`,restautantes_id:1});
    const category = await create(request,'categorias',{nombre:'Foto QA',cartas_id:menu.id});
    product = await create(request,'productos',{nombre:`Foto QA ${fixture.suffix}`,categorias_id:category.id,precio:1000,foto:'carta1.jpg',destacado:true});
    await page.goto('/carta/1');
    const image = page.locator(`#destacados [data-product-id="${product.id}"] img`);
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('src','/static/legacy/imagenes/cod1/carta1.jpg');
    await expect.poll(()=>image.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  } finally {
    for (const [resource,record] of [['productos',product],['cartas',menu]]) {
      if(record)expect((await request.patch(`/api/admin/${resource}/${record.id}`,{headers,data:{activo:false}})).status()).toBe(200);
    }
  }
});
