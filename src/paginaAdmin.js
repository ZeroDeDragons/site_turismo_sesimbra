// ============================================================
//  paginaAdmin.js
//  JavaScript da página de Administração do Castelo Sesimbra
//  Ligado ao Supabase para dados reais de utilizadores, rotas e postos
// ============================================================

// --- IMPORTAR O CLIENTE SUPABASE ---
// "import" traz código de outro ficheiro para este.
// Vamos usar o supabase para ler/escrever na base de dados.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Estas variáveis ficam em branco aqui porque o Vite vai ler
// o ficheiro .env automaticamente durante o build/dev.
// Em produção substituí VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
// pelas tuas credenciais Supabase (Settings → API).
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Criar o cliente Supabase — é o "cartão de acesso" à base de dados.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ============================================================
//  VARIÁVEIS GLOBAIS
//  São declaradas aqui fora das funções para ficarem
//  acessíveis a toda a lógica do ficheiro.
// ============================================================

// Guarda todos os utilizadores carregados do Supabase
let todosUtilizadores = [];

// Guarda qual o tipo de modal que está aberto ('user', 'rota', 'posto')
let modalTipo = null;

// Guarda o ID do registo que estamos a editar (null = é um novo)
let editandoId = null;


// ============================================================
//  1. INICIALIZAÇÃO — corre assim que a página termina de carregar
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {

  // Verificar se existe sessão de admin ativa.
  // Se não existir, reencaminhar para o login.
  await verificarSessaoAdmin();

  // Carregar dados do Supabase para preencher as secções
  await carregarUtilizadores();
  await carregarRotas();
  await carregarPostos();
  await atualizarEstatisticasDashboard();

  // Configurar o botão de sair (ícone de logout na topbar)
  const btnSair = document.querySelector('.btn-icon[title="Sair"]');
  if (btnSair) {
    btnSair.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = '/login.html';
    });
  }
});


// ============================================================
//  2. SEGURANÇA — verificar se o utilizador é mesmo admin
// ============================================================
async function verificarSessaoAdmin() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = '/login.html';
    return;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', session.user.id)
    .single();

  // ⬇️ Agora verificamos o erro ANTES de decidir o redirecionamento
  if (error) {
    console.error('Erro ao buscar perfil:', error.message);
    console.error('Código do erro:', error.code);
    // Se o erro for PGRST116 = nenhuma linha encontrada (RLS bloqueou)
    if (error.code === 'PGRST116') {
      console.error('RLS está a bloquear o acesso ao perfil!');
    }
    window.location.href = '/index.html';
    return;
  }

  if (!profile || profile.role !== 'admin') {
    console.log('Redirecionando porque role é:', profile?.role);
    window.location.href = '/index.html';
    return;
  }

  // Remover o bloco duplicado que existia aqui ↑

  // Atualizar o nome do admin na sidebar
  const nomeEl = document.querySelector('.user-name');
  const iniciais = document.querySelector('.user-avatar');
  if (nomeEl && profile.full_name) {
    nomeEl.textContent = profile.full_name;
    const partes = profile.full_name.split(' ');
    if (iniciais) {
      iniciais.textContent = (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
    }
  }
}


// ============================================================
//  3. NAVEGAÇÃO ENTRE SECÇÕES DA SIDEBAR
// ============================================================

// Esta função é chamada pelos onclick nos itens da sidebar (ex: onclick="showSection('utilizadores',this)")
// 'secao'  = string com o nome da secção a mostrar (ex: 'utilizadores')
// 'elem'   = o elemento <a> que foi clicado
window.showSection = function(secao, elem) {
  // Esconder todas as secções (remover a classe 'active')
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

  // Remover o destaque de todos os itens da sidebar
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Mostrar só a secção pedida
  const alvo = document.getElementById('sec-' + secao);
  if (alvo) alvo.classList.add('active');

  // Destacar o item clicado na sidebar
  if (elem) elem.classList.add('active');

  // Atualizar o título na topbar
  const titulos = {
    dashboard:    'Painel de Administração',
    utilizadores: 'Gestão de Utilizadores',
    rotas:        'Rotas Turísticas',
    postos:       'Pontos Turísticos e Históricos'
  };
  const topbar = document.getElementById('topbarTitle');
  if (topbar) topbar.textContent = titulos[secao] || 'Administração';
};


