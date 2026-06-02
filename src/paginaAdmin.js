// ── DATA ──
const users = [
  {id:1,name:'Maria Rodrigues',email:'maria.r@gmail.com',role:'user',interest:'Historia',status:'pending',date:'02/06/2026'},
  {id:2,name:'João Silva',email:'joao.s@outlook.pt',role:'admin',interest:'Natureza',status:'active',date:'02/06/2026'},
  {id:3,name:'Ana Costa',email:'ana.costa@sapo.pt',role:'user',interest:'Praia',status:'active',date:'01/06/2026'},
  {id:4,name:'Pedro Matos',email:'pmatos@gmail.com',role:'user',interest:'Fotografia',status:'inactive',date:'01/06/2026'},
  {id:5,name:'Luísa Ferreira',email:'luisa.f@hotmail.com',role:'user',interest:'Gastronomia',status:'active',date:'31/05/2026'},
  {id:6,name:'Rui Gomes',email:'rui.gomes@gmail.com',role:'user',interest:'Historia',status:'active',date:'30/05/2026'},
  {id:7,name:'Carla Nunes',email:'carla.n@sapo.pt',role:'user',interest:'Natureza',status:'active',date:'29/05/2026'},
  {id:8,name:'Filipe Santos',email:'filipe.s@gmail.com',role:'admin',interest:'Historia',status:'active',date:'28/05/2026'},
];

const rotas = [
  {id:1,name:'Rota do Castelo',cat:'Histórica',dist:'4.2 km',dur:'1h30',dif:'Fácil',pontos:6,status:'active',icon:'🏰'},
  {id:2,name:'Trilho da Serra',cat:'Natural',dist:'8.5 km',dur:'3h',dif:'Moderada',pontos:4,status:'active',icon:'🌿'},
  {id:3,name:'Caminho da Costa',cat:'Costeira',dist:'6.1 km',dur:'2h',dif:'Fácil',pontos:5,status:'active',icon:'🌊'},
  {id:4,name:'Percurso da Aldeia',cat:'Cultural',dist:'3.0 km',dur:'1h',dif:'Fácil',pontos:8,status:'active',icon:'🏘️'},
  {id:5,name:'Rota dos Pescadores',cat:'Histórica',dist:'5.5 km',dur:'2h',dif:'Moderada',pontos:5,status:'inactive',icon:'⚓'},
  {id:6,name:'Trilho do Miradouro',cat:'Natural',dist:'7.0 km',dur:'2h30',dif:'Difícil',pontos:3,status:'active',icon:'🦅'},
];

const postos = [
  {id:1,name:'Castelo de Sesimbra',cat:'Histórico',emoji:'🏰',cls:'cast',desc:'Fortaleza medieval do séc. XII',status:'active'},
  {id:2,name:'Forte de Santiago',cat:'Histórico',emoji:'⚓',cls:'hist',desc:'Forte quinhentista na costa',status:'active'},
  {id:3,name:'Praia do Ouro',cat:'Natural',emoji:'🏖️',cls:'nat',desc:'Praia de areia dourada',status:'active'},
  {id:4,name:'Miradouro da Arrábida',cat:'Panorâmico',emoji:'🌅',cls:'pov',desc:'Vista sobre o Parque Natural',status:'active'},
  {id:5,name:'Igreja de Santiago',cat:'Cultural',emoji:'⛪',cls:'hist',desc:'Igreja paroquial histórica',status:'active'},
  {id:6,name:'Lagoa de Albufeira',cat:'Natural',emoji:'🦢',cls:'nat',desc:'Lagoa costeira com fauna diversa',status:'active'},
  {id:7,name:'Museu Municipal',cat:'Cultural',emoji:'🏛️',cls:'hist',desc:'Acervo arqueológico local',status:'inactive'},
  {id:8,name:'Cabo Espichel',cat:'Panorâmico',emoji:'🌊',cls:'pov',desc:'Ponta extrema da Serra da Arrábida',status:'active'},
];

// ── NAV ──
function showSection(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  el.classList.add('active');
  const titles = {dashboard:'Painel de Administração',utilizadores:'Utilizadores',rotas:'Rotas Turísticas',postos:'Postos Turísticos'};
  document.getElementById('topbarTitle').textContent = titles[id] || id;
  if(id==='utilizadores') renderUsers(users);
  if(id==='rotas') renderRoutes();
  if(id==='postos') renderPostos();
}

