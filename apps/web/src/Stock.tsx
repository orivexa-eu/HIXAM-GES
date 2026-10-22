import { useEffect, useState } from 'react';
import { api } from './api';

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '-');
const qty = (r: any) => [Number(r.qty_kg ?? r.kg) ? `${Number(r.qty_kg ?? r.kg)} kg` : '', Number(r.qty_pieces ?? r.pieces) ? `${r.qty_pieces ?? r.pieces} pcs` : ''].filter(Boolean).join(' / ') || '0';

export function Dashboard() {
  const [s, setS] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api('/stock/summary').then(setS); api('/stock').then(setRows); }, []);
  const soon = rows.filter((r) => r.expiry_date && new Date(r.expiry_date) <= new Date(Date.now() + 3 * 864e5));
  return (
    <div>
      <h2>Tableau de bord</h2>
      <div className="kpis">
        <div className="kpi"><span>Stock total</span><b>{s ? Math.round(s.total_kg) : '-'} kg</b></div>
        <div className="kpi"><span>Lots en stock</span><b>{s?.active_lots ?? '-'}</b></div>
        <div className={'kpi ' + (s?.expiring_lots ? 'warn' : '')}><span>Lots proches de la DLC (3 j)</span><b>{s?.expiring_lots ?? '-'}</b></div>
      </div>
      <h3>Lots proches de la date limite</h3>
      <table>
        <thead><tr><th>Lot</th><th>Produit</th><th>Emplacement</th><th>Quantite</th><th>DLC</th></tr></thead>
        <tbody>
          {soon.map((r) => <tr key={r.lot_id + r.location_id}><td>{r.lot_code}</td><td>{r.product}</td><td>{r.location}</td><td>{qty(r)}</td><td>{fmtDate(r.expiry_date)}</td></tr>)}
          {!soon.length && <tr><td colSpan={5} className="empty">Aucun lot a risque.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function Stock({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [mv, setMv] = useState<any[]>([]);
  const [modal, setModal] = useState<'receive' | 'move' | null>(null);
  const [pre, setPre] = useState<any>(null);
  const load = () => { api('/stock').then(setRows); api('/stock/movements?limit=30').then(setMv); };
  useEffect(load, []);
  return (
    <div>
      <div className="bar">
        <h2>Stock</h2>
        {canEdit && <div className="row"><button onClick={() => { setPre(null); setModal('receive'); }}>+ Reception</button></div>}
      </div>
      <table>
        <thead><tr><th>Produit</th><th>Lot</th><th>Emplacement</th><th>Quantite</th><th>DLC</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.lot_id + r.location_id}>
              <td>{r.product}</td><td>{r.lot_code}</td><td>{r.location}</td><td>{qty(r)}</td><td>{fmtDate(r.expiry_date)}</td>
              <td className="act">{canEdit && <button className="ghost" onClick={() => { setPre(r); setModal('move'); }}>Deplacer / perte</button>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="empty">Stock vide. Commencez par une reception.</td></tr>}
        </tbody>
      </table>
      <h3>Derniers mouvements</h3>
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Produit</th><th>Lot</th><th>De</th><th>Vers</th><th>Quantite</th><th>Par</th></tr></thead>
        <tbody>
          {mv.map((m) => <tr key={m.id}><td>{new Date(m.created_at).toLocaleString('fr-FR')}</td><td>{m.type}</td><td>{m.product}</td><td>{m.lot_code}</td><td>{m.from_location || '-'}</td><td>{m.to_location || '-'}</td><td>{qty(m)}</td><td>{m.user_name}</td></tr>)}
        </tbody>
      </table>
      {modal === 'receive' && <Receive onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {modal === 'move' && <Move row={pre} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
    </div>
  );
}

function useLists() {
  const [d, setD] = useState<any>({ products: [], suppliers: [], locations: [] });
  useEffect(() => { Promise.all([api('/products'), api('/suppliers'), api('/locations')]).then(([products, suppliers, locations]) => setD({ products, suppliers, locations })); }, []);
  return d;
}

function Receive({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const d = useLists();
  const [f, setF] = useState<any>({});
  const [err, setErr] = useState('');
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('/stock/receive', 'POST', f); onDone(); } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="modal" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Reception d'un arrivage</h3>
        <label>Produit *<select required onChange={set('product_id')}><option value="">-</option>{d.products.map((p: any) => <option key={p.id} value={p.id}>{p.name_fr}</option>)}</select></label>
        <label>Fournisseur<select onChange={set('supplier_id')}><option value="">-</option>{d.suppliers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Emplacement *<select required onChange={set('location_id')}><option value="">-</option>{d.locations.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <div className="row"><label>Poids (kg)<input type="number" step="any" min="0" onChange={set('qty_kg')} /></label><label>Pieces<input type="number" min="0" onChange={set('qty_pieces')} /></label></div>
        <div className="row"><label>Date d'abattage<input type="date" onChange={set('slaughter_date')} /></label><label>DLC<input type="date" onChange={set('expiry_date')} /></label></div>
        <label>Temperature a la reception (°C)<input type="number" step="any" onChange={set('temperature')} /></label>
        {err && <p className="err">{err}</p>}
        <div className="row"><button type="button" className="ghost" onClick={onClose}>Annuler</button><button>Enregistrer</button></div>
      </form>
    </div>
  );
}

function Move({ row, onClose, onDone }: { row: any; onClose: () => void; onDone: () => void }) {
  const d = useLists();
  const [f, setF] = useState<any>({ type: 'TRANSFERT', lot_id: row.lot_id, from_location: row.location_id });
  const [err, setErr] = useState('');
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('/stock/move', 'POST', f); onDone(); } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="modal" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{row.product} - lot {row.lot_code}</h3>
        <p className="muted">Depuis : {row.location} (disponible : {qty(row)})</p>
        <label>Action<select value={f.type} onChange={set('type')}><option value="TRANSFERT">Deplacer vers un autre emplacement</option><option value="PERTE">Declarer une perte</option></select></label>
        {f.type === 'TRANSFERT' && <label>Destination *<select required onChange={set('to_location')}><option value="">-</option>{d.locations.filter((l: any) => l.id !== row.location_id).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        <div className="row"><label>Poids (kg)<input type="number" step="any" min="0" onChange={set('qty_kg')} /></label><label>Pieces<input type="number" min="0" onChange={set('qty_pieces')} /></label></div>
        <label>{f.type === 'PERTE' ? 'Motif *' : 'Note'}<input required={f.type === 'PERTE'} onChange={set('note')} /></label>
        {err && <p className="err">{err}</p>}
        <div className="row"><button type="button" className="ghost" onClick={onClose}>Annuler</button><button>Valider</button></div>
      </form>
    </div>
  );
}
