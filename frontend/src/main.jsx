import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './components/Shared.jsx';
import PublicApp from './PublicApp.jsx';
import AdminApp from './admin/AdminApp.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<AuthProvider>{window.location.pathname.startsWith('/admin') ? <AdminApp /> : <PublicApp />}</AuthProvider>);