// ── USERS ──
function initials(n){return n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
const avatarCls = ['','green','orange','','green','','orange','green'];

function renderUsers(list) {
  const tb = document.getElementById('userTable');
  const statusMap = {active:'active',inactive:'inactive',pending:'pending'};
  const statusLabel = {active:'Ativo',inactive:'Inativo',pending:'Pendente'};
  const roleLabel = {admin:'Administrador',user:'Utilizador'};
  const roleCls = {admin:'admin',user:'user'};
  tb.innerHTML = list.map((u,i) => `
    <tr>
      <td><div class="td-name">
        <div class="td-avatar ${avatarCls[i%8]}">${initials(u.name)}</div>
        <div><div class="td-main">${u.name}</div></div>
      </div></td>
      <td style="color:var(--mid);font-size:13px">${u.email}</td>
      <td><span class="badge ${roleCls[u.role]}">${roleLabel[u.role]}</span></td>
      <td style="font-size:13px;color:var(--mid)">${u.interest}</td>
      <td><span class="badge ${statusMap[u.status]}"><span class="badge-dot"></span>${statusLabel[u.status]}</span></td>
      <td style="font-size:13px;color:#9ca3af">${u.date}</td>
      <td><div class="td-actions">
        <button class="action-btn view" title="Ver" onclick="showToast('A abrir perfil de ${u.name}…')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button class="action-btn edit" title="Editar" onclick="openModal('user')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="action-btn del" title="Eliminar" onclick="showToast('Utilizador eliminado.')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
      </div></td>
    </tr>`).join('');
}

function filterUsers() {
  const q = document.getElementById('userSearch').value.toLowerCase();
  const role = document.getElementById('userRoleFilter').value;
  const status = document.getElementById('userStatusFilter').value;
  const filtered = users.filter(u =>
    (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
    (!role || u.role === role) &&
    (!status || u.status === status)
  );
  renderUsers(filtered);
  document.getElementById('userCount').textContent = filtered.length + ' registos';
}

// ── ROUTES ──
function renderRoutes() {
  const dif = {Fácil:'#22c55e',Moderada:'#f97316',Difícil:'#ef4444'};
  document.getElementById('routeGrid').innerHTML = rotas.map(r => `
    <div class="route-card">
      <div class="route-img">
        <div class="route-img-icon" style="font-size:24px">${r.icon}</div>
        <span style="position:absolute;top:10px;right:10px" class="badge ${r.status==='active'?'active':'inactive'}">
          <span class="badge-dot"></span>${r.status==='active'?'Ativa':'Inativa'}
        </span>
      </div>
      <div class="route-body">
        <div class="route-name">${r.name}</div>
        <div class="route-meta">
          <span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18"/></svg>${r.dist}</span>
          <span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>${r.dur}</span>
          <span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>${r.pontos} pontos</span>
        </div>
        <div class="route-footer">
          <span style="font-size:11.5px;font-weight:700;color:${dif[r.dif]}">${r.dif}</span>
          <div style="display:flex;gap:5px">
            <button class="action-btn view" onclick="showToast('A abrir rota ${r.name}…')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
            <button class="action-btn edit" onclick="openModal('rota')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="action-btn del" onclick="showToast('Rota eliminada.')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
          </div>
        </div>
      </div>
    </div>`).join('');
}

// ── PONTOS ──
function renderPostos() {
  document.getElementById('postoGrid').innerHTML = postos.map(p => `
    <div class="posto-card">
      <div class="posto-icon ${p.cls}">${p.emoji}</div>
      <div class="posto-info">
        <div class="posto-name">${p.name}</div>
        <div class="posto-cat">${p.cat} · ${p.desc}</div>
        <div class="posto-actions">
          <button class="action-btn view" onclick="showToast('A abrir ${p.name}…')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="action-btn edit" onclick="openModal('posto')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="action-btn del" onclick="showToast('Posto eliminado.')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
          <span class="badge ${p.status==='active'?'active':'inactive'}" style="margin-left:auto"><span class="badge-dot"></span>${p.status==='active'?'Ativo':'Inativo'}</span>
        </div>
      </div>
    </div>`).join('');
}

// ── MODAL ──
let currentModal = 'user';
const modalForms = {
  user: {
    title: 'Novo Utilizador',
    html: `
      <div class="modal-row">
        <div class="modal-form-group"><label class="modal-label">Nome *</label><input class="modal-input" placeholder="João"></div>
        <div class="modal-form-group"><label class="modal-label">Apelido *</label><input class="modal-input" placeholder="Silva"></div>
      </div>
      <div class="modal-form-group"><label class="modal-label">Email *</label><input class="modal-input" type="email" placeholder="joao@email.pt"></div>
      <div class="modal-row">
        <div class="modal-form-group"><label class="modal-label">Perfil</label>
          <select class="modal-select"><option>Utilizador</option><option>Administrador</option></select>
        </div>
        <div class="modal-form-group"><label class="modal-label">Estado</label>
          <select class="modal-select"><option>Ativo</option><option>Inativo</option><option>Pendente</option></select>
        </div>
      </div>
      <div class="modal-form-group"><label class="modal-label">Interesse Principal</label>
        <select class="modal-select"><option value="">Seleciona…</option><option>História e Património</option><option>Natureza e Trilhos</option><option>Gastronomia Local</option><option>Praias e Mar</option><option>Fotografia</option></select>
      </div>`
  },
  rota: {
    title: 'Nova Rota Turística',
    html: `
      <div class="modal-form-group"><label class="modal-label">Nome da Rota *</label><input class="modal-input" placeholder="Ex: Trilho do Castelo"></div>
      <div class="modal-row">
        <div class="modal-form-group"><label class="modal-label">Categoria</label>
          <select class="modal-select"><option>Histórica</option><option>Natural</option><option>Costeira</option><option>Cultural</option></select>
        </div>
        <div class="modal-form-group"><label class="modal-label">Dificuldade</label>
          <select class="modal-select"><option>Fácil</option><option>Moderada</option><option>Difícil</option></select>
        </div>
      </div>
      <div class="modal-row">
        <div class="modal-form-group"><label class="modal-label">Distância (km)</label><input class="modal-input" type="number" placeholder="4.5"></div>
        <div class="modal-form-group"><label class="modal-label">Duração estimada</label><input class="modal-input" placeholder="1h30"></div>
      </div>
      <div class="modal-form-group"><label class="modal-label">Descrição</label><textarea class="modal-textarea" placeholder="Descrição da rota…"></textarea></div>
      <div class="modal-form-group"><label class="modal-label">Estado</label>
        <select class="modal-select"><option>Ativa</option><option>Inativa</option></select>
      </div>`
  },
  posto: {
    title: 'Novo Posto Turístico / Histórico',
    html: `
      <div class="modal-form-group"><label class="modal-label">Nome do Posto *</label><input class="modal-input" placeholder="Ex: Forte de Santiago"></div>
      <div class="modal-row">
        <div class="modal-form-group"><label class="modal-label">Categoria</label>
          <select class="modal-select"><option>Histórico</option><option>Natural</option><option>Cultural</option><option>Panorâmico</option></select>
        </div>
        <div class="modal-form-group"><label class="modal-label">Estado</label>
          <select class="modal-select"><option>Ativo</option><option>Inativo</option></select>
        </div>
      </div>
      <div class="modal-row">
        <div class="modal-form-group"><label class="modal-label">Latitude</label><input class="modal-input" placeholder="38.4412"></div>
        <div class="modal-form-group"><label class="modal-label">Longitude</label><input class="modal-input" placeholder="-9.1000"></div>
      </div>
      <div class="modal-form-group"><label class="modal-label">Descrição</label><textarea class="modal-textarea" placeholder="Breve descrição do posto…"></textarea></div>
      <div class="modal-form-group"><label class="modal-label">Horário de Visita</label><input class="modal-input" placeholder="Ex: 09:00 – 18:00 (Ter–Dom)"></div>`
  }
};

function openModal(type) {
  currentModal = type || currentModal;
  const f = modalForms[currentModal];
  document.getElementById('modalTitle').textContent = f.title;
  document.getElementById('modalBody').innerHTML = f.html;
  document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

function closeModalOutside(e) {
  if(e.target === document.getElementById('modalOverlay')) closeModal();
}

function saveModal() {
  closeModal();
  const msgs = {user:'Utilizador guardado com sucesso!',rota:'Rota adicionada com sucesso!',posto:'Posto adicionado com sucesso!'};
  showToast(msgs[currentModal] || 'Guardado com sucesso!');
}

// ── TOAST ──
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  document.getElementById('toastMsg').textContent = msg;
  document.getElementById('toast').classList.add('show');
  toastTimer = setTimeout(() => document.getElementById('toast').classList.remove('show'), 3000);
}

// init
renderUsers(users);