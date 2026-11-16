import React, { useEffect, useState } from 'react';
import { api, cash } from '../api.js';
import { Empty, ErrorMessage, Loading, useAuth } from '../components/Shared.jsx';
import { resources } from './resources.js';
import ResourceForm from './ResourceForm.jsx';

export default function ResourcePage({ resource }) {
  const config = resources[resource];
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [lookups, setLookups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editor, setEditor] = useState(null);
  const [query, setQuery] = useState('');
  const [restaurant, setRestaurant] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const dependencies = [...new Set(['restaurantes', ...config.fields.filter(f => f.resource).map(f => f.resource)])].filter(r => r !== resource);
    const [data, ...parents] = await Promise.all([api(`/api/admin/${resource}`), ...dependencies.map(name => api(`/api/admin/${name}`))]);
    setRecords(data.registros);
    setLookups(Object.fromEntries(dependencies.map((name, i) => [name, parents[i].registros])));
  }
  useEffect(() => {
    refresh().catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [resource]);
  async function edit(id) {
    setError(''); setBusy(true);
    try { const data = await api(`/api/admin/${resource}/${id}`); setEditor({ record: data.registro, key: `${id}-${Date.now()}` }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function save(payload) {
    await api(`/api/admin/${resource}${editor.record ? `/${editor.record.id}` : ''}`, { method: editor.record ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    await refresh(); setEditor(null); setMessage('Registro guardado correctamente.');
  }
  async function toggle(record) {
    if (!window.confirm(`¿${record.activo ? 'Desactivar' : 'Activar'} «${record.nombre}»?`)) return;
    setError(''); setBusy(true);
    try {
      await api(`/api/admin/${resource}/${record.id}`, { method: 'PATCH', body: JSON.stringify({ activo: !record.activo }) });
      await refresh(); setMessage('Estado actualizado correctamente.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const shown = records.filter(r => `${r.nombre} ${r.email || ''} ${r.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (!restaurant || String(r.restaurante_id ?? r.id) === restaurant));
  const canCreate = resource !== 'restaurantes' || user.rol === 'ADMIN_GENERAL';
  return <><h1>{config.title}</h1><p>Consulta y administra los registros de tus restaurantes.</p>
    <ErrorMessage message={error} /><p role="status">{message}</p>
    <div className="admin-actions admin-list-toolbar"><input className="form-control admin-search" aria-label="Buscar registros" placeholder="Buscar por nombre, correo o código" value={query} onChange={e => setQuery(e.target.value)} />
      {canCreate && <button className="btn btn-primary" disabled={loading || busy} onClick={() => { setEditor({ record: null, key: Date.now() }); setMessage(''); }}>Crear {config.singular}</button>}
    </div>
    {!['usuarios', 'restaurantes'].includes(resource) && <div className="admin-search mt-3"><label htmlFor="filter-restaurant">Filtrar por restaurante</label><select id="filter-restaurant" className="form-control" value={restaurant} onChange={e => setRestaurant(e.target.value)}><option value="">Todos los asignados</option>{(lookups.restaurantes || []).map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></div>}
    {editor && <ResourceForm key={editor.key} resource={resource} record={editor.record} lookups={lookups} onSave={save} onCancel={() => setEditor(null)} />}
    {loading ? <Loading /> : <section className="admin-panel"><div className="table-responsive"><table className="table"><thead><tr><th>Código</th><th>Nombre</th>{resource === 'productos' && <th>Precio</th>}{resource === 'usuarios' && <><th>Correo</th><th>Rol</th></>}<th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {shown.map(record => <tr key={record.id}><td>{record.id}</td><td>{record.nombre}{record.restaurante_id && resource !== 'restaurantes' && <small className="d-block">Restaurante #{record.restaurante_id}</small>}</td>{resource === 'productos' && <td>{cash(record.precio)}</td>}{resource === 'usuarios' && <><td>{record.email}</td><td>{record.rol}</td></>}<td><span className={`admin-status${record.activo ? '' : ' inactive'}`}>{record.activo ? 'Activo' : 'Inactivo'}</span></td><td><div className="admin-actions"><button className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => edit(record.id)}>Ver / editar</button><button className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => toggle(record)}>{record.activo ? 'Desactivar' : 'Activar'}</button>{resource === 'restaurantes' && <a className="btn btn-sm btn-outline-primary" href={`/carta/${record.id}`}>Ver carta</a>}</div></td></tr>)}
    </tbody></table>{!shown.length && <Empty>No hay registros que coincidan.</Empty>}</div></section>}
  </>;
}
