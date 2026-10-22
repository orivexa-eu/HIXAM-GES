import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import { Crud, Field } from './Crud';
import { Dashboard, Stock } from './Stock';

const LOC_TYPES: [string, string][] = [['DEPOT', 'Depot'], ['CHAMBRE_FROIDE', 'Chambre froide'], ['VEHICULE', 'Vehicule']];
const ROLES: [string, string][] = [['admin', 'Administrateur'], ['gerente', 'Gerant'], ['almacen', 'Responsable depot'], ['repartidor', 'Livreur']];

const F: Record<string, Field[]> = {
  products: [
    { key: 'name_fr', label: 'Nom (FR)', required: true }, { key: 'name_ar', label: 'Nom (AR)' }, { key: 'category', label: 'Categorie' },
    { key: 'unit', label: 'Unite', type: 'select', options: [['kg', 'Kilo'], ['piece', 'Piece']], required: true },
    { key: 'shelf_life_days', label: 'Duree de vie (jours)', type: 'number', list: false }, { key: 'price', label: 'Prix de base (MAD)', type: 'number' },
  ],
  suppliers: [{ key: 'name', label: 'Nom', required: true }, { key: 'ice', label: 'ICE' }, { key: 'phone', label: 'Telephone' }, { key: 'onssa_approval', label: 'Agrement ONSSA' }, { key: 'notes', label: 'Notes', list: false }],
  customers: [
    { key: 'name', label: 'Raison sociale', required: true }, { key: 'ice', label: 'ICE' }, { key: 'phone', label: 'Telephone' }, { key: 'address', label: 'Adresse' },
    { key: 'payment_terms', label: 'Conditions de paiement' }, { key: 'credit_limit', label: 'Plafond de credit (MAD)', type: 'number' },
    { key: 'gps_lat', label: 'Latitude GPS', type: 'number', list: false }, { key: 'gps_lng', label: 'Longitude GPS', type: 'number', list: false },
  ],
  locations: [{ key: 'name', label: 'Nom', required: true }, { key: 'type', label: 'Type', type: 'select', options: LOC_TYPES, required: true }, { key: 'plate', label: 'Immatriculation' }, { key: 'target_temp', label: 'Temperature cible (°C)', type: 'number' }],
};

function Login({ onDone }: { onDone: (u: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { const r = await api('/auth/login', 'POST', { email, password }); setToken(r.token); onDone(r.user); } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>HIXAM-GES</h1>
        <p className="muted">Gestion de stock et livraison</p>
        <label>Email<input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Mot de passe<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <p className="err">{err}</p>}
        <button>Se connecter</button>
      </form>
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(!getToken());
  const [page, setPage] = useState('dashboard');
  useEffect(() => { if (getToken()) api('/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true)); }, []);
  if (!ready) return null;
  if (!user) return <Login onDone={setUser} />;

  const manage = ['admin', 'gerente'].includes(user.role);
  const stockRole = manage || user.role === 'almacen';
  const menu: [string, string][] = [['dashboard', 'Tableau de bord'], ['stock', 'Stock'], ['products', 'Produits'], ['suppliers', 'Fournisseurs'], ['customers', 'Clients'], ['locations', 'Depots et vehicules']];
  const title = (k: string) => menu.find((m) => m[0] === k)![1];
  return (
    <div className="app">
      <aside>
        <h1>HIXAM-GES</h1>
        {menu.map(([k, l]) => <a key={k} className={page === k ? 'on' : ''} onClick={() => setPage(k)}>{l}</a>)}
        <div className="who">{user.name}<br /><small>{ROLES.find((r) => r[0] === user.role)?.[1]}</small><a onClick={() => { setToken(null); location.reload(); }}>Deconnexion</a></div>
      </aside>
      <main>
        {page === 'dashboard' && <Dashboard />}
        {page === 'stock' && <Stock canEdit={stockRole} />}
        {page in F && <Crud key={page} title={title(page)} endpoint={'/' + page} fields={F[page]} canEdit={page === 'locations' ? manage : stockRole} />}
      </main>
    </div>
  );
}
