// ============================================================
//  paginaAdmin.js
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado Global
let todosUtilizadores = [];
let todasRotas = [];
let todosPostos = [];
let todasCategorias = [];
let modalTipo = null;
let editandoId = null;

// ============================================================
//  INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  const sessaoValida = await verificarSessaoAdmin();
  if (!sessaoValida) return;

  await carregarCategorias(); // Precisamos das categorias primeiro para os dropdowns
  await Promise.all([
    carregarUtilizadores(),
    carregarRotas(),
    carregarPostos(),
    atualizarEstatisticasDashboard()
  ]);

  document.getElementById('btnSair')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
  });
});

// ============================================================
//  SEGURANÇA
// ============================================================
async function verificarSessaoAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = '/login.html'; return false; }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', session.user.id)
    .single();

  if (error || !profile || profile.role !== 'admin') {
    window.location.href = '/index.html';
    return false;
  }

  // Atualizar sidebar
  const nomeEl = document.querySelector('.user-name');
  const avatarEl = document.querySelector('.user-avatar');
  if (nomeEl) nomeEl.textContent = profile.full_name || 'Admin';
  if (avatarEl && profile.full_name) {
    const p = profile.full_name.split(' ');
    avatarEl.textContent = (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
  }
  return true;
}

// ============================================================
//  NAVEGAÇÃO
// ============================================================
window.showSection = function(secao, elem) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('sec-' + secao)?.classList.add('active');
  if (elem) elem.classList.add('active');
  
  const titulos = { dashboard: 'Painel de Administração', utilizadores: 'Gestão de Utilizadores', rotas: 'Rotas Turísticas', postos: 'Pontos Turísticos e Históricos' };
  document.getElementById('topbarTitle').textContent = titulos[secao] || 'Administração';
};

// ============================================================
//  CATEGORIAS (Gestão Central)
// ============================================================
async function carregarCategorias() {
  const { data, error } = await supabase.from('categorias').select('*').order('nome');
  if (error) { console.error(error); return; }
  todasCategorias = data || [];
  popularFiltrosCategorias();
}

function popularFiltrosCategorias() {
  const rotaFilter = document.getElementById('rotaCatFilter');
  const postoFilter = document.getElementById('postoCatFilter');
  
  [rotaFilter, postoFilter].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '<option value="">Todas as categorias</option>';
    todasCategorias.forEach(c => sel.innerHTML += `<option value="${c.id}">${c.nome}</option>`);
  });
}

window.eliminarCategoria = async function(id, nome) {
  if (!confirm(`Apagar categoria "${nome}"? Isso removerá a associação nas rotas/postos.`)) return;
  await supabase.from('categorias_rotas').delete().eq('categoria_id', id);
  await supabase.from('categorias_locais').delete().eq('categoria_id', id);
  const { error } = await supabase.from('categorias').delete().eq('id', id);
  if (error) { mostrarToast('Erro: ' + error.message, true); return; }
  mostrarToast('Categoria eliminada.');
  await carregarCategorias();
  await Promise.all([carregarRotas(), carregarPostos()]);
};

// ============================================================
//  UTILIZADORES
// ============================================================
async function carregarUtilizadores() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  todosUtilizadores = data || [];
  document.querySelector('.nav-badge').textContent = todosUtilizadores.length;
  filterUsers();
}

