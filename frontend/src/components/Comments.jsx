import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Empty, ErrorMessage, Loading, useAuth } from './Shared.jsx';

export function Comments({ restaurantId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    api(`/api/restaurantes/${restaurantId}/comentarios`).then(data => { if (active) setComments(data.comentarios); })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [restaurantId]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await api(`/api/restaurantes/${restaurantId}/comentarios`, { method: 'POST', body: JSON.stringify({ comentario: text.trim() }) });
      setComments(previous => [...previous, result.comentario]); setText(''); setMessage('Comentario publicado correctamente.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section id="seccion-comentarios"><div className="container contendor"><div className="container"><div className="section-intro"><h4 className="intro-title">Comentarios</h4></div>
    <ErrorMessage message={error} />{loading ? <Loading /> : <div id="comentarios-lista" aria-live="polite">{comments.length ? comments.map(c => <div key={c.id} className="card bg-light"><div className="card-body"><b>{c.usuario || 'Usuario'}</b><br /><span>{c.comentario}</span></div></div>) : <Empty>No hay comentarios todavía.</Empty>}</div>}
    {user ? <form id="comentarios-form" className="mt-4" onSubmit={submit}><div className="form-group"><label htmlFor="texto-comentario">Deja tu comentario</label><textarea id="texto-comentario" className="form-control" rows="3" maxLength={1000} minLength={1} required value={text} onChange={e => setText(e.target.value)} /></div><button className="btn btn-primary" disabled={busy || !text.trim()}>{busy ? 'Publicando…' : 'Publicar comentario'}</button><p role="status">{message}</p></form> : <p className="text-muted">Inicia sesión para publicar un comentario.</p>}
    <hr /></div></div></section>;
}
