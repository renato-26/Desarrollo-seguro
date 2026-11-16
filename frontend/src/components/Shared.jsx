import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, logoFallback } from '../api.js';

const AuthContext = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/api/auth/me').then(data => setUser(data.usuario)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  async function login(identifier, password) {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
    setUser(data.usuario); setError(''); return data.usuario;
  }
  async function logout() { await api('/api/auth/logout', { method: 'POST' }); setUser(null); }
  return <AuthContext.Provider value={{ user, loading, error, login, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
export function Loading() { return <p className="legacy-loading" role="status">Cargando información…</p>; }
export function Empty({ children = 'No hay información para Mostrar' }) { return <p className="empty-category">{children}</p>; }
export function ErrorMessage({ message }) { return message ? <p role="alert" className="alert alert-danger">{message}</p> : null; }
export function Photo({ src, alt, fallback = logoFallback, ...props }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <img {...props} src={failed ? fallback : src} alt={alt || ''} loading="lazy" onError={() => setFailed(true)} />;
}

export function Login({ admin = false, onSuccess }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const user = await login(identifier.trim(), password);
      setPassword('');
      if (admin && !['ADMIN_GENERAL', 'ADMIN_RESTAURANTE'].includes(user.rol)) setError('Tu cuenta no tiene permisos administrativos.');
      else onSuccess?.(user);
    } catch (e) { setError(e.message); setPassword(''); }
    finally { setBusy(false); }
  }
  return <div><form id="login-form" className={admin ? 'admin-login-form' : 'form-inline'} onSubmit={submit}>
    <label className={admin ? '' : 'sr-only'} htmlFor="login-identifier">Correo o usuario</label>
    <input id="login-identifier" className="form-control" value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" placeholder="Correo o usuario" maxLength={255} required />
    <label className={admin ? '' : 'sr-only'} htmlFor="login-password">Contraseña</label>
    <input id="login-password" className="form-control" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Contraseña" maxLength={1024} required />
    <button className="btn btn-outline-primary" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
  </form><ErrorMessage message={error} /></div>;
}

export function SessionBar() {
  const { user, loading, logout, error: authError } = useAuth();
  const [error, setError] = useState('');
  return <nav className="navbar navbar-light bg-light public-session" aria-label="Sesión">
    {loading ? <Loading /> : user ? <div id="usuario-sesion"><span>Sesión: {user.nombre || user.email}</span>
      <button className="btn btn-outline-secondary btn-sm ml-2" onClick={() => logout().catch(e => setError(e.message))}>Salir</button>
      {user.rol?.startsWith('ADMIN_') && <a className="ml-3" href="/admin/dashboard">Administración</a>}</div> : <Login />}
    <ErrorMessage message={error || authError} />
  </nav>;
}
