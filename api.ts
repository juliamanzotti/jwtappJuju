export type User = { id: number; name: string; username: string; email: string; isAdmin: boolean; active: boolean };
export type Page<T> = { data: T[]; total: number; page: number; pages: number };
const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;
export function currentUser(): User | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(sessionStorage.getItem('biblioteca_user') || 'null'); } catch { return null; }
}
function save(token: string, user: User) {
  accessToken = token;
  sessionStorage.setItem('biblioteca_access', token);
  sessionStorage.setItem('biblioteca_user', JSON.stringify(user));
}
export function clearSession() {
  accessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('biblioteca_access');
    sessionStorage.removeItem('biblioteca_user');
  }
}
async function parse(response: Response) {
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Erro na requisição.');
  return data;
}
export async function login(email: string, password: string) {
  const response = await fetch(base + '/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const data = await parse(response);
  save(data.accessToken, data.user);
  return data.user as User;
}
async function refresh() {
  if (!refreshPromise) {
    refreshPromise = fetch(base + '/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(parse)
      .then(data => { save(data.accessToken, data.user); return data.accessToken as string; })
      .catch(error => { clearSession(); throw error; })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}
export async function ensureSession() {
  if (typeof window === 'undefined') return null;
  if (!accessToken) accessToken = sessionStorage.getItem('biblioteca_access');
  if (!accessToken) await refresh();
  return currentUser();
}
export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  if (!accessToken && typeof window !== 'undefined') accessToken = sessionStorage.getItem('biblioteca_access');
  const send = (token: string | null) => fetch(base + path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers }
  });
  let response = await send(accessToken);
  if (response.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
    try { response = await send(await refresh()); }
    catch { if (typeof window !== 'undefined') window.dispatchEvent(new Event('biblioteca:expired')); throw new Error('Sessão expirada.'); }
  }
  return parse(response) as Promise<T>;
}
export async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } finally { clearSession(); }
}
