import React, { useState } from 'react';
import { cash } from '../api.js';

export function useCart(id) {
  const key = `pnk.cesta.v1.${id}`;
  const [ids, setIds] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || '[]');
      return Array.isArray(saved) ? saved.filter(n => Number.isSafeInteger(n) && n > 0).slice(0, 100) : [];
    } catch { return []; }
  });
  const [error, setError] = useState('');
  function save(next) {
    try { sessionStorage.setItem(key, JSON.stringify(next)); setIds(next); setError(''); }
    catch { setError('No fue posible guardar el carrito en este navegador.'); }
  }
  function add(item) {
    if (item.disponible === false) return;
    if (ids.length >= 100) { setError('El carrito alcanzó el máximo de productos.'); return false; }
    save([...ids, item.id]); return true;
  }
  return { ids, add, error, clear: () => save([]), remove: index => save(ids.filter((_, i) => i !== index)) };
}
export function Cart({ restaurantId, products, cart }) {
  const byId = new Map(products.filter(p => p.disponible !== false).map(p => [p.id, p]));
  const entries = cart.ids.map((id, index) => ({ item: byId.get(id), index })).filter(e => e.item);
  return <section id="seccion-carrito"><div className="container contendor"><div className="text-center">
    <h4 className="intro-title">Productos Agregados para Solicitar</h4>
    <p><a href={`/carta/${restaurantId}`} className="btn btn-outline-primary">Volver a la Carta</a> <button className="btn btn-outline-danger" onClick={() => { if (window.confirm('¿Eliminar todos los productos del carrito?')) cart.clear(); }}>Eliminar Todo</button></p>
  </div><div className="table-responsive"><table className="table table-hover table-lg"><thead><tr><th>Código</th><th>Producto</th><th>Precios</th><th>Acción</th></tr></thead><tbody id="filas-carrito">
    {entries.length ? entries.map(({ item, index }) => <tr key={index}><th>{item.id}</th><td>{item.nombre}</td><td>{cash(item.precio)}</td><td><button className="btn btn-sm btn-outline-danger" onClick={() => cart.remove(index)}>Eliminar</button></td></tr>) : <tr><td colSpan="4">No hay productos seleccionados.</td></tr>}
  </tbody></table></div><h4 className="price-tag text-right">Total: {cash(entries.reduce((sum, e) => sum + (e.item.precio || 0), 0))}</h4>
    <hr /><h3 className="price-tag text-center">¡¡¡Si estás listo con tu pedido, llama al garzón para solicitarlo!!!</h3>
  </div></section>;
}
