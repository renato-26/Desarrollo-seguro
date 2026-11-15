'use strict';
// Se conserva la presentación del proyecto PHP original sin ejecutar PHP ni insertar HTML de la BD.
const el = id => document.getElementById(id);
const base = '/static/legacy/';
const fallback = `${base}img/logo_empresa_comodin.png`;
const CART_PREFIX = 'pnk.cesta.v1.';
let currentId = 1;
let currentData = null;

function node(tag, cls, text) {
  const result = document.createElement(tag);
  if (cls) result.className = cls;
  if (text !== undefined && text !== null) result.textContent = String(text);
  return result;
}
function add(parent, ...kids) { parent.append(...kids); return parent; }
function replace(parent, ...kids) { parent.replaceChildren(...kids); return parent; }
function imgFor(id, file, fallbackFile = fallback) {
  const safeId = Number.isSafeInteger(Number(id)) && Number(id) > 0;
  const safeName = typeof file === 'string' && /^[\w.-]+\.(jpg|jpeg|png|webp)$/i.test(file) && !file.includes('..');
  return safeId && safeName ? `${base}imagenes/cod${id}/${encodeURIComponent(file)}` : fallbackFile;
}
function picture(url, cls, alt, failTo = fallback) {
  const image = node('img', cls);
  image.src = url;
  image.alt = alt;
  image.loading = 'lazy';
  image.addEventListener('error', () => { if (image.src !== new URL(failTo, location.href).href) image.src = failTo; }, { once: true });
  return image;
}
function cash(value) {
  return Number.isFinite(Number(value)) ? new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(Number(value)) : 'Consultar';
}
async function getJSON(path) {
  const response = await fetch(path, { headers: { Accept:'application/json' }, credentials:'same-origin' });
  if (!response.ok) throw new Error(response.status === 404 ? 'Restaurante no encontrado' : 'No fue posible cargar la información del restaurante');
  return response.json();
}
function showError(text) { const s = el('estado'); s.textContent = text; s.hidden = false; }

function setAuthUser(user) {
  el('login-form').hidden = Boolean(user);
  el('login-form').style.display = user ? 'none' : 'flex';
  el('usuario-sesion').hidden = !user;
  el('usuario-sesion').style.display = user ? 'block' : 'none';
  el('nombre-sesion').textContent = user ? `Sesión: ${user.nombre || user.email}` : '';
}
async function updateAuthUser() {
  try { const result = await getJSON('/api/auth/me'); setAuthUser(result.usuario); }
  catch { setAuthUser(null); }
}
async function submitLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const identifier = form.elements.frmusuario.value.trim();
  const password = form.elements.frmpassword.value;
  form.elements.frmpassword.value = '';
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'same-origin',
      headers: {'Content-Type':'application/json', 'X-PNK-Request':'1'},
      body: JSON.stringify({ identifier, password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No fue posible iniciar sesión.');
    setAuthUser(result.usuario);
    el('estado').hidden = true;
  } catch (error) { showError(error.message); }
}
async function logout() {
  try {
    const response = await fetch('/api/auth/logout', { method:'POST', credentials:'same-origin', headers:{'X-PNK-Request':'1'} });
    if (!response.ok) throw new Error('No fue posible cerrar sesión.');
    setAuthUser(null);
    el('login-form').reset();
    el('estado').hidden = true;
  } catch (error) { showError(error.message); }
}

