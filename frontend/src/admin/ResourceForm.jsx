import React, { useState } from 'react';
import { ErrorMessage } from '../components/Shared.jsx';
import { formPayload, initialRecord, resources } from './resources.js';

export default function ResourceForm({ resource, record, lookups, onSave, onCancel }) {
  const config = resources[resource];
  const [values, setValues] = useState(() => initialRecord(resource, record));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function set(name, value) { setValues(current => ({ ...current, [name]: value })); }
  async function submit(event) {
    event.preventDefault(); setError('');
    if (record && record.activo && !values.activo && !window.confirm(`¿Desactivar este ${config.singular}? Dejará de estar disponible.`)) return;
    const payload = formPayload(resource, values, record);
    if (!Object.keys(payload).length) { setError('No hay cambios para guardar.'); return; }
    setBusy(true);
    try { await onSave(payload); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className="admin-panel" aria-labelledby="editor-title"><h2 id="editor-title">{record ? 'Editar' : 'Crear'} {config.singular}</h2>
    <ErrorMessage message={error} /><form onSubmit={submit}><fieldset disabled={busy}><div className="admin-form-grid">
      {config.fields.map(field => {
        const id = `field-${field.name}`;
        const common = { id, name: field.name, className: 'form-control', required: field.required || (field.name === 'password' && !record), value: values[field.name], onChange: e => set(field.name, e.target.value) };
        let control;
        if (field.type === 'checkbox') control = <input id={id} type="checkbox" checked={values[field.name]} onChange={e => set(field.name, e.target.checked)} />;
        else if (field.type === 'relation' || field.type === 'assignments') control = <select {...common} multiple={field.type === 'assignments'} onChange={e => set(field.name, field.type === 'assignments' ? Array.from(e.target.selectedOptions, o => Number(o.value)) : e.target.value)}>
          {field.type === 'relation' && <option value="">Selecciona una opción</option>}
          {(lookups[field.resource] || []).map(row => <option key={row.id} value={row.id}>{row.nombre} (#{row.id}){row.activo === false ? ' · Inactivo' : ''}</option>)}
        </select>;
        else if (field.type === 'role') control = <select {...common}><option value="CLIENTE">Cliente</option><option value="ADMIN_RESTAURANTE">Administrador de restaurante</option><option value="ADMIN_GENERAL">Administrador general</option></select>;
        else if (field.type === 'textarea') control = <textarea {...common} rows="3" maxLength={field.maxLength} />;
        else control = <input {...common} type={field.type} min={field.min} max={field.max} step={field.type === 'number' ? '1' : undefined} minLength={field.minLength} maxLength={field.maxLength} autoComplete={field.type === 'password' ? 'new-password' : undefined} />;
        return <div className="admin-field" key={field.name}><label htmlFor={id}>{field.label}{common.required ? ' *' : ''}</label>{control}{field.hint && <small>{field.hint}</small>}</div>;
      })}
    </div><div className="admin-actions mt-4"><button className="btn btn-primary" type="submit">{busy ? 'Guardando…' : 'Guardar'}</button><button className="btn btn-outline-secondary" type="button" onClick={onCancel}>Cancelar</button></div></fieldset></form>
  </section>;
}
