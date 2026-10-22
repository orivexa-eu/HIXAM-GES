import { useEffect, useState } from 'react';
import { api } from './api';

export type Field = { key: string; label: string; type?: 'text' | 'number' | 'select'; options?: [string, string][]; required?: boolean; list?: boolean };

export function Crud({ title, endpoint, fields, canEdit = true }: { title: string; endpoint: string; fields: Field[]; canEdit?: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any | null>(null);
  const [err, setErr] = useState('');

  const load = () => api(endpoint).then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [endpoint]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      const body: any = {};
      fields.forEach((f) => (body[f.key] = form[f.key] ?? ''));
      if (form.id) await api(`${endpoint}/${form.id}`, 'PUT', body);
      else await api(endpoint, 'POST', body);
      setForm(null);
      load();
    } catch (e: any) { setErr(e.message); }
  };
  const del = async (r: any) => {
    if (!confirm('Supprimer cet element ?')) return;
    try { await api(`${endpoint}/${r.id}`, 'DELETE'); load(); } catch (e: any) { setErr(e.message); }
  };
  const show = (f: Field, v: any) => (f.type === 'select' ? f.options?.find((o) => o[0] === v)?.[1] ?? v : v ?? '');

  return (
    <div>
      <div className="bar">
        <h2>{title}</h2>
        {canEdit && <button onClick={() => setForm({})}>+ Ajouter</button>}
      </div>
      {err && <p className="err">{err}</p>}
      <table>
        <thead><tr>{fields.filter((f) => f.list !== false).map((f) => <th key={f.key}>{f.label}</th>)}<th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {fields.filter((f) => f.list !== false).map((f) => <td key={f.key}>{show(f, r[f.key])}</td>)}
              <td className="act">{canEdit && <><button className="ghost" onClick={() => setForm(r)}>Modifier</button><button className="ghost red" onClick={() => del(r)}>Supprimer</button></>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={fields.length + 1} className="empty">Aucun element pour le moment.</td></tr>}
        </tbody>
      </table>
      {form && (
        <div className="modal" onClick={() => setForm(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h3>{form.id ? 'Modifier' : 'Ajouter'}</h3>
            {fields.map((f) => (
              <label key={f.key}>{f.label}{f.required && ' *'}
                {f.type === 'select' ? (
                  <select required={f.required} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                    <option value="">-</option>
                    {f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : (
                  <input required={f.required} type={f.type === 'number' ? 'number' : 'text'} step="any" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                )}
              </label>
            ))}
            {err && <p className="err">{err}</p>}
            <div className="row"><button type="button" className="ghost" onClick={() => setForm(null)}>Annuler</button><button>Enregistrer</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