function cartKey() { return `${CART_PREFIX}${currentId}`; }
function loadCart() {
  try { const ids = JSON.parse(sessionStorage.getItem(cartKey()) || '[]');
    return Array.isArray(ids) ? ids.filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 100) : [];
  } catch { return []; }
}
function saveCart(ids) { sessionStorage.setItem(cartKey(), JSON.stringify(ids.slice(0, 100))); updateCount(); }
function updateCount() { el('carrito-contador').textContent = `(${loadCart().length})`; }
function allProducts() { return currentData ? currentData.cartas.flatMap(m => m.categorias.flatMap(c => c.productos)) : []; }
function chooseProduct(item) {
  if (!allProducts().some(p => p.id === item.id)) return;
  const cart = loadCart();
  if (cart.length >= 100) return showError('El carrito alcanzó el máximo de productos.');
  cart.push(item.id); saveCart(cart);
  if (window.jQuery && window.jQuery.fn.modal) window.jQuery('#myModal').modal('show');
}
function buttonSelect(item) {
  const b = node('button', 'button', 'Seleccionar'); b.type = 'button';
  b.addEventListener('click', () => chooseProduct(item)); return b;
}
function productDetails(item, parent) {
  if (item.descripcion) add(parent, node('span', '', item.descripcion), node('br'));
  if (item.observaciones) add(parent, node('span', '', item.observaciones), node('br'));
  if (item.tiempo) add(parent, node('span', '', `◷ ${item.tiempo}`));
}
function stars(item) {
  const list = node('ul','rating-star');
  for (let i=0; i<Math.min(5, Math.max(0, Number(item.puntuacion) || 0)); i++) {
    const li = node('li'); li.textContent='★'; add(list,li);
  }
  return list;
}
function featured(item) {
  const card = node('div','featured-item');
  const url = imgFor(currentId, item.foto, `${base}imagenes/producto.jpg`);
  const photo = picture(url, 'card-img rounded-0', item.nombre, `${base}imagenes/producto.jpg`);
  photo.width=350; photo.height=235;
  const body = node('div','item-body');
  add(body,node('h3','', item.nombre));
  const detail = node('p'); productDetails(item, detail); add(body,detail);
  const bottom = node('div','d-flex justify-content-between');
  add(bottom, stars(item), node('h3','price-tag',cash(item.precio)));
  add(body,bottom,buttonSelect(item));
  return add(card,photo,body);
}
function menuProduct(item, widthClass) {
  const col = node('div',widthClass);
  const entry = node('div','media align-items-center food-card');
  const photo = picture(imgFor(currentId,item.foto,`${base}imagenes/producto.jpg`),'mr-3 mr-sm-4',item.nombre,`${base}imagenes/producto.jpg`);
  photo.width=120;
  const body = node('div','media-body');
  const header = node('div','d-flex justify-content-between food-card-title');
  add(header,node('h4','',item.nombre),node('h3','price-tag',cash(item.precio)));
  const detail=node('p'); productDetails(item,detail);
  add(body,header,detail,stars(item),buttonSelect(item));
  return add(col,add(entry,photo,body));
}
function showMenu(data) {
  const r=data.restaurante;
  document.title=`${r.nombre} - PNK Security`;
  el('restaurante-nombre').textContent = r.nombre;
  el('restaurante-direccion').textContent=[r.calle, r.numero ? `#${r.numero}` : '', r.comuna].filter(Boolean).join(' ');
  const contacts=el('restaurante-contacto');
  replace(contacts);
  if (r.fono) add(contacts,node('span','',`☎ ${r.fono}`));
  if (r.email) add(contacts,node('span','',`✉ ${r.email}`));
  const logo=el('logo-restaurante'); logo.src=imgFor(currentId,r.foto); logo.alt=r.nombre;
  logo.addEventListener('error',()=>{logo.src=fallback;},{once:true});
  const feat=el('seccion-destacados');
  if (data.destacados.length) {
    const carousel=el('destacados');
    add(carousel,...data.destacados.map(featured)); feat.hidden=false;
    if (window.jQuery && window.jQuery.fn.owlCarousel) {
      window.jQuery(carousel).owlCarousel({loop:false,margin:30,items:1,nav:true,dots:false,
        navText:['‹','›'],responsive:{768:{items:2},1100:{items:3}}});
    }
  }
  const tabs=el('pestanas-cartas'),content=el('contenido-cartas');
  replace(tabs); replace(content);
  if (!data.cartas.length) add(content,node('h4','empty-category','No hay información para Mostrar'));
  data.cartas.forEach((menu,index)=>{
    const tabId=`pnk-tab-${menu.id}`;
    const panelId=`pnk-panel-${menu.id}`;
    const link=node('a',`nav-item nav-link${index===0?' active':''}`, menu.nombre || 'Carta');
    link.id=tabId; link.href=`#${panelId}`; link.setAttribute('role','tab');
    link.setAttribute('data-toggle','tab'); link.setAttribute('aria-controls',panelId); link.setAttribute('aria-selected',index===0?'true':'false');
    add(tabs,link);
    const panel=node('div',`tab-pane fade${index===0?' show active':''}`);
    panel.id=panelId; panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-labelledby',tabId);
    if (!menu.categorias.length) add(panel,node('h4','empty-category','No hay información para Mostrar'));
    menu.categorias.forEach(cat=>{
      const intro=node('div','section-intro mb-20px'); add(intro,node('h4','intro-title',cat.nombre)); add(panel,intro);
      const row=node('div','row');
      if (cat.productos.length) {
        const width=cat.productos.length>1?'col-lg-6':'col-lg-12';
        add(row,...cat.productos.map(i=>menuProduct(i,width)));
      } else add(row,add(node('div','col-lg-12 text-center'),node('h4','', 'No Información para Mostrar')));
      add(panel,row);
    });
    add(content,panel);
  });
}
async function renderComments() {
  const box=el('comentarios-lista'); replace(box);
  try {
    const data=await getJSON(`/api/restaurantes/${currentId}/comentarios`);
    for (const comment of data.comentarios) {
      const card=node('div','card bg-light'); const body=node('div','card-body');
      add(body,node('b','',comment.usuario || 'Usuario'),node('br'),node('span','',comment.comentario || ''));
      add(box,add(card,body));
    }
  } catch { add(box,node('p','','No fue posible cargar los comentarios.')); }
}
function renderCart() {
  el('seccion-destacados').hidden=true;
  el('seccion-cartas').hidden=true;
  el('seccion-comentarios').hidden=true;
  el('seccion-carrito').hidden=false;
  el('carrito-enlace').hidden=true;
  const table=el('filas-carrito'); replace(table);
  const products=new Map(allProducts().map(p=>[p.id,p]));
  loadCart().forEach((id,pos)=>{
    const p=products.get(id); if (!p) return;
    const tr=node('tr');
    const remove=node('button','btn btn-sm btn-outline-danger','Eliminar'); remove.type='button';
    remove.addEventListener('click',()=>{const cart=loadCart();cart.splice(pos,1);saveCart(cart);renderCart();});
    add(tr,node('th','',p.id),node('td','',p.nombre),node('td','',cash(p.precio)),add(node('td'),remove));
    add(table,tr);
  });
  if (!table.children.length) add(table,add(node('tr'),add(node('td','text-center','No hay productos seleccionados.'))));
}
async function start() {
  const match=location.pathname.match(/^\/(?:carta|carrito)\/([^/]+)\/?$/);
  const selected=match ? match[1] : new URLSearchParams(location.search).get('id') || '1';
  if (!/^[1-9]\d{0,9}$/.test(selected) || Number(selected)>2147483647) return showError('Identificador de restaurante inválido.');
  currentId=Number(selected);
  updateCount();
  el('carrito-enlace').href=`/carrito/${currentId}`;
  el('volver-carta').addEventListener('click',()=>location.assign(`/carta/${currentId}`));
  el('limpiar-carrito').addEventListener('click',()=>{saveCart([]);renderCart();});
  el('login-form').addEventListener('submit', submitLogin);
  el('cerrar-sesion').addEventListener('click', logout);
  await updateAuthUser();
  try {
    currentData=await getJSON(`/api/restaurantes/${currentId}/carta`);
    showMenu(currentData);
    if (location.pathname.startsWith('/carrito/')) renderCart();
    else await renderComments();
  } catch(err) { showError(err.message); }
}
start();