function renderizarTabelaUtilizadores(lista) {
  const tabela = document.getElementById('userTable');
  const contador = document.getElementById('userCount');
  if (!tabela) return;
  if (contador) contador.textContent = `${lista.length} registos`;

  if (lista.length === 0) {
    tabela.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px">Nenhum utilizador.</td></tr>`;
    return;
  }

  tabela.innerHTML = lista.map(u => {
    const nome = u.full_name || 'Sem nome';
    const partes = nome.split(' ');
    const iniciais = (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
    const data = u.created_at ? new Date(u.created_at).toLocaleDateString('pt-PT') : '—';
    const statusBadges = { active: 'active', inactive: 'inactive', pending: 'pending' };
    const statusNomes = { active: 'Ativo', inactive: 'Inativo', pending: 'Pendente' };
    const roleBadge = u.role === 'admin' ? 'admin' : 'user';
    const roleNome = u.role === 'admin' ? 'Admin' : 'Utilizador';

    return `
      <tr>
        <td><div class="td-name"><div class="td-avatar green">${iniciais}</div><div><div class="td-main">${nome}</div></div></div></td>
        <td>${u.email || '—'}</td>
        <td><span class="badge ${roleBadge}">${roleNome}</span></td>
        <td><span class="badge ${statusBadges[u.status] || 'pending'}"><span class="badge-dot"></span>${statusNomes[u.status] || 'Pendente'}</span></td>
        <td>${data}</td>
        <td>
          <div class="td-actions">
            <button class="action-btn edit" title="Editar" onclick="editarUtilizador('${u.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="action-btn del" title="Eliminar" onclick="eliminarUtilizador('${u.id}', '${nome.replace(/'/g, "\\'")}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

window.filterUsers = function() {
  const texto = (document.getElementById('userSearch')?.value || '').toLowerCase();
  const role = document.getElementById('userRoleFilter')?.value || '';
  const status = document.getElementById('userStatusFilter')?.value || '';

  const filtrados = todosUtilizadores.filter(u => {
    const nome = (u.full_name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return (!texto || nome.includes(texto) || email.includes(texto)) &&
           (!role || u.role === role) &&
           (!status || u.status === status);
  });
  renderizarTabelaUtilizadores(filtrados);
};

window.editarUtilizador = function(id) {
  const u = todosUtilizadores.find(x => x.id === id);
  if (!u) return;
  editandoId = id;
  openModal('user', u);
};

window.eliminarUtilizador = async function(id, nome) {
  if (!confirm(`Eliminar "${nome}"?`)) return;
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) { mostrarToast('Erro: ' + error.message, true); return; }
  mostrarToast(`"${nome}" eliminado.`);
  await carregarUtilizadores();
};

// ============================================================
//  ROTAS
// ============================================================
async function carregarRotas() {
  const { data, error } = await supabase.from('rotas').select(`*, categorias_rotas ( categoria_id, categorias ( id, nome, cor ) )`).order('criado_em', { ascending: false });
  if (error) { console.error(error); return; }
  todasRotas = data || [];
  document.getElementById('rotaCount').textContent = `${todasRotas.length} rotas`;
  filterRotas();
}

function renderizarRotas(lista) {
  const grid = document.getElementById('routeGrid');
  if (!grid) return;
  if (lista.length === 0) { grid.innerHTML = `<div class="empty"><p>Nenhuma rota encontrada.</p></div>`; return; }

  grid.innerHTML = lista.map(r => {
    const cor = r.cor || '#979d23';
    const catNome = r.categorias_rotas?.[0]?.categorias?.nome || 'Sem Categoria';
    return `
      <div class="route-card">
        <div class="route-img" style="background:linear-gradient(135deg, ${cor}22, ${cor}11)">
          <div class="route-img-icon" style="color:${cor}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></div>
        </div>
        <div class="route-body">
          <div class="route-name">${r.nome}</div>
          <div class="route-meta"><span>${catNome}</span></div>
          <div class="route-footer">
            <span style="font-size:12px; color:#9ca3af">${r.descricao ? r.descricao.substring(0, 30) + '...' : ''}</span>
            <div class="td-actions">
              <button class="action-btn edit" onclick="editarRota(${r.id})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="action-btn del" onclick="eliminarRota(${r.id}, '${r.nome.replace(/'/g, "\\'")}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

window.filterRotas = function() {
  const texto = (document.getElementById('rotaSearch')?.value || '').toLowerCase();
  const catId = document.getElementById('rotaCatFilter')?.value || '';
  
  const filtrados = todasRotas.filter(r => {
    const catRotaId = r.categorias_rotas?.[0]?.categoria_id?.toString() || '';
    return (!texto || r.nome.toLowerCase().includes(texto)) &&
           (!catId || catRotaId === catId);
  });
  renderizarRotas(filtrados);
};

window.editarRota = function(id) {
  const r = todasRotas.find(x => x.id === id);
  if (!r) return;
  editandoId = id;
  const catId = r.categorias_rotas?.[0]?.categorias?.id || '';
  openModal('rota', { ...r, categoria_id: catId });
};

window.eliminarRota = async function(id, nome) {
  if (!confirm(`Eliminar a rota "${nome}"?`)) return;
  await supabase.from('segmentos_rota').delete().eq('rota_id', id);
  await supabase.from('categorias_rotas').delete().eq('rota_id', id);
  const { error } = await supabase.from('rotas').delete().eq('id', id);
  if (error) { mostrarToast('Erro: ' + error.message, true); return; }
  mostrarToast(`Rota eliminada.`);
  await carregarRotas();
};

// ============================================================
//  POSTOS / LOCAIS
// ============================================================
async function carregarPostos() {
  const { data, error } = await supabase.from('locais').select(`*, categorias_locais ( categoria_id, categorias ( id, nome, cor, simbolo ) ), fotos ( url )`).order('criado_em', { ascending: false });
  if (error) { console.error(error); return; }
  todosPostos = data || [];
  document.getElementById('postoCount').textContent = `${todosPostos.length} pontos`;
  filterPostos();
}

function renderizarPostos(lista) {
  const grid = document.getElementById('postoGrid');
  if (!grid) return;
  if (lista.length === 0) { grid.innerHTML = `<div class="empty"><p>Nenhum posto encontrado.</p></div>`; return; }

  grid.innerHTML = lista.map(p => {
    const cat = p.categorias_locais?.[0]?.categorias;
    const catNome = cat?.nome || 'Sem Categoria';
    const cor = cat?.cor || '#979d23';
    return `
      <div class="posto-card">
        <div class="posto-icon" style="background:${cor}22; color:${cor}">${cat?.simbolo || '📍'}</div>
        <div class="posto-info">
          <div class="posto-name">${p.nome}</div>
          <div class="posto-cat">${catNome} · 📍 ${p.latitude}, ${p.longitude}</div>
          <div class="posto-actions">
            <button class="action-btn edit" onclick="editarPosto(${p.id})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="action-btn del" onclick="eliminarPosto(${p.id}, '${p.nome.replace(/'/g, "\\'")}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
          </div>
        </div>
      </div>`;
  }).join('');
}

window.filterPostos = function() {
  const texto = (document.getElementById('postoSearch')?.value || '').toLowerCase();
  const catId = document.getElementById('postoCatFilter')?.value || '';
  
  const filtrados = todosPostos.filter(p => {
    const catLocalId = p.categorias_locais?.[0]?.categoria_id?.toString() || '';
    return (!texto || p.nome.toLowerCase().includes(texto)) &&
           (!catId || catLocalId === catId);
  });
  renderizarPostos(filtrados);
};

window.editarPosto = function(id) {
  const p = todosPostos.find(x => x.id === id);
  if (!p) return;
  editandoId = id;
  const catId = p.categorias_locais?.[0]?.categorias?.id || '';
  const fotoUrl = p.fotos?.[0]?.url || '';
  openModal('posto', { ...p, categoria_id: catId, foto_url: fotoUrl });
};

window.eliminarPosto = async function(id, nome) {
  if (!confirm(`Eliminar o ponto "${nome}"?`)) return;
  await supabase.from('fotos').delete().eq('locais_id', id);
  await supabase.from('categorias_locais').delete().eq('local_id', id);
  await supabase.from('segmentos_rota').delete().or(`local_origem_id.eq.${id},local_destino_id.eq.${id}`);
  const { error } = await supabase.from('locais').delete().eq('id', id);
  if (error) { mostrarToast('Erro: ' + error.message, true); return; }
  mostrarToast(`Ponto eliminado.`);
  await carregarPostos();
};

// ============================================================
//  DASHBOARD STATS
// ============================================================
async function atualizarEstatisticasDashboard() {
  const { count: uC } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { count: rC } = await supabase.from('rotas').select('*', { count: 'exact', head: true });
  const { count: pC } = await supabase.from('locais').select('*', { count: 'exact', head: true });
  
  document.getElementById('statUsers').textContent = uC ?? 0;
  document.getElementById('statRotas').textContent = rC ?? 0;
  document.getElementById('statPostos').textContent = pC ?? 0;
  document.getElementById('statCats').textContent = todasCategorias.length;
  document.querySelector('.nav-badge').textContent = uC ?? 0;

  const { data: ultimos } = await supabase.from('profiles').select('full_name, email, created_at, status').order('created_at', { ascending: false }).limit(5);
  const tbody = document.getElementById('dashLastUsers');
  if (tbody && ultimos) {
    const statusBadges = { active: 'active', inactive: 'inactive', pending: 'pending' };
    const statusNomes = { active: 'Ativo', inactive: 'Inativo', pending: 'Pendente' };
    tbody.innerHTML = ultimos.map(u => {
      const nome = u.full_name || 'Sem nome';
      const data = u.created_at ? new Date(u.created_at).toLocaleDateString('pt-PT') : '—';
      return `<tr><td>${nome}</td><td>${u.email || '—'}</td><td>${data}</td><td><span class="badge ${statusBadges[u.status]||'pending'}"><span class="badge-dot"></span>${statusNomes[u.status]||'Pendente'}</span></td></tr>`;
    }).join('');
  }
}

// ============================================================
//  MODAL
// ============================================================
window.openModal = function(tipo, dadosEditar = null) {
  modalTipo = tipo;
  const overlay = document.getElementById('modalOverlay');
  const titulo = document.getElementById('modalTitle');
  const corpo = document.getElementById('modalBody');
  const footer = document.getElementById('modalFooter');
  if (!overlay) return;

  const catOptions = todasCategorias.map(c => `<option value="${c.id}" ${dadosEditar?.categoria_id === c.id ? 'selected' : ''}>${c.nome}</option>`).join('');
  const isEditing = !!dadosEditar;

  if (tipo === 'user') {
    titulo.textContent = isEditing ? 'Editar Utilizador' : 'Novo Utilizador';
    corpo.innerHTML = `
      <div class="modal-form-group"><label class="modal-label">Nome completo</label><input class="modal-input" id="m-nome" type="text" value="${dadosEditar?.full_name || ''}"></div>
      <div class="modal-form-group"><label class="modal-label">Email</label><input class="modal-input" id="m-email" type="email" value="${dadosEditar?.email || ''}" readonly style="background:#f3f4f6"></div>
      <div class="modal-row">
        <div class="modal-form-group"><label class="modal-label">Perfil</label><select class="modal-select" id="m-role"><option value="user" ${dadosEditar?.role === 'user' ? 'selected' : ''}>Utilizador</option><option value="admin" ${dadosEditar?.role === 'admin' ? 'selected' : ''}>Administrador</option></select></div>
        <div class="modal-form-group"><label class="modal-label">Estado</label><select class="modal-select" id="m-status"><option value="active" ${dadosEditar?.status === 'active' ? 'selected' : ''}>Ativo</option><option value="inactive" ${dadosEditar?.status === 'inactive' ? 'selected' : ''}>Inativo</option><option value="pending" ${dadosEditar?.status === 'pending' ? 'selected' : ''}>Pendente</option></select></div>
      </div>`;
    footer.style.display = isEditing ? 'flex' : 'none'; // Só editamos, criar tem de ser pelo registro
  } 
  else if (tipo === 'rota') {
    titulo.textContent = isEditing ? 'Editar Rota' : 'Nova Rota';
    corpo.innerHTML = `
      <div class="modal-form-group"><label class="modal-label">Nome da Rota</label><input class="modal-input" id="m-nome" type="text" value="${dadosEditar?.nome || ''}"></div>
      <div class="modal-form-group"><label class="modal-label">Descrição</label><textarea class="modal-textarea" id="m-descricao">${dadosEditar?.descricao || ''}</textarea></div>
      <div class="modal-row">
        <div class="modal-form-group"><label class="modal-label">Categoria</label><select class="modal-select" id="m-categoria"><option value="">Sem categoria</option>${catOptions}</select></div>
        <div class="modal-form-group"><label class="modal-label">Cor</label><input class="modal-input" id="m-cor" type="color" value="${dadosEditar?.cor || '#979d23'}" style="padding:4px; height:42px;"></div>
      </div>`;
    footer.style.display = 'flex';
  } 
  else if (tipo === 'posto') {
    titulo.textContent = isEditing ? 'Editar Ponto' : 'Novo Ponto';
    corpo.innerHTML = `
      <div class="modal-form-group"><label class="modal-label">Nome do Ponto</label><input class="modal-input" id="m-nome" type="text" value="${dadosEditar?.nome || ''}"></div>
      <div class="modal-form-group"><label class="modal-label">Descrição</label><textarea class="modal-textarea" id="m-descricao">${dadosEditar?.descricao || ''}</textarea></div>
      <div class="modal-form-group"><label class="modal-label">Categoria</label><select class="modal-select" id="m-categoria"><option value="">Sem categoria</option>${catOptions}</select></div>
      <div class="modal-row">
        <div class="modal-form-group"><label class="modal-label">Latitude</label><input class="modal-input" id="m-lat" type="number" step="0.0001" value="${dadosEditar?.latitude || ''}"></div>
        <div class="modal-form-group"><label class="modal-label">Longitude</label><input class="modal-input" id="m-lng" type="number" step="0.0001" value="${dadosEditar?.longitude || ''}"></div>
      </div>
      <div class="modal-form-group"><label class="modal-label">URL da Foto</label><input class="modal-input" id="m-foto" type="url" value="${dadosEditar?.foto_url || ''}"></div>`;
    footer.style.display = 'flex';
  }
  else if (tipo === 'categoria') {
    titulo.textContent = 'Gerir Categorias';
    corpo.innerHTML = `
      <div class="modal-form-group" style="display:flex; gap:10px; align-items:flex-end;">
        <div style="flex:1"><label class="modal-label">Nova Categoria</label><input class="modal-input" id="m-nova-cat" type="text" placeholder="Nome..."></div>
        <input class="modal-input" id="m-cor-cat" type="color" value="#979d23" style="width:50px; height:42px; padding:4px;">
        <button class="btn-primary" onclick="salvarNovaCategoria()" style="height:42px">Adicionar</button>
      </div>
      <div style="max-height:300px; overflow-y:auto; margin-top:20px; border-top:1px solid var(--border);">
        ${todasCategorias.map(c => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border)">
            <div style="display:flex; align-items:center; gap:10px"><span style="width:12px; height:12px; border-radius:50%; background:${c.cor||'#ccc'}; display:inline-block"></span> ${c.nome}</div>
            <button class="action-btn del" onclick="eliminarCategoria(${c.id}, '${c.nome.replace(/'/g, "\\'")}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
        `).join('')}
      </div>`;
    footer.style.display = 'none'; // Não precisa do botão guardar principal
  }

  overlay.classList.add('show');
};

window.closeModal = function() {
  document.getElementById('modalOverlay')?.classList.remove('show');
  editandoId = null;
  modalTipo = null;
};

window.closeModalOutside = function(e) {
  if (e.target.id === 'modalOverlay') closeModal();
};

window.salvarNovaCategoria = async function() {
  const nome = document.getElementById('m-nova-cat')?.value.trim();
  const cor = document.getElementById('m-cor-cat')?.value;
  if (!nome) { mostrarToast('Indica o nome.', true); return; }
  const { error } = await supabase.from('categorias').insert([{ nome, cor }]);
  if (error) { mostrarToast('Erro: ' + error.message, true); return; }
  mostrarToast('Categoria adicionada!');
  await carregarCategorias();
  openModal('categoria'); // Refresca o modal
};

window.saveModal = async function() {
  if (!modalTipo) return;

  if (modalTipo === 'user') {
    const nome = document.getElementById('m-nome')?.value.trim();
    const role = document.getElementById('m-role')?.value;
    const status = document.getElementById('m-status')?.value;
    if (!nome) { mostrarToast('Nome obrigatório.', true); return; }
    const { error } = await supabase.from('profiles').update({ full_name: nome, role, status }).eq('id', editandoId);
    if (error) { mostrarToast('Erro: ' + error.message, true); return; }
    mostrarToast('Utilizador atualizado.');
    closeModal();
    await carregarUtilizadores();
  } 
  else if (modalTipo === 'rota') {
    const nome = document.getElementById('m-nome')?.value.trim();
    const descricao = document.getElementById('m-descricao')?.value.trim();
    const cor = document.getElementById('m-cor')?.value;
    const categoria_id = document.getElementById('m-categoria')?.value;
    if (!nome) { mostrarToast('Nome obrigatório.', true); return; }

    let rotaId = editandoId;
    if (editandoId) {
      await supabase.from('rotas').update({ nome, descricao, cor }).eq('id', editandoId);
      await supabase.from('categorias_rotas').delete().eq('rota_id', editandoId);
    } else {
      const { data, error } = await supabase.from('rotas').insert([{ nome, descricao, cor }]).select().single();
      if (error) { mostrarToast('Erro: ' + error.message, true); return; }
      rotaId = data.id;
    }
    if (categoria_id && rotaId) await supabase.from('categorias_rotas').insert([{ rota_id: rotaId, categoria_id: categoria_id }]);
    mostrarToast(editandoId ? 'Rota atualizada.' : 'Rota criada.');
    closeModal();
    await carregarRotas();
  } 
  else if (modalTipo === 'posto') {
    const nome = document.getElementById('m-nome')?.value.trim();
    const descricao = document.getElementById('m-descricao')?.value.trim();
    const lat = parseFloat(document.getElementById('m-lat')?.value);
    const lng = parseFloat(document.getElementById('m-lng')?.value);
    const foto = document.getElementById('m-foto')?.value.trim();
    const categoria_id = document.getElementById('m-categoria')?.value;
    if (!nome || isNaN(lat) || isNaN(lng)) { mostrarToast('Nome, Lat e Lng obrigatórios.', true); return; }

    let localId = editandoId;
    if (editandoId) {
      await supabase.from('locais').update({ nome, descricao, latitude: lat, longitude: lng }).eq('id', editandoId);
      await supabase.from('categorias_locais').delete().eq('local_id', editandoId);
      const { data: fExist } = await supabase.from('fotos').select('id').eq('locais_id', editandoId).limit(1);
      if (fExist && fExist.length > 0) {
        if (foto) await supabase.from('fotos').update({ url: foto }).eq('id', fExist[0].id);
        else await supabase.from('fotos').delete().eq('id', fExist[0].id);
      } else if (foto) {
        await supabase.from('fotos').insert([{ locais_id: editandoId, url: foto }]);
      }
    } else {
      const { data, error } = await supabase.from('locais').insert([{ nome, descricao, latitude: lat, longitude: lng }]).select().single();
      if (error) { mostrarToast('Erro: ' + error.message, true); return; }
      localId = data.id;
      if (foto) await supabase.from('fotos').insert([{ locais_id: localId, url: foto }]);
    }
    if (categoria_id && localId) await supabase.from('categorias_locais').insert([{ local_id: localId, categoria_id: categoria_id }]);
    mostrarToast(editandoId ? 'Ponto atualizado.' : 'Ponto criado.');
    closeModal();
    await carregarPostos();
  }
};

// ============================================================
//  TOAST
// ============================================================
function mostrarToast(msg, erro = false) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const dot = document.querySelector('.toast-dot');
  if (!toast) return;
  if (toastMsg) toastMsg.textContent = msg;
  if (dot) dot.style.background = erro ? '#ef4444' : '#22c55e';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
