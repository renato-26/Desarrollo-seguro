import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorMessage, Loading, Login, useAuth } from '../components/Shared.jsx';
import { resources } from './resources.js';
import ResourcePage from './ResourcePage.jsx';

function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/api/admin/dashboard').then(result => setData(result.dashboard)).catch(e => setError(e.message)); }, []);
  return <><h1>Dashboard</h1><p>Estadísticas actuales según tus permisos.</p><ErrorMessage message={error} />{!data && !error && <Loading />}
    <div className="admin-metrics">{data && Object.entries(data).map(([name, metric]) => <a href={`/admin/${name}`} className="admin-metric" key={name}><span>{resources[name]?.title || name}</span><strong>{metric.total}</strong><small>{metric.activos} activos</small></a>)}</div>
  </>;
}
export default function AdminApp() {
  const { user, loading, logout, error: authError } = useAuth();
  const [error, setError] = useState('');
  const page = window.location.pathname.split('/')[2] || 'dashboard';
  const allowed = ['ADMIN_GENERAL', 'ADMIN_RESTAURANTE'].includes(user?.rol);
  useEffect(() => {
    document.title = 'Administración - PNK Security';
    if (!loading && !user && page !== 'login') window.location.replace('/admin/login');
    if (!loading && allowed && page === 'login') window.location.replace('/admin/dashboard');
  }, [loading, user, page, allowed]);
  if (loading) return <div className="admin-app"><div className="container"><Loading /></div></div>;
  if (page === 'login' || !user) return <div className="admin-app"><div className="admin-login"><a href="/carta/1"><img src="/static/legacy/img/logo.png" width="150" alt="PNK" /></a><section className="admin-panel"><h1>Acceso administrativo</h1><p>Ingresa con tu cuenta autorizada.</p><ErrorMessage message={authError} /><Login admin onSuccess={() => window.location.assign('/admin/dashboard')} /></section><a href="/carta/1">Volver a la carta pública</a></div></div>;
  return <div className="admin-app"><header className="admin-topbar"><a className="admin-brand" href="/admin/dashboard">PNK · Administración</a><div>{user.nombre} <button className="btn btn-sm btn-outline-light ml-2" onClick={() => logout().then(() => window.location.assign('/admin/login')).catch(e => setError(e.message))}>Cerrar sesión</button></div></header>
    <div className="admin-layout"><nav className="admin-sidebar" aria-label="Administración">
      <a href="/admin/dashboard" aria-current={page === 'dashboard' ? 'page' : undefined}>Dashboard</a>
      {Object.entries(resources).filter(([name]) => name !== 'usuarios' || user.rol === 'ADMIN_GENERAL').map(([name, config]) => <a key={name} href={`/admin/${name}`} aria-current={page === name ? 'page' : undefined}>{config.title}</a>)}
      <a href="/carta/1">Carta pública ↗</a>
    </nav><main className="admin-content"><ErrorMessage message={error || authError} />{!allowed || (page === 'usuarios' && user.rol !== 'ADMIN_GENERAL') ? <ErrorMessage message="Tu cuenta no tiene permisos para acceder a esta sección." /> : page === 'dashboard' ? <Dashboard /> : resources[page] ? <ResourcePage key={page} resource={page} /> : <ErrorMessage message="Sección no encontrada." />}</main></div>
  </div>;
}
