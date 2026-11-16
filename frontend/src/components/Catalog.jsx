import React, { useRef, useState } from 'react';
import { cash, imagePath, productFallback } from '../api.js';
import { Empty, Photo } from './Shared.jsx';

export function RestaurantInfo({ restaurant: r }) {
  return <div className="row"><div className="col-lg-12 text-center">
    <h4 id="restaurante-nombre">{r.nombre}</h4>
    <h5 id="restaurante-direccion">{[r.calle, r.numero ? `#${r.numero}` : '', r.comuna].filter(Boolean).join(' ')}</h5>
    <h5 id="restaurante-contacto">{r.fono && <span>☎ {r.fono}</span>}{r.email && <span>✉ {r.email}</span>}</h5>
  </div></div>;
}
export function Header({ restaurant, restaurants, cartCount, isCart }) {
  return <section><div className="container contendor legacy-cabecera"><div className="row">
    <div className="col-lg-4 text-center"><div className="media"><img className="logosintituciones" src="/static/legacy/img/logo.png" width="190" alt="PNK" /></div></div>
    <div className="col-lg-4 text-center"><div className="media"><Photo className="logosintituciones" src={imagePath(restaurant.id, restaurant.foto)} width="170" alt={restaurant.nombre} /></div></div>
    <div className="col-lg-4"><div className="carro"><div className="media float-right">{!isCart && <a className="button_carrito" id="carrito-enlace" href={`/carrito/${restaurant.id}`}>🛒 Productos Seleccionados <span id="carrito-contador">({cartCount})</span></a>}</div></div></div>
  </div><RestaurantInfo restaurant={restaurant} />
    <div className="restaurant-switch"><label htmlFor="restaurant-select">Restaurante</label><select id="restaurant-select" className="form-control" value={restaurant.id} onChange={e => { window.location.href = `/carta/${e.target.value}`; }}>
      {restaurants.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
    </select></div>
  </div></section>;
}
function Stars({ score }) { return <ul className="rating-star" aria-label={`${Number(score) || 0} de 5 estrellas`}>{Array.from({ length: Math.min(5, Math.max(0, Number(score) || 0)) }, (_, i) => <li key={i}>★</li>)}</ul>; }
function ProductDetails({ item }) { return <p>{item.descripcion && <>{item.descripcion}<br /></>}{item.observaciones && <>{item.observaciones}<br /></>}{item.tiempo && <>◷ {item.tiempo}</>}</p>; }
export function Product({ item, restaurantId, onSelect, featured = false }) {
  const select = <button className="button" type="button" disabled={item.disponible === false} onClick={() => onSelect(item)}>{item.disponible === false ? 'No disponible' : 'Seleccionar'}</button>;
  if (featured) return <article className="featured-item" data-product-id={item.id}>
    <Photo src={imagePath(restaurantId, item.foto, productFallback)} fallback={productFallback} className="card-img rounded-0" alt={item.nombre} width="350" height="235" />
    <div className="item-body"><h3>{item.nombre}</h3><ProductDetails item={item} /><div className="d-flex justify-content-between"><Stars score={item.puntuacion} /><h3 className="price-tag">{cash(item.precio)}</h3></div>{select}</div>
  </article>;
  return <article className="media align-items-center food-card" data-product-id={item.id}>
    <Photo src={imagePath(restaurantId, item.foto, productFallback)} fallback={productFallback} className="mr-3 mr-sm-4" alt={item.nombre} width="120" />
    <div className="media-body"><div className="d-flex justify-content-between food-card-title"><h4>{item.nombre}</h4><h3 className="price-tag">{cash(item.precio)}</h3></div><ProductDetails item={item} /><Stars score={item.puntuacion} />{select}</div>
  </article>;
}
export function FeaturedProducts({ items, ...props }) {
  const list = useRef(null);
  if (!items.length) return null;
  return <section id="seccion-destacados" className="destacados"><div className="container contendor">
    <div className="section-intro"><h4 className="intro-title">Menús Destacados</h4></div>
    <div id="destacados" className="react-featured-carousel" ref={list}>{items.map(item => <Product key={item.id} item={item} featured {...props} />)}</div>
    {items.length > 1 && <div className="carousel-controls"><button aria-label="Destacado anterior" onClick={() => list.current.scrollBy({ left: -380, behavior: 'smooth' })}>‹</button><button aria-label="Destacado siguiente" onClick={() => list.current.scrollBy({ left: 380, behavior: 'smooth' })}>›</button></div>}
  </div></section>;
}
export function Category({ category, ...props }) {
  return <><div className="section-intro mb-20px"><h4 className="intro-title">{category.nombre}</h4></div>
    <div className="row">{category.productos.length ? category.productos.map(item => <div key={item.id} className={category.productos.length > 1 ? 'col-lg-6' : 'col-lg-12'}><Product item={item} {...props} /></div>) : <div className="col-lg-12"><Empty /></div>}</div></>;
}
export function Menus({ menus, ...props }) {
  const [selected, setSelected] = useState(menus[0]?.id);
  return <section id="seccion-cartas"><div className="container contendor"><div className="container"><div className="row"><div className="col-lg-12">
    <nav><div id="pestanas-cartas" className="nav nav-tabs nav-fill" role="tablist" aria-label="Cartas">
      {menus.map(menu => <a key={menu.id} id={`tab-${menu.id}`} href={`#panel-${menu.id}`} className={`nav-item nav-link${selected === menu.id ? ' active' : ''}`} role="tab" aria-selected={selected === menu.id} aria-controls={`panel-${menu.id}`} onClick={event => { event.preventDefault(); setSelected(menu.id); }}>{menu.nombre || 'Carta'}</a>)}
    </div></nav><div id="contenido-cartas" className="tab-content py-3 px-3 px-sm-0">
      {!menus.length && <Empty />}{menus.filter(menu => menu.id === selected).map(menu => <div key={menu.id} id={`panel-${menu.id}`} role="tabpanel" aria-labelledby={`tab-${menu.id}`}>
        {menu.categorias.length ? menu.categorias.map(category => <Category key={category.id} category={category} {...props} />) : <Empty />}
      </div>)}
    </div></div></div></div></div></section>;
}
export function Footer() {
  return <footer className="footer-area section-gap"><div className="container contendor"><div className="footer-bottom row align-items-center text-center"><p className="footer-text m-0 col-md-12">Copyright 2020, Todos los Derechos reservados PNK,<br />Sitio desarrollado para la Explotación de Vulnerabilidades Web, Laboratorio de Programación Segura I<br /><b>Área Tecnologías de Información y Ciberseguridad - Inacap Sede La Serena</b></p></div></div></footer>;
}
