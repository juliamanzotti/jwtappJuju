'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ensureSession, logout, Page, User } from '@/lib/api';

type Item = Record<string, unknown> & { id: number };
type Tab = 'dashboard' | 'books' | 'categories' | 'authors' | 'readers' | 'loans' | 'reservations' | 'user';
const names: Record<Tab, string> = { dashboard: 'Visão geral', books: 'Livros', categories: 'Categorias', authors: 'Autores', readers: 'Leitores', loans: 'Empréstimos', reservations: 'Reservas', user: 'Atendentes' };
const routes: Partial<Record<Tab, string>> = { books: '/books', categories: '/categories', authors: '/authors', readers: '/readers', loans: '/loans', reservations: '/reservations', user: '/user' };
const fields: Partial<Record<Tab, { key: string; label: string; type?: string; required?: boolean }[]>> = {
  categories: [{ key: 'name', label: 'Nome', required: true }, { key: 'description', label: 'Descrição' }],
  authors: [{ key: 'name', label: 'Nome', required: true }, { key: 'nationality', label: 'Nacionalidade' }, { key: 'birthDate', label: 'Nascimento', type: 'date' }],
  books: [{ key: 'title', label: 'Título', required: true }, { key: 'isbn', label: 'ISBN', required: true }, { key: 'year', label: 'Ano', type: 'number' }, { key: 'totalCopies', label: 'Exemplares', type: 'number', required: true }],
  readers: [{ key: 'name', label: 'Nome', required: true }, { key: 'cpf', label: 'CPF (11 dígitos)', required: true }, { key: 'email', label: 'E-mail', type: 'email' }, { key: 'phone', label: 'Telefone' }],
  user: [{ key: 'name', label: 'Nome', required: true }, { key: 'username', label: 'Usuário', required: true }, { key: 'email', label: 'E-mail', type: 'email', required: true }, { key: 'password', label: 'Senha', type: 'password' }]
};
function label(item: Item) { return String(item.title || item.name || item.email || '#' + item.id); }
function date(value: unknown) { return value ? new Date(String(value)).toLocaleDateString('pt-BR') : '—'; }
function money(value: unknown) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [available, setAvailable] = useState(false);
  const [categories, setCategories] = useState<Item[]>([]);
  const [authors, setAuthors] = useState<Item[]>([]);
  const [books, setBooks] = useState<Item[]>([]);
  const [readers, setReaders] = useState<Item[]>([]);
  const [dashboard, setDashboard] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<Record<string, string | string[]>>({});
  const [showForm, setShowForm] = useState(false);
  const [history, setHistory] = useState<Item[] | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadOptions = useCallback(async () => {
    const [cats, auts, bks, rds] = await Promise.all([
      api<Page<Item>>('/categories?limit=100'), api<Page<Item>>('/authors?limit=100'),
      api<Page<Item>>('/books?limit=100'), api<Page<Item>>('/readers?limit=100')
    ]);
    setCategories(cats.data); setAuthors(auts.data); setBooks(bks.data); setReaders(rds.data);
  }, []);
  const load = useCallback(async () => {
    if (tab === 'dashboard') {
      if (user?.isAdmin) setDashboard(await api<Record<string, number>>('/reports/dashboard'));
      return;
    }
    const params = new URLSearchParams({ page: String(page), limit: '10' });
    if (search && !['loans', 'reservations', 'user'].includes(tab)) params.set(tab === 'books' ? 'title' : 'search', search);
    if (tab === 'books') { if (categoryFilter) params.set('categoryId', categoryFilter); if (authorFilter) params.set('authorId', authorFilter); if (available) params.set('available', 'true'); }
    if (tab === 'loans' && status) params.set('status', status);
    const result = await api<Page<Item>>(routes[tab] + '?' + params);
    setItems(result.data); setPages(result.pages || 1);
  }, [tab, page, search, status, categoryFilter, authorFilter, available, user]);
  useEffect(() => {
    ensureSession().then(value => { if (!value) router.replace('/'); else { setUser(value); loadOptions().catch(() => {}); } }).catch(() => router.replace('/'));
  }, [router, loadOptions]);
  useEffect(() => {
    const handler = () => router.replace('/');
    window.addEventListener('biblioteca:expired', handler);
    return () => window.removeEventListener('biblioteca:expired', handler);
  }, [router]);
  useEffect(() => { if (user) Promise.resolve().then(load).catch(reason => setError(reason.message)); }, [load, user]);
  function selectTab(next: Tab) { setTab(next); setPage(1); setSearch(''); setStatus(''); setError(''); setMessage(''); setShowForm(false); }
  async function reload() { await load(); await loadOptions(); }
  function openForm(item?: Item) {
    setEditing(item || null);
    const initial: Record<string, string | string[]> = {};
    for (const field of fields[tab] || []) initial[field.key] = item?.[field.key] == null ? '' : String(item[field.key]);
    if (tab === 'books') {
      initial.categoryId = String(item?.categoryId || '');
      initial.authorIds = ((item?.Authors || []) as Item[]).map(author => String(author.id));
    }
    setForm(initial); setShowForm(true); setError('');
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const body: Record<string, unknown> = { ...form };
      for (const [key, value] of Object.entries(body)) if (value === '') delete body[key];
      if (tab === 'books') {
        body.year = form.year ? Number(form.year) : null;
        body.totalCopies = Number(form.totalCopies);
        body.categoryId = Number(form.categoryId);
        body.authorIds = (form.authorIds as string[] || []).map(Number);
      }
      if (tab === 'user' && editing && !body.password) delete body.password;
      const path = routes[tab] + (editing ? '/' + editing.id : '');
      await api(path, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setShowForm(false); setMessage(editing ? 'Registro atualizado.' : 'Registro cadastrado.'); await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao salvar.'); }
    finally { setBusy(false); }
  }
  async function remove(item: Item) {
    if (!window.confirm('Excluir ' + label(item) + '?')) return;
    try { await api(routes[tab] + '/' + item.id, { method: 'DELETE' }); setMessage('Registro excluído.'); await reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao excluir.'); }
  }
  async function toggleActive(item: Item) {
    try { await api('/user/' + item.id + '/active', { method: 'PATCH', body: JSON.stringify({ active: !item.active }) }); await reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao alterar atendente.'); }
  }
  async function showHistory(item: Item) {
    try { const result = await api<Page<Item>>('/readers/' + item.id + '/loans'); setHistory(result.data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao abrir histórico.'); }
  }
  async function createLoan(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/loans', { method: 'POST', body: JSON.stringify({ bookId: Number(form.bookId), readerId: Number(form.readerId) }) }); setShowForm(false); setMessage('Empréstimo registrado.'); await reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro no empréstimo.'); }
    finally { setBusy(false); }
  }
  async function returnBook(item: Item) {
    try { const result = await api<Item>('/loans/' + item.id + '/return', { method: 'PATCH' }); setMessage('Devolução registrada. Multa: ' + money(result.fine)); await reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro na devolução.'); }
  }
  async function reserve(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/reservations', { method: 'POST', body: JSON.stringify({ bookId: Number(form.bookId), readerId: Number(form.readerId) }) }); setShowForm(false); setMessage('Reserva incluída na fila.'); await reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro na reserva.'); }
    finally { setBusy(false); }
  }
  async function cancelReservation(item: Item) {
    try { await api('/reservations/' + item.id + '/cancel', { method: 'PATCH' }); await reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao cancelar reserva.'); }
  }
  if (!user) return <main className="loading">Carregando sua sessão...</main>;
  const adminTabs: Tab[] = ['dashboard', 'books', 'categories', 'authors', 'readers', 'loans', 'reservations', 'user'];
  const staffTabs: Tab[] = ['books', 'readers', 'loans', 'reservations'];
  return <div className="shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">B</span><span>Biblioteca<span className="brand-sub">Acadêmica</span></span></div><nav>{(user.isAdmin ? adminTabs : staffTabs).map(key => <button key={key} className={tab === key ? 'nav active' : 'nav'} onClick={() => selectTab(key)}>{names[key]}</button>)}</nav><div className="sidebar-foot">Sistema de gestão<br />de biblioteca</div></aside><div className="main"><header className="topbar"><div><span className="eyebrow">Painel de gestão</span><h1>{names[tab]}</h1></div><div className="account"><span><strong>{user.name}</strong><small>{user.isAdmin ? 'Administrador' : 'Atendente'}</small></span><button className="ghost" onClick={async () => { await logout(); router.replace('/'); }}>Sair</button></div></header><main className="content">{message && <div className="notice">{message}</div>}{error && <div className="alert">{error}</div>}
    {tab === 'dashboard' && <><p className="muted">Acompanhe os dados principais da biblioteca.</p><div className="cards">{[['books','Livros no acervo'],['activeLoans','Empréstimos ativos'],['overdueLoans','Em atraso'],['fines','Multas registradas']].map(([key, title]) => <div className="card" key={key}><span>{title}</span><strong>{key === 'fines' ? money(dashboard[key]) : dashboard[key] ?? 0}</strong></div>)}</div><div className="panel"><h2>Atalhos</h2><div className="actions"><button onClick={() => selectTab('books')}>Consultar livros</button><button onClick={() => selectTab('loans')}>Gerenciar empréstimos</button><button onClick={() => selectTab('readers')}>Ver leitores</button></div></div></>}
    {tab !== 'dashboard' && <div className="panel"><div className="panel-head"><div><h2>{names[tab]}</h2><p className="muted">Consulte e gerencie os registros.</p></div>{((user.isAdmin && ['books','categories','authors','user'].includes(tab)) || ['readers','loans','reservations'].includes(tab)) && <button className="primary" onClick={() => { if (tab === 'loans' || tab === 'reservations') { setForm({ bookId: '', readerId: '' }); setShowForm(true); } else openForm(); }}>{tab === 'loans' ? 'Novo empréstimo' : tab === 'reservations' ? 'Nova reserva' : 'Novo cadastro'}</button>}</div><div className="filters">{!['loans','reservations','user'].includes(tab) && <input placeholder="Buscar..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />}{tab === 'books' && <><select value={categoryFilter} onChange={event => { setCategoryFilter(event.target.value); setPage(1); }}><option value="">Todas as categorias</option>{categories.map(item => <option key={item.id} value={item.id}>{label(item)}</option>)}</select><select value={authorFilter} onChange={event => { setAuthorFilter(event.target.value); setPage(1); }}><option value="">Todos os autores</option>{authors.map(item => <option key={item.id} value={item.id}>{label(item)}</option>)}</select><label className="check"><input type="checkbox" checked={available} onChange={event => setAvailable(event.target.checked)} /> Disponíveis</label></>}{tab === 'loans' && <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Todos os status</option><option>ATIVO</option><option>ATRASADO</option><option>DEVOLVIDO</option></select>}</div><div className="table-wrap"><table><thead><tr><th>Registro</th><th>Detalhes</th><th>Status</th><th>Ações</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{tab === 'loans' || tab === 'reservations' ? label((item.Book || {}) as Item) : label(item)}</strong><small>#{item.id}</small></td><td>{tab === 'books' ? <>{String((item.Category as Item)?.name || '')}<small>{String(item.isbn || '')} · {String(item.availableCopies)} de {String(item.totalCopies)} disponíveis</small></> : tab === 'loans' || tab === 'reservations' ? <>{label((item.Reader || {}) as Item)}<small>{tab === 'loans' ? 'Prazo: ' + date(item.dueDate) : 'Pedido: ' + date(item.createdAt)}</small></> : tab === 'readers' ? String(item.cpf || '') : tab === 'user' ? String(item.email || '') : tab === 'authors' ? String(item.nationality || '') : String(item.description || '')}</td><td>{tab === 'loans' ? <span className="badge">{String(item.status)}</span> : tab === 'reservations' ? <span className="badge">{String(item.status)}</span> : tab === 'user' ? <span className="badge">{item.active ? 'Ativo' : 'Inativo'}</span> : tab === 'books' ? <span className="badge">{Number(item.availableCopies) > 0 ? 'Disponível' : 'Sem exemplares'}</span> : '—'}</td><td><div className="row-actions">{tab === 'loans' ? !item.returnDate && <button onClick={() => returnBook(item)}>Devolver</button> : tab === 'reservations' ? ['PENDENTE','PRONTA'].includes(String(item.status)) && <button onClick={() => cancelReservation(item)}>Cancelar</button> : <>{tab === 'readers' && <button onClick={() => showHistory(item)}>Histórico</button>}{tab === 'user' && <button onClick={() => toggleActive(item)}>{item.active ? 'Desativar' : 'Ativar'}</button>}{(user.isAdmin || tab === 'readers') && <button onClick={() => openForm(item)}>Editar</button>}{user.isAdmin && ['books','categories','authors'].includes(tab) && <button onClick={() => remove(item)}>Excluir</button>}</>}</div></td></tr>)}</tbody></table>{items.length === 0 && <div className="empty">Nenhum registro encontrado.</div>}</div><div className="pager"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page} de {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</button></div></div>}
  </main></div>{showForm && <div className="overlay"><div className="modal"><div className="modal-head"><h2>{editing ? 'Editar ' : 'Cadastrar '}{names[tab].toLowerCase()}</h2><button onClick={() => setShowForm(false)}>Fechar</button></div><form onSubmit={tab === 'loans' ? createLoan : tab === 'reservations' ? reserve : save}>{tab === 'loans' || tab === 'reservations' ? <><label>Livro<select required value={form.bookId || ''} onChange={event => setForm({ ...form, bookId: event.target.value })}><option value="">Selecione</option>{books.filter(book => tab === 'reservations' ? Number(book.availableCopies) === 0 : Number(book.availableCopies) > 0).map(book => <option key={book.id} value={book.id}>{label(book)}</option>)}</select></label><label>Leitor<select required value={form.readerId || ''} onChange={event => setForm({ ...form, readerId: event.target.value })}><option value="">Selecione</option>{readers.map(reader => <option key={reader.id} value={reader.id}>{label(reader)}</option>)}</select></label></> : <>{(fields[tab] || []).map(field => <label key={field.key}>{field.label}<input type={field.type || 'text'} required={field.required && !(tab === 'user' && !!editing)} value={String(form[field.key] || '')} onChange={event => setForm({ ...form, [field.key]: event.target.value })} /></label>)}{tab === 'books' && <><label>Categoria<select required value={form.categoryId || ''} onChange={event => setForm({ ...form, categoryId: event.target.value })}><option value="">Selecione</option>{categories.map(item => <option key={item.id} value={item.id}>{label(item)}</option>)}</select></label><label>Autores<select multiple required value={form.authorIds as string[] || []} onChange={event => setForm({ ...form, authorIds: Array.from(event.target.selectedOptions).map(option => option.value) })}>{authors.map(item => <option key={item.id} value={item.id}>{label(item)}</option>)}</select><small>Use Ctrl para selecionar vários autores.</small></label></>}</>}{error && <p className="alert">{error}</p>}<div className="actions"><button type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button></div></form></div></div>}{history && <div className="overlay"><div className="modal"><div className="modal-head"><h2>Histórico de empréstimos</h2><button onClick={() => setHistory(null)}>Fechar</button></div>{history.length ? history.map(item => <p key={item.id}>{label((item.Book || {}) as Item)} · {date(item.loanDate)} · {item.returnDate ? 'Devolvido' : 'Em aberto'}</p>) : <p>Nenhum empréstimo.</p>}</div></div>}</div>;
}
