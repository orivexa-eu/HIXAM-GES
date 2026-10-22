const KEY = 'hixam_token';
export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export async function api<T = any>(path: string, method = 'GET', body?: any): Promise<T> {
  const r = await fetch('/api' + path, {
    method,
    headers: { 'content-type': 'application/json', ...(getToken() ? { authorization: 'Bearer ' + getToken() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && path !== '/auth/login') {
    setToken(null);
    location.reload();
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Erreur ' + r.status);
  return data;
}