// ============================================================
//  4. UTILIZADORES — ler da base de dados e mostrar na tabela
// ============================================================
async function carregarUtilizadores() {
  // Buscar todos os perfis da tabela 'profiles'
  // ordenados do mais recente para o mais antigo
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar utilizadores:', error.message);
    return;
  }

  // Guardar na variável global para os filtros funcionarem
  todosUtilizadores = data || [];

  // Atualizar o badge da sidebar com o número real de utilizadores
  const badge = document.querySelector('.nav-badge');
  if (badge) badge.textContent = todosUtilizadores.length;

  // Renderizar a tabela
  renderizarTabelaUtilizadores(todosUtilizadores);
}

// Renderizar (desenhar) as linhas da tabela de utilizadores
function renderizarTabelaUtilizadores(lista) {
  const tabela = document.getElementById('userTable');
  const contador = document.getElementById('userCount');
  const rodape = document.getElementById('userFooterText');

  if (!tabela) return;

  // Se não há utilizadores, mostrar mensagem
  if (!lista || lista.length === 0) {
    tabela.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--mid);padding:24px">Nenhum utilizador encontrado.</td></tr>`;
    if (contador) contador.textContent = '0 registos';
    return;
  }

  if (contador) contador.textContent = `${lista.length} registos`;
  if (rodape) rodape.textContent = `A mostrar 1–${lista.length} de ${lista.length}`;

  // Construir o HTML de cada linha da tabela
  // .map() percorre cada utilizador e devolve uma string HTML
  tabela.innerHTML = lista.map(u => {
    // Gerar as iniciais do nome (ex: "Maria Costa" → "MC")
    const nome = u.full_name || u.email || 'Sem nome';
    const partes = nome.split(' ');
    const iniciais = (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();

    // Escolher a cor do avatar com base no primeiro carácter do nome
    const cores = ['green', 'orange', '', 'blue'];
    const corIdx = nome.charCodeAt(0) % cores.length;
    const corClasse = cores[corIdx];

    // Formatar a data de criação (ex: "2026-01-15T10:30:00Z" → "15/01/2026")
    const data = u.created_at
      ? new Date(u.created_at).toLocaleDateString('pt-PT')
      : '—';

    // Badge de estado (ativo, inativo, pendente)
    const estadoBadge = {
      active:   `<span class="badge active"><span class="badge-dot"></span>Ativo</span>`,
      inactive: `<span class="badge inactive"><span class="badge-dot"></span>Inativo</span>`,
      pending:  `<span class="badge pending"><span class="badge-dot"></span>Pendente</span>`
    };
    const estado = estadoBadge[u.status] || estadoBadge.pending;

    // Badge de role (admin ou utilizador normal)
    const roleBadge = u.role === 'admin'
      ? `<span class="badge active">Admin</span>`
      : `<span class="badge inactive">Utilizador</span>`;

    return `
      <tr>
        <td>
          <div class="td-name">
            <div class="td-avatar ${corClasse}">${iniciais}</div>
            <div><div class="td-main">${nome}</div></div>
          </div>
        </td>
        <td>${u.email || '—'}</td>
        <td>${roleBadge}</td>
        <td>${u.interest || '—'}</td>
        <td>${estado}</td>
        <td>${data}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn-icon" title="Editar" onclick="editarUtilizador('${u.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon" title="Eliminar" onclick="eliminarUtilizador('${u.id}', '${nome.replace(/'/g, "\\'")}')" style="color:#ef4444">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join(''); // .join('') junta todas as strings num só bloco de HTML
}

// Filtrar utilizadores com base na pesquisa e nos selects de role/estado
window.filterUsers = function() {
  const texto   = (document.getElementById('userSearch')?.value || '').toLowerCase();
  const role    = document.getElementById('userRoleFilter')?.value || '';
  const estado  = document.getElementById('userStatusFilter')?.value || '';

  // Filtrar o array 'todosUtilizadores' segundo os critérios ativos
  const filtrados = todosUtilizadores.filter(u => {
    const nome  = (u.full_name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();

    // .includes() verifica se o texto aparece dentro da string
    const matchTexto  = !texto  || nome.includes(texto) || email.includes(texto);
    const matchRole   = !role   || u.role === role;
    const matchEstado = !estado || u.status === estado;

    // O utilizador só passa no filtro se todas as condições forem verdadeiras
    return matchTexto && matchRole && matchEstado;
  });

  renderizarTabelaUtilizadores(filtrados);
};

// Preencher o modal com os dados de um utilizador para editar
window.editarUtilizador = function(id) {
  const u = todosUtilizadores.find(u => u.id === id);
  if (!u) return;
  editandoId = id;
  openModal('user', u);
};

// Eliminar um utilizador com confirmação
window.eliminarUtilizador = async function(id, nome) {
  if (!confirm(`Tens a certeza que queres eliminar "${nome}"?`)) return;

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id);

  if (error) {
    mostrarToast('Erro ao eliminar: ' + error.message, true);
    return;
  }

  mostrarToast(`"${nome}" eliminado com sucesso.`);
  await carregarUtilizadores();
};


// ============================================================
//  5. ROTAS — ler da base de dados e mostrar em cards
// ============================================================
async function carregarRotas() {
  // Buscar todas as rotas, incluindo as categorias relacionadas
  // O .select('*, categorias_rotas(categoria_id, categorias(nome, cor))')
  // faz um JOIN automático usando as chaves estrangeiras definidas no schema
  const { data, error } = await supabase
    .from('rotas')
    .select(`
      *,
      categorias_rotas (
        categorias ( nome, cor )
      )
    `)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('Erro ao carregar rotas:', error.message);
    return;
  }

  const grid = document.getElementById('routeGrid');
  if (!grid) return;

  const rotas = data || [];

  // Atualizar o contador de rotas no card-count
  const contRotas = document.querySelector('#sec-rotas .card-count');
  if (contRotas) contRotas.textContent = `${rotas.length} rotas`;

  if (rotas.length === 0) {
    grid.innerHTML = `<p style="color:var(--mid);text-align:center;padding:24px">Nenhuma rota criada ainda.</p>`;
    return;
  }

  // Gerar os cards das rotas
  grid.innerHTML = rotas.map(r => {
    const cor = r.cor || '#979d23';
    const cats = r.categorias_rotas?.map(c => c.categorias?.nome).filter(Boolean).join(', ') || '—';

    return `
      <div class="route-card" style="border-left: 4px solid ${cor}; background:white; border-radius:10px; padding:16px; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--dark);margin-bottom:4px">${r.nome}</div>
            <div style="font-size:12px;color:var(--mid)">${r.descricao || 'Sem descrição'}</div>
            <div style="font-size:11px;color:var(--mid);margin-top:6px">Categorias: ${cats}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn-icon" title="Editar" onclick="editarRota(${r.id})">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon" title="Eliminar" onclick="eliminarRota(${r.id}, '${r.nome.replace(/'/g, "\\'")}')" style="color:#ef4444">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.editarRota = function(id) {
  editandoId = id;
  openModal('rota');
};

window.eliminarRota = async function(id, nome) {
  if (!confirm(`Eliminar a rota "${nome}"?`)) return;

  // Primeiro apagar os segmentos (chave estrangeira — não podemos apagar a rota com segmentos dependentes)
  await supabase.from('segmentos_rota').delete().eq('rota_id', id);
  await supabase.from('categorias_rotas').delete().eq('rota_id', id);

  const { error } = await supabase.from('rotas').delete().eq('id', id);
  if (error) { mostrarToast('Erro: ' + error.message, true); return; }

  mostrarToast(`Rota "${nome}" eliminada.`);
  await carregarRotas();
};


// ============================================================
//  6. POSTOS/LOCAIS — ler da base de dados e mostrar em cards
// ============================================================
async function carregarPostos() {
  const { data, error } = await supabase
    .from('locais')
    .select(`
      *,
      categorias_locais (
        categorias ( nome, cor, simbolo )
      ),
      fotos ( url )
    `)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('Erro ao carregar postos:', error.message);
    return;
  }

  const grid = document.getElementById('postoGrid');
  if (!grid) return;

  const postos = data || [];

  const contPostos = document.querySelector('#sec-postos .card-count');
  if (contPostos) contPostos.textContent = `${postos.length} pontos`;

  if (postos.length === 0) {
    grid.innerHTML = `<p style="color:var(--mid);text-align:center;padding:24px">Nenhum ponto criado ainda.</p>`;
    return;
  }

  grid.innerHTML = postos.map(p => {
    const foto = p.fotos?.[0]?.url || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=400&auto=format';
    const cat  = p.categorias_locais?.[0]?.categorias;
    const cor  = cat?.cor || '#979d23';
    const catNome = cat?.nome || '—';

    return `
      <div style="background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:12px">
        <div style="height:120px;background-image:url('${foto}');background-size:cover;background-position:center;position:relative">
          <span style="position:absolute;top:8px;right:8px;background:${cor};color:white;font-size:11px;padding:3px 9px;border-radius:20px">${catNome}</span>
        </div>
        <div style="padding:14px">
          <div style="font-weight:700;font-size:14px;color:var(--dark);margin-bottom:4px">${p.nome}</div>
          <div style="font-size:12px;color:var(--mid);margin-bottom:8px">${p.descricao || 'Sem descrição'}</div>
          <div style="font-size:11px;color:var(--mid)">📍 ${p.latitude}, ${p.longitude}</div>
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="btn-icon" title="Editar" onclick="editarPosto(${p.id})">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon" title="Eliminar" onclick="eliminarPosto(${p.id}, '${p.nome.replace(/'/g, "\\'")}')" style="color:#ef4444">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.editarPosto = function(id) {
  editandoId = id;
  openModal('posto');
};

window.eliminarPosto = async function(id, nome) {
  if (!confirm(`Eliminar o ponto "${nome}"?`)) return;

  // Apagar dependências antes do local em si
  await supabase.from('fotos').delete().eq('locais_id', id);
  await supabase.from('categorias_locais').delete().eq('local_id', id);
  await supabase.from('segmentos_rota').delete().or(`local_origem_id.eq.${id},local_destino_id.eq.${id}`);

  const { error } = await supabase.from('locais').delete().eq('id', id);
  if (error) { mostrarToast('Erro: ' + error.message, true); return; }

  mostrarToast(`Ponto "${nome}" eliminado.`);
  await carregarPostos();
};


// ============================================================
//  7. ESTATÍSTICAS DO DASHBOARD
// ============================================================
async function atualizarEstatisticasDashboard() {
  // Contar utilizadores
  const { count: numUtilizadores } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true }); // head:true = não traz os dados, só a contagem

  // Contar rotas
  const { count: numRotas } = await supabase
    .from('rotas')
    .select('*', { count: 'exact', head: true });

  // Contar postos
  const { count: numPostos } = await supabase
    .from('locais')
    .select('*', { count: 'exact', head: true });

  // Buscar os últimos 5 registos para a tabela do dashboard
  const { data: ultimos } = await supabase
    .from('profiles')
    .select('full_name, email, created_at, status')
    .order('created_at', { ascending: false })
    .limit(5);

  // Atualizar os valores nos cards de estatística
  const vals = document.querySelectorAll('.stat-value');
  if (vals[0]) vals[0].textContent = numUtilizadores ?? 0;
  if (vals[1]) vals[1].textContent = numRotas ?? 0;
  if (vals[2]) vals[2].textContent = numPostos ?? 0;

  // Atualizar o badge da sidebar de utilizadores
  const badge = document.querySelector('.nav-badge');
  if (badge) badge.textContent = numUtilizadores ?? 0;

  // Preencher a tabela "Últimos Registos" no dashboard
  const tbody = document.querySelector('#sec-dashboard tbody');
  if (tbody && ultimos) {
    tbody.innerHTML = ultimos.map(u => {
      const nome = u.full_name || u.email || 'Sem nome';
      const partes = nome.split(' ');
      const iniciais = (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
      const data = u.created_at ? new Date(u.created_at).toLocaleDateString('pt-PT') : '—';
      const estadoBadge = {
        active:  `<span class="badge active"><span class="badge-dot"></span>Ativo</span>`,
        inactive:`<span class="badge inactive"><span class="badge-dot"></span>Inativo</span>`,
        pending: `<span class="badge pending"><span class="badge-dot"></span>Pendente</span>`
      };
      return `
        <tr>
          <td><div class="td-name"><div class="td-avatar">${iniciais}</div><div><div class="td-main">${nome}</div></div></div></td>
          <td>${u.email || '—'}</td>
          <td>${data}</td>
          <td>${estadoBadge[u.status] || estadoBadge.pending}</td>
        </tr>
      `;
    }).join('');
  }
}


// ============================================================
//  8. MODAL — abrir, fechar, guardar
// ============================================================

// Abre o modal e preenche com o formulário correto conforme o tipo
window.openModal = function(tipo, dadosEditar) {
  modalTipo = tipo || 'user';
  const overlay = document.getElementById('modalOverlay');
  const titulo  = document.getElementById('modalTitle');
  const corpo   = document.getElementById('modalBody');

  if (!overlay) return;

  // Definir o título do modal
  const titulos = { user: 'Utilizador', rota: 'Rota', posto: 'Ponto Turístico' };
  titulo.textContent = dadosEditar ? `Editar ${titulos[modalTipo]}` : `Novo ${titulos[modalTipo]}`;

  // Preencher o corpo do modal conforme o tipo
  if (modalTipo === 'user') {
    corpo.innerHTML = `
      <div class="form-group">
        <label class="form-label">Nome completo</label>
        <input class="modal-input" id="m-nome" type="text" placeholder="João Silva" value="${dadosEditar?.full_name || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="modal-input" id="m-email" type="email" placeholder="joao@email.pt" value="${dadosEditar?.email || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Perfil</label>
        <select class="modal-input" id="m-role">
          <option value="user"  ${dadosEditar?.role === 'user'  ? 'selected' : ''}>Utilizador</option>
          <option value="admin" ${dadosEditar?.role === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select class="modal-input" id="m-status">
          <option value="active"   ${(!dadosEditar || dadosEditar?.status === 'active')   ? 'selected' : ''}>Ativo</option>
          <option value="inactive" ${dadosEditar?.status === 'inactive' ? 'selected' : ''}>Inativo</option>
          <option value="pending"  ${dadosEditar?.status === 'pending'  ? 'selected' : ''}>Pendente</option>
        </select>
      </div>
    `;
  } else if (modalTipo === 'rota') {
    corpo.innerHTML = `
      <div class="form-group">
        <label class="form-label">Nome da Rota</label>
        <input class="modal-input" id="m-nome" type="text" placeholder="Ex: Trilho do Castelo">
      </div>
      <div class="form-group">
        <label class="form-label">Descrição</label>
        <textarea class="modal-input" id="m-descricao" rows="3" placeholder="Descreve o percurso..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Cor (para o mapa)</label>
        <input class="modal-input" id="m-cor" type="color" value="#979d23">
      </div>
    `;
  } else if (modalTipo === 'posto') {
    corpo.innerHTML = `
      <div class="form-group">
        <label class="form-label">Nome do Ponto</label>
        <input class="modal-input" id="m-nome" type="text" placeholder="Ex: Castelo de Sesimbra">
      </div>
      <div class="form-group">
        <label class="form-label">Descrição</label>
        <textarea class="modal-input" id="m-descricao" rows="2" placeholder="Breve descrição do local..."></textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Latitude</label>
          <input class="modal-input" id="m-lat" type="number" step="0.0001" placeholder="38.4550">
        </div>
        <div class="form-group">
          <label class="form-label">Longitude</label>
          <input class="modal-input" id="m-lng" type="number" step="0.0001" placeholder="-9.1025">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">URL de uma Foto (opcional)</label>
        <input class="modal-input" id="m-foto" type="url" placeholder="https://...">
      </div>
    `;
  }

  // Adicionar estilos inline ao modal-input se ainda não existirem
  const style = document.getElementById('modal-extra-styles');
  if (!style) {
    const s = document.createElement('style');
    s.id = 'modal-extra-styles';
    s.textContent = `
      .modal-input{width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:'Nunito Sans',sans-serif;font-size:14px;color:var(--dark);outline:none;transition:border-color .2s;background:white;box-sizing:border-box}
      .modal-input:focus{border-color:var(--secondary)}
      .form-group{margin-bottom:16px}
      .form-label{display:block;font-size:12px;font-weight:700;color:var(--dark);margin-bottom:6px}
    `;
    document.head.appendChild(s);
  }

  overlay.classList.add('show');
};

// Fechar o modal
window.closeModal = function() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('show');
  editandoId = null;
  modalTipo = null;
};

// Fechar ao clicar fora do modal
window.closeModalOutside = function(e) {
  if (e.target.id === 'modalOverlay') closeModal();
};

// Guardar os dados do modal no Supabase
window.saveModal = async function() {
  if (!modalTipo) return;

  if (modalTipo === 'user') {
    const nome   = document.getElementById('m-nome')?.value.trim();
    const email  = document.getElementById('m-email')?.value.trim();
    const role   = document.getElementById('m-role')?.value;
    const status = document.getElementById('m-status')?.value;

    if (!nome || !email) { mostrarToast('Preenche o nome e o email.', true); return; }

    // Se estamos a editar, fazer UPDATE; se é novo, fazer INSERT
    if (editandoId) {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: nome, role, status })
        .eq('id', editandoId);
      if (error) { mostrarToast('Erro: ' + error.message, true); return; }
    } else {
      // Para criar um utilizador novo é preciso usar a API de admin
      // (auth.admin.createUser) que não está disponível no cliente anónimo.
      // Como alternativa, inserimos só o perfil com email — o utilizador
      // terá de fazer registo normal para obter credenciais.
      mostrarToast('Para criar utilizadores, usa a página de registo.', true);
      return;
    }

    mostrarToast('Utilizador atualizado com sucesso.');
    closeModal();
    await carregarUtilizadores();

  } else if (modalTipo === 'rota') {
    const nome      = document.getElementById('m-nome')?.value.trim();
    const descricao = document.getElementById('m-descricao')?.value.trim();
    const cor       = document.getElementById('m-cor')?.value;

    if (!nome) { mostrarToast('O nome da rota é obrigatório.', true); return; }

    const { error } = await supabase
      .from('rotas')
      .insert([{ nome, descricao, cor }]);

    if (error) { mostrarToast('Erro: ' + error.message, true); return; }

    mostrarToast('Rota criada com sucesso.');
    closeModal();
    await carregarRotas();

  } else if (modalTipo === 'posto') {
    const nome      = document.getElementById('m-nome')?.value.trim();
    const descricao = document.getElementById('m-descricao')?.value.trim();
    const lat       = parseFloat(document.getElementById('m-lat')?.value);
    const lng       = parseFloat(document.getElementById('m-lng')?.value);
    const foto      = document.getElementById('m-foto')?.value.trim();

    if (!nome || isNaN(lat) || isNaN(lng)) {
      mostrarToast('Preenche o nome, latitude e longitude.', true);
      return;
    }

    // Inserir o local primeiro
    const { data: novoLocal, error } = await supabase
      .from('locais')
      .insert([{ nome, descricao, latitude: lat, longitude: lng }])
      .select()
      .single();

    if (error) { mostrarToast('Erro: ' + error.message, true); return; }

    // Se há URL de foto, inserir também na tabela 'fotos'
    if (foto && novoLocal) {
      await supabase
        .from('fotos')
        .insert([{ locais_id: novoLocal.id, url: foto }]);
    }

    mostrarToast('Ponto turístico criado com sucesso.');
    closeModal();
    await carregarPostos();
  }
};


// ============================================================
//  9. TOAST — mensagem temporária de feedback
// ============================================================
function mostrarToast(mensagem, erro) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const dot = document.querySelector('.toast-dot');

  if (!toast) return;

  if (toastMsg) toastMsg.textContent = mensagem;
  if (dot) dot.style.background = erro ? '#ef4444' : '#22c55e';

  toast.classList.add('show');

  // Esconder o toast após 3 segundos
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Adicionar o estilo .show ao modal e toast se não estiver no CSS
(function injetarEstilosExtras() {
  const s = document.createElement('style');
  s.textContent = `
    .modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center; }
    .modal-overlay.show { display:flex; }
    .toast { position:fixed; bottom:24px; right:24px; background:var(--dark); color:white; padding:12px 20px; border-radius:10px; display:none; align-items:center; gap:10px; font-size:14px; z-index:9999; }
    .toast.show { display:flex; }
    .toast-dot { width:8px; height:8px; border-radius:50%; background:#22c55e; flex-shrink:0; }
    .badge { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px; }
    .badge.active { background:#dcfce7; color:#166534; }
    .badge.inactive { background:#f1f5f9; color:#64748b; }
    .badge.pending { background:#fef9c3; color:#854d0e; }
    .badge-dot { width:6px; height:6px; border-radius:50%; background:currentColor; }
    .td-name { display:flex; align-items:center; gap:10px; }
    .td-avatar { width:32px; height:32px; border-radius:50%; background:var(--secondary); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:white; flex-shrink:0; }
    .td-avatar.green { background:#16a34a; }
    .td-avatar.orange { background:#ea580c; }
    .td-avatar.blue { background:#2563eb; }
    .td-main { font-size:14px; font-weight:600; color:var(--dark); }
  `;
  document.head.appendChild(s);
})();
