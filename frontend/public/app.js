'use strict';

const $ = selector => document.querySelector(selector);
const elements = {
  status: $('#status'), index: $('#restaurant-index'), detail: $('#restaurant-detail'),
  restaurants: $('#restaurants'), count: $('#restaurant-count'), search: $('#restaurant-search'),
  info: $('#restaurant-info'), featured: $('#featured'), tabs: $('#menu-tabs'),
  menu: $('#menu-content')
};

function make(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}
function append(parent, ...children) { parent.append(...children); return parent; }
function clear(node) { node.replaceChildren(); }
function status(message, kind = 'loading') {
  elements.status.className = kind;
  elements.status.textContent = message;
  elements.status.hidden = !message;
}
function imageFor(id, filename) {
  // No usar rutas arbitrarias ni HTML proveniente de la base de datos.
  const validFile = typeof filename === 'string' && /^[\w.-]+\.(png|jpe?g|webp)$/i.test(filename) && !filename.includes('..');
  const validId = Number.isInteger(Number(id)) && Number(id) > 0;
  if (!validFile || !validId) return '/static/assets/logo_empresa_comodin.png';
  return `/static/assets/restaurantes/cod${id}/${encodeURIComponent(filename)}`;
}
function photo(id, filename, alt, className) {
  const img = make('img', className);
  img.src = imageFor(id, filename); img.alt = alt; img.loading = 'lazy';
  img.addEventListener('error', () => { img.src = '/static/assets/logo_empresa_comodin.png'; }, { once: true });
  return img;
}
function price(value) { return Number.isFinite(Number(value)) ? new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(value)) : 'Consultar'; }
async function requestJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    if (response.status === 404) throw new Error('No encontramos ese restaurante.');
    if (response.status === 400) throw new Error('El identificador de restaurante no es válido.');
    throw new Error('No fue posible cargar los datos. Revisa que PostgreSQL esté iniciado y que se hayan importado los datos.');
  }
  return response.json();
}
function cardForRestaurant(rest) {
  const a = make('a','restaurant-card'); a.href = `/carta/${rest.id}`;
  append(a, photo(rest.id, rest.foto, '', 'restaurant-photo'));
  const body = make('div','restaurant-card-body');
  append(body, make('h3','',rest.nombre), make('p','', [rest.comuna, rest.region].filter(Boolean).join(' · ')), make('div','view','VER CARTA →'));
  return append(a, body);
}
function renderIndex(restaurants) {
  $('#main-title').replaceChildren(document.createTextNode('Una carta.'));
  $('#main-title').append(document.createElement('br'));
  append($('#main-title'), make('em','', 'Muchos sabores.'));
  $('#hero-description').textContent = 'Encuentra tu restaurante, explora su carta y descubre cada especialidad.';
  elements.index.hidden = false;
  elements.count.textContent = `${restaurants.length} restaurantes`;
  const draw = () => {
    const filter = elements.search.value.trim().toLocaleLowerCase('es');
    const matched = restaurants.filter(r => `${r.nombre} ${r.comuna} ${r.region}`.toLocaleLowerCase('es').includes(filter));
    clear(elements.restaurants);
    if (!matched.length) append(elements.restaurants, make('p','empty','No hay restaurantes que coincidan con tu búsqueda.'));
    else append(elements.restaurants, ...matched.map(cardForRestaurant));
  };
  elements.search.addEventListener('input', draw);
  draw(); status('');
}
function productCard(product, restaurantId) {
  const card = make('article','product-card');
  append(card, photo(restaurantId, product.foto, '', 'product-photo'));
  const body = make('div','product-body');
  append(body, make('h4','', product.nombre), make('p','',product.descripcion || 'Especialidad de la casa'), make('strong','product-price',price(product.precio)));
  const meta = make('div','product-meta');
  if (product.tiempo) append(meta, make('span','', `◷ ${product.tiempo}`));
  if (Number(product.puntuacion) > 0) append(meta, make('span','', `★ ${product.puntuacion}/5`));
  append(body, meta); return append(card, body);
}
function renderMenu(data) {
  const r = data.restaurante;
  document.title = `${r.nombre} · PNK Carta Digital`;
  $('#main-title').textContent = r.nombre;
  $('#hero-description').textContent = 'Conoce nuestras especialidades y elige lo que más te guste.';
  $('#back-link').hidden = false;
  elements.detail.hidden = false;
  append(elements.info,photo(r.id,r.foto, r.nombre, 'restaurant-portrait'));
  const details = make('div');
  append(details, make('h2','',r.nombre),make('p','',`📍 ${[r.calle, r.numero, r.comuna, r.region].filter(Boolean).join(', ')}`));
  if (r.fono) append(details,make('p','',`☎ ${r.fono}`));
  if (r.email) append(details,make('p','',`✉ ${r.email}`));
  append(elements.info,details);
  if (data.destacados.length) {
    append(elements.featured,make('h2','featured-title','Destacados de la casa'));
    const cards = make('div','featured-grid');
    append(cards,...data.destacados.map(p=>productCard(p,r.id)));append(elements.featured,cards);
  }
  if (!data.cartas.length) append(elements.menu,make('p','empty','Este restaurante todavía no tiene cartas publicadas.'));
  for (const menu of data.cartas) {
    const section = make('section','menu-section'); section.id = `menu-${menu.id}`;
    append(section,make('h3','', menu.nombre || 'Carta'));
    const tab = make('a','menu-tab',menu.nombre || 'Carta'); tab.href = `#${section.id}`; append(elements.tabs,tab);
    if (!menu.categorias.length) append(section,make('p','empty','Sin categorías visibles por el momento.'));
    for (const category of menu.categorias) {
      const group = make('div','category-section'); append(group,make('h4','',category.nombre));
      if (!category.productos.length) append(group,make('p','empty','Sin productos disponibles.'));
      else {const products = make('div','products');append(products,...category.productos.map(p=>productCard(p,r.id)));append(group,products);}
      append(section,group);
    }
    append(elements.menu,section);
  }
  status('');
}
async function start() {
  try {
    const selected = location.pathname.match(/^\/carta\/([^/]+)\/?$/)?.[1] || new URLSearchParams(location.search).get('id');
    if (selected !== null && selected !== undefined) return renderMenu(await requestJson(`/api/restaurantes/${encodeURIComponent(selected)}/carta`));
    const data = await requestJson('/api/restaurantes'); renderIndex(data.restaurantes);
  } catch (error) { status(error.message,'error'); }
}
start();
