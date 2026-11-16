import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { ErrorMessage, Loading, SessionBar } from './components/Shared.jsx';
import { FeaturedProducts, Footer, Header, Menus } from './components/Catalog.jsx';
import { Cart, useCart } from './components/Cart.jsx';
import { Comments } from './components/Comments.jsx';

export default function PublicApp() {
  const match = window.location.pathname.match(/^\/(carta|carrito)\/([^/]+)\/?$/);
  const id = match ? match[2] : new URLSearchParams(window.location.search).get('id') || '1';
  const valid = /^[1-9]\d{0,9}$/.test(id) && Number(id) <= 2147483647;
  const [data, setData] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [error, setError] = useState(valid ? '' : 'Identificador de restaurante inválido.');
  const [selected, setSelected] = useState(null);
  const cart = useCart(id);
  const isCart = match?.[1] === 'carrito';
  useEffect(() => {
    if (!valid) return;
    let active = true;
    Promise.all([api(`/api/restaurantes/${id}/carta`), api('/api/restaurantes')]).then(([menu, list]) => {
      if (!active) return;
      setData(menu); setRestaurants(list.restaurantes); document.title = `${menu.restaurante.nombre} - PNK Security`;
    }).catch(e => { if (active) setError(e.status === 404 ? 'Restaurante no encontrado' : e.message); });
    return () => { active = false; };
  }, [id, valid]);
  useEffect(() => {
    if (!selected) return;
    const close = e => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', close); document.getElementById('close-selection')?.focus();
    return () => window.removeEventListener('keydown', close);
  }, [selected]);
  const products = data?.cartas.flatMap(m => m.categorias.flatMap(c => c.productos)) || [];
  function select(item) { if (cart.add(item)) setSelected(item); }
  return <><SessionBar /><main data-react-page="carta"><div className="container"><ErrorMessage message={error || cart.error} /></div>
    {!data && !error && <div className="container"><Loading /></div>}
    {data && <><Header restaurant={data.restaurante} restaurants={restaurants} cartCount={cart.ids.length} isCart={isCart} />
      {isCart ? <Cart restaurantId={id} products={products} cart={cart} /> : <><FeaturedProducts items={data.destacados} restaurantId={id} onSelect={select} /><Menus menus={data.cartas} restaurantId={id} onSelect={select} /><Comments restaurantId={id} /></>}
    </>}
  </main><Footer />
    {selected && <div className="modal show d-block selection-modal" role="dialog" aria-modal="true" aria-labelledby="selection-title"><div className="modal-dialog"><div className="modal-content"><div className="modal-header"><h5 id="selection-title">Selección de Producto</h5><button id="close-selection" className="close" aria-label="Cerrar" onClick={() => setSelected(null)}>×</button></div><div className="modal-body">¡El producto seleccionado ha sido agregado sin problemas!<p>{selected.nombre}</p></div></div></div></div>}
  </>;
}
