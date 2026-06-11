// src/paginaAdmin.js
import { supabase } from './supabaseClient.js';

// ==================== VARIABES GLOBAIS ====================
let currentSection = 'dashboard';
let currentEditId = null;
let currentEditType = null;
let categoriasList = [];
let locaisList = [];
let rotasList = [];
let locationMap = null;
let locationMarker = null;
let currentLat = null;
let currentLng = null;

// Variáveis para o mapa de rotas interativo
let routeMap = null;
let routeMarkers = [];
let selectedPontosRota = [];
let allLocaisForMap = [];
let currentRouteLayerGroup = null;

const ROUTING_API = 'https://router.project-osrm.org/route/v1/driving/';

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadCategorias();
    await loadLocais();
    await loadRotas();
    await loadUsers();
    updateDashboardCounts();
    setupEventListeners();
    setupNavigationListeners(); // Adicionado
    if (currentSection === 'dashboard') {
        await loadLastUsers();
    }
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role !== 'admin') {
        window.location.href = 'index.html';
    }
}

function setupEventListeners() {
    const btnSair = document.getElementById('btnSair');
    if (btnSair) btnSair.addEventListener('click', logout);
}

function setupNavigationListeners() {
    // Configurar navegação programática como fallback
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const onclickAttr = item.getAttribute('onclick');
            if (onclickAttr) {
                // Extrair o nome da seção do onclick
                const match = onclickAttr.match(/showSection\('([^']+)'/);
                if (match && match[1]) {
                    showSection(match[1], item);
                }
            }
        });
    });
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

// ==================== NAVEGAÇÃO DO PAINEL ====================
// Garantir que showSection está no escopo global ANTES de ser chamada
window.showSection = function(section, element) {
    currentSection = section;
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (element) element.classList.add('active');
    
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    const targetedSection = document.getElementById(`sec-${section}`);
    if (targetedSection) targetedSection.classList.add('active');
    
    const titles = {
        dashboard: 'Painel de Administração',
        utilizadores: 'Gestão de Utilizadores',
        rotas: 'Gestão de Rotas',
        postos: 'Gestão de Pontos Turísticos',
        categorias: 'Gestão de Categorias'
    };
    const titleEl = document.getElementById('topbarTitle');
    if (titleEl) titleEl.textContent = titles[section] || 'Administração';
    
    if (section === 'utilizadores') loadUsers();
    else if (section === 'rotas') loadRotas();
    else if (section === 'postos') loadLocais();
    else if (section === 'categorias') renderCategoriasTable();
    else if (section === 'dashboard') { updateDashboardCounts(); loadLastUsers(); }
};

// Exportar para garantir disponibilidade global (se estiver usando módulos)
if (typeof window !== 'undefined') {
    window.showSection = showSection;
}

// ==================== DASHBOARD ====================
async function updateDashboardCounts() {
    try {
        const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: rotasCount } = await supabase.from('rotas').select('*', { count: 'exact', head: true });
        const { count: locaisCount } = await supabase.from('locais').select('*', { count: 'exact', head: true });
        const { count: catsCount } = await supabase.from('categorias').select('*', { count: 'exact', head: true });
        
        const statUsers = document.getElementById('statUsers');
        const statRotas = document.getElementById('statRotas');
        const statPostos = document.getElementById('statPostos');
        const statCats = document.getElementById('statCats');
        
        if (statUsers) statUsers.textContent = usersCount || 0;
        if (statRotas) statRotas.textContent = rotasCount || 0;
        if (statPostos) statPostos.textContent = locaisCount || 0;
        if (statCats) statCats.textContent = catsCount || 0;
        
        const badge = document.querySelector('.nav-item[onclick*="utilizadores"] .nav-badge');
        if (badge) badge.textContent = usersCount || 0;
    } catch (error) { 
        console.error('Erro ao carregar estatísticas:', error); 
    }
}

async function loadLastUsers() {
    try {
        const { data, error } = await supabase.from('profiles').select('nome_completo, email, criado_em, status, role').order('criado_em', { ascending: false }).limit(5);
        if (error) throw error;
        const tbody = document.getElementById('dashLastUsers');
        if (!tbody) return;
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhum utilizador registado</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(user => `
            <tr>
                <td>${escapeHtml(user.nome_completo || 'N/A')}</td>
                <td>${escapeHtml(user.email || 'N/A')}</td>
                <td>${formatDate(user.criado_em)}</td>
                <td><span class="badge ${user.status === 'active' ? 'active' : 'inactive'}">${getStatusText(user.status)}</span></td>
            </tr>
        `).join('');
    } catch (error) { 
        console.error('Erro ao carregar últimos utilizadores:', error); 
    }
}

// ==================== UTILIZADORES ====================
async function loadUsers() {
    try {
        const { data, error } = await supabase.from('profiles').select('id, email, nome_completo, role, status, criado_em').order('criado_em', { ascending: false });
        if (error) throw error;
        window.allUsers = data || [];
        const userCountSpan = document.getElementById('userCount');
        if (userCountSpan) userCountSpan.textContent = window.allUsers.length;
        filterUsers();
    } catch (error) { 
        console.error('Erro ao carregar utilizadores:', error); 
    }
}

window.filterUsers = function() {
    const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || "";
    const roleFilter = document.getElementById('userRoleFilter')?.value || "";
    const statusFilter = document.getElementById('userStatusFilter')?.value || "";
    let filtered = window.allUsers || [];
    
    if (searchTerm) {
        filtered = filtered.filter(user => 
            (user.nome_completo && user.nome_completo.toLowerCase().includes(searchTerm)) || 
            (user.email && user.email.toLowerCase().includes(searchTerm))
        );
    }
    if (roleFilter) filtered = filtered.filter(user => user.role === roleFilter);
    if (statusFilter) filtered = filtered.filter(user => user.status === statusFilter);
    renderUserTable(filtered);
};

function renderUserTable(users) {
    const tbody = document.getElementById('userTable');
    if (!tbody) return;
    if (!users || users.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum utilizador encontrado</td></tr>'; 
        return; 
    }
    tbody.innerHTML = users.map(user => `
        <tr>
            <td><div class="td-name"><div class="td-avatar ${user.role === 'admin' ? 'green' : ''}">${getInitials(user.nome_completo || user.email)}</div><div><div class="td-main">${escapeHtml(user.nome_completo || 'Sem nome')}</div><div class="td-sub">ID: ${user.id.slice(0,8)}...</div></div></div></td>
            <td>${escapeHtml(user.email || '-')}</td>
            <td><span class="badge ${user.role === 'admin' ? 'admin' : 'user'}">${user.role === 'admin' ? 'Administrador' : 'Utilizador'}</span></td>
            <td><span class="badge ${user.status === 'active' ? 'active' : user.status === 'pending' ? 'pending' : 'inactive'}">${getStatusText(user.status)}</span></td>
            <td>${formatDate(user.criado_em)}</td>
            <td class="td-actions">
                <button class="action-btn edit" onclick="editUser('${user.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="action-btn del" onclick="toggleUserStatus('${user.id}', '${user.status}')" title="${user.status === 'active' ? 'Desativar' : 'Ativar'}"><i class="fas ${user.status === 'active' ? 'fa-ban' : 'fa-check-circle'}"></i></button>
            </td>
        </tr>
    `).join('');
}

window.editUser = function(userId) {
    const user = window.allUsers.find(u => u.id === userId);
    if (!user) return;
    currentEditId = userId;
    currentEditType = 'user';
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;
    modalBody.innerHTML = `
        <div class="modal-form-group"><label class="modal-label">Nome completo</label><input type="text" class="modal-input" id="editUserName" value="${escapeHtml(user.nome_completo || '')}"></div>
        <div class="modal-form-group"><label class="modal-label">Email</label><input type="email" class="modal-input" id="editUserEmail" value="${escapeHtml(user.email || '')}" disabled></div>
        <div class="modal-form-group"><label class="modal-label">Perfil</label><select class="modal-select" id="editUserRole"><option value="user" ${user.role === 'user' ? 'selected' : ''}>Utilizador</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option></select></div>
        <div class="modal-form-group"><label class="modal-label">Estado</label><select class="modal-select" id="editUserStatus"><option value="active" ${user.status === 'active' ? 'selected' : ''}>Ativo</option><option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Inativo</option><option value="pending" ${user.status === 'pending' ? 'selected' : ''}>Pendente</option></select></div>
    `;
    const modalTitle = document.getElementById('modalTitle');
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-user-edit"></i> Editar Utilizador';
    if (modalOverlay) modalOverlay.classList.add('show');
};

window.toggleUserStatus = async function(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('perfis').update({ status: newStatus }).eq('id', userId);
    if (error) { 
        showToast('Erro ao alterar estado', 'error'); 
        return; 
    }
    showToast(`Utilizador modificado com sucesso`);
    loadUsers();
    updateDashboardCounts();
};

// ==================== CATEGORIAS ====================
async function loadCategorias() {
    try {
        const { data, error } = await supabase.from('categorias').select('*').order('nome');
        if (error) throw error;
        categoriasList = data || [];
        
        const rotaCatFilter = document.getElementById('rotaCatFilter');
        const postoCatFilter = document.getElementById('postoCatFilter');
        if (rotaCatFilter) {
            rotaCatFilter.innerHTML = '<option value="">Todas as categorias</option>' + 
                categoriasList.map(cat => `<option value="${cat.id}">${escapeHtml(cat.nome)}</option>`).join('');
        }
        if (postoCatFilter) {
            postoCatFilter.innerHTML = '<option value="">Todas as categorias</option>' + 
                categoriasList.map(cat => `<option value="${cat.id}">${escapeHtml(cat.nome)}</option>`).join('');
        }
    } catch (error) { 
        console.error('Erro ao carregar categorias:', error); 
    }
}

function renderCategoriasTable() {
    const tbody = document.getElementById('categoriasTableBody');
    if (!tbody) return;
    if (categoriasList.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhuma categoria registada.</td></tr>'; 
        return; 
    }
    tbody.innerHTML = categoriasList.map(cat => `
        <tr>
            <td style="font-size: 20px;">${escapeHtml(cat.simbolo || '📍')}</td>
            <td><strong>${escapeHtml(cat.nome)}</strong></td>
            <td><span style="display:inline-block; width:20px; height:20px; background:${escapeHtml(cat.cor)}; border-radius:4px; vertical-align:middle; margin-right:8px;"></span>${escapeHtml(cat.cor || '#979d23')}</td>
            <td class="td-actions">
                <button class="action-btn edit" onclick="editCategoria(${cat.id})"><i class="fas fa-edit"></i></button>
                <button class="action-btn del" onclick="deleteCategoria(${cat.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.editCategoria = function(id) {
    const cat = categoriasList.find(c => c.id === id);
    if (!cat) return;
    currentEditType = 'categoria';
    currentEditId = id;
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;
    modalBody.innerHTML = `
        <div class="modal-form-group"><label class="modal-label">Nome da categoria</label><input type="text" class="modal-input" id="catNome" value="${escapeHtml(cat.nome)}"></div>
        <div class="modal-row" style="display:flex; gap:15px;"><div class="modal-form-group" style="flex:1;"><label class="modal-label">Cor</label><input type="color" class="modal-input" id="catCor" style="height:42px" value="${escapeHtml(cat.cor || '#979d23')}"></div><div class="modal-form-group" style="flex:1;"><label class="modal-label">Símbolo / Ícone</label><input type="text" class="modal-input" id="catSimbolo" value="${escapeHtml(cat.simbolo || '')}"></div></div>
    `;
    const modalTitle = document.getElementById('modalTitle');
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Categoria';
    if (modalOverlay) modalOverlay.classList.add('show');
};

window.deleteCategoria = async function(id) {
    if (!confirm('Tem a certeza que quer eliminar esta categoria?')) return;
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (error) { 
        showToast('Erro ao eliminar categoria. Verifique se está associada a algum ponto/rota.', 'error'); 
        return; 
    }
    showToast('Categoria eliminada com sucesso');
    await loadCategorias();
    renderCategoriasTable();
    updateDashboardCounts();
};

// ==================== PONTOS TURÍSTICOS (LOCAIS) ====================
async function loadLocais() {
    try {
        const { data, error } = await supabase.from('locais').select('*').order('nome');
        if (error) throw error;
        locaisList = data || [];
        allLocaisForMap = [...locaisList];
        const postoCountSpan = document.getElementById('postoCount');
        if (postoCountSpan) postoCountSpan.textContent = locaisList.length;
        
        for (let local of locaisList) {
            const { data: cats } = await supabase.from('categorias_locais').select('categoria_id').eq('local_id', local.id);
            local.categorias = cats || [];
            const { data: imgs } = await supabase.from('fotos').select('url').eq('locais_id', local.id);
            local.imagens = imgs || [];
        }
        filterPostos();
    } catch (error) { 
        console.error('Erro ao carregar locais:', error); 
    }
}

window.filterPostos = function() {
    const searchTerm = document.getElementById('postoSearch')?.value.toLowerCase() || "";
    const catFilter = parseInt(document.getElementById('postoCatFilter')?.value || "0");
    let filtered = [...locaisList];
    if (searchTerm) {
        filtered = filtered.filter(local => 
            local.nome.toLowerCase().includes(searchTerm) || 
            (local.descricao && local.descricao.toLowerCase().includes(searchTerm))
        );
    }
    if (catFilter) {
        filtered = filtered.filter(local => local.categorias && local.categorias.some(c => c.categoria_id === catFilter));
    }
    renderPostosGrid(filtered);
};

function renderPostosGrid(locais) {
    const grid = document.getElementById('postoGrid');
    if (!grid) return;
    if (!locais || locais.length === 0) { 
        grid.innerHTML = `<div class="empty"><i class="fas fa-map-marker-alt" style="font-size:48px"></i><p>Nenhum ponto turístico encontrado</p></div>`; 
        return; 
    }
    
    grid.innerHTML = locais.map(local => {
        const categoria = local.categorias && local.categorias.length > 0 ? categoriasList.find(c => c.id === local.categorias[0].categoria_id) : null;
        const imagemUrl = local.imagens && local.imagens.length > 0 ? local.imagens[0].url : 'Imagens/logo.png';
        return `
            <div class="posto-card" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <div class="posto-img-container" style="height: 160px; width: 100%; overflow: hidden; background: #f3f4f6; position: relative;">
                    <img src="${escapeHtml(imagemUrl)}" alt="${escapeHtml(local.nome)}" style="width: 100%; height: 100%; object-fit: cover;">
                    <div class="posto-icon" style="position: absolute; top: 10px; left: 10px; background: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.15); color: ${escapeHtml(categoria?.cor || '#979d23')}">${escapeHtml(categoria?.simbolo || '📍')}</div>
                </div>
                <div class="posto-info" style="padding: 15px; flex-grow: 1;">
                    <div class="posto-name" style="font-weight: 700; font-size: 16px; margin-bottom: 5px;">${escapeHtml(local.nome)}</div>
                    <div class="posto-cat" style="font-size: 12px; margin-bottom: 8px;">
                        ${categoria ? `<span style="color:${escapeHtml(categoria.cor)}; font-weight:600;">${escapeHtml(categoria.nome)}</span>` : 'Sem categoria'} 
                        <span style="color: #6b7280; margin-left: 8px;"><i class="fas fa-map-pin"></i> ${local.latitude.toFixed(4)}, ${local.longitude.toFixed(4)}</span>
                    </div>
                    <div class="posto-desc" style="font-size: 13px; color: #4b5563; line-height: 1.4;">${local.descricao ? escapeHtml(local.descricao.substring(0, 85)) + (local.descricao.length > 85 ? '...' : '') : 'Sem descrição.'}</div>
                </div>
                <div class="posto-actions" style="padding: 10px 15px; background: #f9fafb; border-top: 1px solid #f3f4f6; display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="action-btn edit" onclick="editLocal(${local.id})"><i class="fas fa-edit"></i></button>
                    <button class="action-btn del" onclick="deleteLocal(${local.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

function initLocationPickerMap(lat = 38.4446, lng = -9.1016) {
    if (locationMap) { 
        locationMap.remove(); 
        locationMap = null; 
    }
    locationMap = L.map('locationPickerMap').setView([lat, lng], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { 
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>' 
    }).addTo(locationMap);
    
    locationMarker = L.marker([lat, lng], { draggable: true }).addTo(locationMap);
    locationMarker.on('dragend', function(e) { 
        const pos = e.target.getLatLng(); 
        currentLat = pos.lat; 
        currentLng = pos.lng; 
        const latDisplay = document.getElementById('coordLatDisplay');
        const lngDisplay = document.getElementById('coordLngDisplay');
        if (latDisplay) latDisplay.textContent = pos.lat.toFixed(6); 
        if (lngDisplay) lngDisplay.textContent = pos.lng.toFixed(6); 
    });
    locationMap.on('click', function(e) { 
        currentLat = e.latlng.lat; 
        currentLng = e.latlng.lng; 
        locationMarker.setLatLng(e.latlng); 
        const latDisplay = document.getElementById('coordLatDisplay');
        const lngDisplay = document.getElementById('coordLngDisplay');
        if (latDisplay) latDisplay.textContent = e.latlng.lat.toFixed(6); 
        if (lngDisplay) lngDisplay.textContent = e.latlng.lng.toFixed(6); 
    });
}

window.editLocal = async function(id) {
    const local = locaisList.find(l => l.id === id);
    if (!local) return;
    
    currentEditType = 'posto';
    currentEditId = id;
    currentLat = local.latitude;
    currentLng = local.longitude;
    
    const associatedCatIds = (local.categorias || []).map(lc => lc.categoria_id);
    const urlsString = local.imagens ? local.imagens.map(img => img.url).join('\n') : '';
    
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;
    modalBody.innerHTML = `
        <div class="modal-form-group"><label class="modal-label">Nome do ponto</label><input type="text" class="modal-input" id="localNome" value="${escapeHtml(local.nome)}"></div>
        <div class="modal-form-group"><label class="modal-label">Descrição</label><textarea class="modal-textarea" id="localDescricao">${escapeHtml(local.descricao || '')}</textarea></div>
        <div class="modal-form-group"><label class="modal-label">URLs das Imagens (uma por linha)</label><textarea class="modal-textarea" id="localImagensUrls" rows="3" placeholder="https://exemplo.com/foto.jpg">${escapeHtml(urlsString)}</textarea></div>
        <div class="modal-form-group"><label class="modal-label">Categorias</label><div id="localCategoriasList" style="display:flex;flex-wrap:wrap;gap:8px"></div></div>
        <div class="modal-form-group"><label class="modal-label">Localização</label><div id="locationMapContainer" class="location-map-container"><div id="locationPickerMap" style="height:250px;"></div></div><div class="location-coords-display" style="display:flex; gap:20px; margin-top:10px;"><div class="coord-item">Lat: <span id="coordLatDisplay">${local.latitude.toFixed(6)}</span></div><div class="coord-item">Lng: <span id="coordLngDisplay">${local.longitude.toFixed(6)}</span></div></div></div>
    `;
    
    setTimeout(() => {
        const container = document.getElementById('localCategoriasList');
        if (container) {
            container.innerHTML = categoriasList.map(cat => 
                `<label style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:#f3f4f6;border-radius:20px; cursor:pointer;">
                    <input type="checkbox" value="${cat.id}" ${associatedCatIds.includes(cat.id) ? 'checked' : ''}> 
                    <span>${escapeHtml(cat.simbolo || '')} ${escapeHtml(cat.nome)}</span>
                </label>`
            ).join('');
        }
        initLocationPickerMap(local.latitude, local.longitude);
    }, 100);
    
    const modalTitle = document.getElementById('modalTitle');
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Ponto Turístico';
    if (modalOverlay) modalOverlay.classList.add('show');
};

window.deleteLocal = async function(id) {
    if (!confirm('Tem certeza que deseja eliminar este ponto turístico? O processo apagará fotos e paragens vinculadas.')) return;
    try {
        await supabase.from('fotos').delete().eq('locais_id', id);
        await supabase.from('categorias_locais').delete().eq('local_id', id);
        await supabase.from('segmentos_rota').delete().or(`local_origem_id.eq.${id},local_destino_id.eq.${id}`);
        const { error } = await supabase.from('locais').delete().eq('id', id);
        if (error) throw error;
        showToast('Ponto eliminado com sucesso');
        await loadLocais();
        updateDashboardCounts();
    } catch (err) { 
        showToast('Erro ao deletar ponto', 'error'); 
    }
};

// ==================== ROTAS TURÍSTICAS ====================
async function loadRotas() {
    try {
        const { data, error } = await supabase.from('rotas').select('*').order('nome');
        if (error) throw error;
        rotasList = data || [];
        const rotaCountSpan = document.getElementById('rotaCount');
        if (rotaCountSpan) rotaCountSpan.textContent = rotasList.length;
        
        for (let rota of rotasList) {
            const { data: cats } = await supabase.from('categorias_rotas').select('categoria_id').eq('rota_id', rota.id);
            rota.categorias = cats || [];
            const { data: segs } = await supabase.from('segmentos_rota').select('*').eq('rota_id', rota.id).order('ordem_segmento');
            rota.segmentos = segs || [];
        }
        filterRotas();
    } catch (error) { 
        console.error('Erro ao carregar rotas:', error); 
    }
}

window.filterRotas = function() {
    const searchTerm = document.getElementById('rotaSearch')?.value.toLowerCase() || "";
    const catFilter = parseInt(document.getElementById('rotaCatFilter')?.value || "0");
    let filtered = [...rotasList];
    if (searchTerm) {
        filtered = filtered.filter(rota => 
            rota.nome.toLowerCase().includes(searchTerm) || 
            (rota.descricao && rota.descricao.toLowerCase().includes(searchTerm))
        );
    }
    if (catFilter) {
        filtered = filtered.filter(rota => rota.categorias && rota.categorias.some(c => c.categoria_id === catFilter));
    }
    renderRotasGrid(filtered);
};

function renderRotasGrid(rotas) {
    const grid = document.getElementById('routeGrid');
    if (!grid) return;
    if (!rotas || rotas.length === 0) { 
        grid.innerHTML = `<div class="empty"><i class="fas fa-route" style="font-size:48px"></i><p>Nenhuma rota encontrada</p></div>`; 
        return; 
    }
    
    grid.innerHTML = rotas.map(rota => {
        const categoria = rota.categorias && rota.categorias.length > 0 ? categoriasList.find(c => c.id === rota.categorias[0].categoria_id) : null;
        const pontosCount = rota.segmentos ? rota.segmentos.length + 1 : 0;
        return `
            <div class="route-card" style="border: 1px solid #e5e7eb; border-radius:12px; overflow:hidden; background:white; display:flex; flex-direction:column; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
                <div class="route-body" style="padding: 20px; flex-grow:1;">
                    <div class="route-name" style="font-weight:700; font-size:17px; margin-bottom:8px; color:#1f2937;">${escapeHtml(rota.nome)}</div>
                    <div class="route-meta" style="display:flex; gap:12px; font-size:12px; color:#6b7280; margin-bottom:12px;">
                        <span><i class="fas fa-map-marker-alt"></i> ${pontosCount} pontos</span>
                        <span><i class="fas fa-tag"></i> ${escapeHtml(categoria?.nome || 'Sem categoria')}</span>
                    </div>
                    <div class="route-desc" style="font-size:13px; color:#4b5563; line-height:1.5; margin-bottom:15px;">${rota.descricao ? escapeHtml(rota.descricao.substring(0, 120)) + (rota.descricao.length > 120 ? '...' : '') : 'Sem descrição.'}</div>
                </div>
                <div class="route-footer" style="padding:12px 20px; background:#f9fafb; border-top:1px solid #f3f4f6; display:flex; justify-content:flex-end; gap:8px;">
                    <button class="action-btn edit" onclick="openModalRota(${rota.id})"><i class="fas fa-edit"></i> Edição Avançada</button>
                    <button class="action-btn del" onclick="deleteRota(${rota.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

window.openModalRota = function(rotaId = null) {
    currentEditType = 'rota';
    currentEditId = rotaId;
    selectedPontosRota = [];
    
    const modal = document.getElementById('modalRotaOverlay');
    const title = document.getElementById('modalRotaTitle');
    
    if (!modal) return;
    
    if (rotaId) {
        if (title) title.innerHTML = '<i class="fas fa-edit"></i> Editar Rota';
        loadRotaData(rotaId);
    } else {
        if (title) title.innerHTML = '<i class="fas fa-plus-circle"></i> Nova Rota';
        const rotaNome = document.getElementById('rotaNome');
        const rotaDescricao = document.getElementById('rotaDescricao');
        const rotaCor = document.getElementById('rotaCor');
        if (rotaNome) rotaNome.value = '';
        if (rotaDescricao) rotaDescricao.value = '';
        if (rotaCor) rotaCor.value = '#979d23';
        const container = document.getElementById('rotaCategoriasList');
        if (container) {
            container.innerHTML = categoriasList.map(cat => 
                `<label style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:#f3f4f6;border-radius:20px; cursor:pointer;">
                    <input type="checkbox" value="${cat.id}"> 
                    <span>${escapeHtml(cat.simbolo || '')} ${escapeHtml(cat.nome)}</span>
                </label>`
            ).join('');
        }
    }
    
    modal.classList.add('show');
    setTimeout(() => initRouteMap(), 200);
};

async function loadRotaData(rotaId) {
    try {
        const rota = rotasList.find(r => r.id === rotaId);
        if (!rota) return;
        
        const rotaNome = document.getElementById('rotaNome');
        const rotaDescricao = document.getElementById('rotaDescricao');
        const rotaCor = document.getElementById('rotaCor');
        
        if (rotaNome) rotaNome.value = rota.nome;
        if (rotaDescricao) rotaDescricao.value = rota.descricao || '';
        if (rotaCor) rotaCor.value = rota.cor || '#979d23';
        
        const associatedCatIds = (rota.categorias || []).map(rc => rc.categoria_id);
        const container = document.getElementById('rotaCategoriasList');
        if (container) {
            container.innerHTML = categoriasList.map(cat => 
                `<label style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:#f3f4f6;border-radius:20px; cursor:pointer;">
                    <input type="checkbox" value="${cat.id}" ${associatedCatIds.includes(cat.id) ? 'checked' : ''}> 
                    <span>${escapeHtml(cat.simbolo || '')} ${escapeHtml(cat.nome)}</span>
                </label>`
            ).join('');
        }
        
        const pontosRota = [];
        if (rota.segmentos && rota.segmentos.length > 0) {
            const primeiroLocal = allLocaisForMap.find(l => l.id === rota.segmentos[0].local_origem_id);
            if (primeiroLocal) pontosRota.push(primeiroLocal);
            for (const seg of rota.segmentos) {
                const localDestino = allLocaisForMap.find(l => l.id === seg.local_destino_id);
                if (localDestino) pontosRota.push(localDestino);
            }
        }
        selectedPontosRota = pontosRota;
        renderPontosRotaListUI();
        if (routeMap) await loadAllPontosToMap();
    } catch (error) { 
        console.error(error); 
    }
}

function initRouteMap() {
    if (routeMap) { 
        routeMap.remove(); 
        routeMap = null; 
    }
    routeMap = L.map('routeMap').setView([38.4446, -9.1016], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { 
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>' 
    }).addTo(routeMap);
    currentRouteLayerGroup = L.layerGroup().addTo(routeMap);
    loadAllPontosToMap();
}

async function loadAllPontosToMap() {
    routeMarkers.forEach(marker => marker.removeFrom(routeMap));
    routeMarkers = [];
    
    allLocaisForMap.forEach(local => {
        const orderIdx = selectedPontosRota.findIndex(p => p.id === local.id);
        const isSelected = orderIdx !== -1;
        const imagemHtml = local.imagens && local.imagens.length > 0 ? `<img src="${escapeHtml(local.imagens[0].url)}" style="width:100%; height:75px; object-fit:cover; border-radius:4px; margin-top:5px;">` : '';
        
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background:${isSelected ? '#979d23' : 'white'}; color:${isSelected ? 'white' : '#979d23'}; border:2px solid #979d23; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:13px">${isSelected ? (orderIdx + 1) : (escapeHtml(local.simbolo) || '📍')}</div>`,
            iconSize: [30, 30]
        });
        
        const marker = L.marker([local.latitude, local.longitude], { icon }).addTo(routeMap)
            .bindPopup(`<div style="padding:5px; width:180px;"><strong>${escapeHtml(local.nome)}</strong>${imagemHtml}<br><button onclick="togglePontoOnRoute(${local.id})" style="margin-top:8px; width:100%; padding:5px; background:#979d23; color:white; border:none; border-radius:4px; cursor:pointer">${isSelected ? 'Remover' : 'Adicionar à Rota'}</button></div>`);
        
        marker.localId = local.id;
        routeMarkers.push(marker);
    });
    await drawRouteOnMap();
}

async function drawRouteOnMap() {
    if (currentRouteLayerGroup) currentRouteLayerGroup.clearLayers();
    if (selectedPontosRota.length < 2) return;
    
    const statsEl = document.getElementById('routeStats');
    if (statsEl) statsEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A calcular percurso...';
    
    let totalDistance = 0;
    const corRota = document.getElementById('rotaCor')?.value || '#979d23';

    for (let i = 0; i < selectedPontosRota.length - 1; i++) {
        const origem = selectedPontosRota[i];
        const destino = selectedPontosRota[i + 1];
        
        try {
            const url = `${ROUTING_API}${origem.longitude},${origem.latitude};${destino.longitude},${destino.latitude}?overview=full&geometries=geojson`;
            const response = await fetch(url);
            const resData = await response.json();
            
            if (resData.code === 'Ok' && resData.routes[0]) {
                const routeGeom = resData.routes[0].geometry;
                const distanceKm = resData.routes[0].distance / 1000;
                const durationMin = resData.routes[0].duration / 60;
                totalDistance += distanceKm;
                
                const lineStyle = {
                    color: corRota,
                    weight: 6,
                    opacity: 0.85
                };
                
                const polyline = L.geoJSON(routeGeom, { style: lineStyle }).addTo(currentRouteLayerGroup);
                
                const tooltipContent = `
                    <div style="font-size:13px; padding:6px; line-height:1.4;">
                        <strong><i class="fas fa-map-marker-alt"></i> ${origem.nome} → ${destino.nome}</strong>
                        <hr style="margin:4px 0; border:0; border-top:1px solid #e5e7eb;">
                        <div>📏 Distância: ${distanceKm.toFixed(2)} km</div>
                        <div>⏱️ Tempo estimado: ~${Math.round(durationMin)} min</div>
                    </div>
                `;
                polyline.bindTooltip(tooltipContent, { sticky: true });
            }
        } catch (err) { 
            console.error('Erro no processamento do percurso:', err); 
        }
    }
    if (statsEl) statsEl.innerHTML = `<i class="fas fa-route"></i> Rota calculada | Distância total: ${totalDistance.toFixed(2)} km`;
}

window.togglePontoOnRoute = async function(localId) {
    const ponto = allLocaisForMap.find(l => l.id === localId);
    if (!ponto) return;
    const index = selectedPontosRota.findIndex(p => p.id === localId);
    if (index === -1) selectedPontosRota.push(ponto);
    else selectedPontosRota.splice(index, 1);
    
    renderPontosRotaListUI();
    await loadAllPontosToMap();
};

window.removePontoFromRoute = async function(index) {
    selectedPontosRota.splice(index, 1);
    renderPontosRotaListUI();
    await loadAllPontosToMap();
};

window.movePontoUp = async function(index) {
    if (index > 0) {
        [selectedPontosRota[index - 1], selectedPontosRota[index]] = [selectedPontosRota[index], selectedPontosRota[index - 1]];
    }
    renderPontosRotaListUI();
    await loadAllPontosToMap();
};

window.movePontoDown = async function(index) {
    if (index < selectedPontosRota.length - 1) {
        [selectedPontosRota[index], selectedPontosRota[index + 1]] = [selectedPontosRota[index + 1], selectedPontosRota[index]];
    }
    renderPontosRotaListUI();
    await loadAllPontosToMap();
};

function renderPontosRotaListUI() {
    const container = document.getElementById('rotaPontosList');
    if (!container) return;
    if (selectedPontosRota.length === 0) { 
        container.innerHTML = '<p class="empty" style="font-size:13px; color:#6b7280;">Nenhuma paragem adicionada.</p>'; 
        return; 
    }
    container.innerHTML = selectedPontosRota.map((ponto, idx) => `
        <div class="route-point-item">
            <div style="flex:1; font-size:13px;"><strong>${idx + 1}.</strong> ${escapeHtml(ponto.nome)}</div>
            <div style="display:flex; gap:2px;">
                <button class="action-btn" onclick="movePontoUp(${idx})" ${idx === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button>
                <button class="action-btn" onclick="movePontoDown(${idx})" ${idx === selectedPontosRota.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button>
                <button class="action-btn del" onclick="removePontoFromRoute(${idx})"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `).join('');
}

window.clearAllPontos = async function() {
    selectedPontosRota = [];
    renderPontosRotaListUI();
    await loadAllPontosToMap();
};

window.saveRotaFromModal = async function() {
    const nomeInput = document.getElementById('rotaNome');
    const nome = nomeInput?.value.trim();
    if (!nome) { 
        showToast('Nome da rota obrigatório', 'warning'); 
        return; 
    }
    if (selectedPontosRota.length < 2) { 
        showToast('Selecione no mínimo 2 pontos', 'warning'); 
        return; 
    }
    
    const data = { 
        nome, 
        descricao: document.getElementById('rotaDescricao')?.value || null, 
        cor: document.getElementById('rotaCor')?.value || '#979d23' 
    };
    let rotaId = currentEditId;
    let result;
    
    if (currentEditId) {
        result = await supabase.from('rotas').update(data).eq('id', currentEditId);
    } else {
        result = await supabase.from('rotas').insert([data]).select();
        if (result.data) rotaId = result.data[0].id;
    }
    
    if (rotaId) {
        await supabase.from('categorias_rotas').delete().eq('rota_id', rotaId);
        const selectedCats = [];
        document.querySelectorAll('#rotaCategoriasList input:checked').forEach(cb => {
            selectedCats.push({ rota_id: rotaId, categoria_id: parseInt(cb.value) });
        });
        if (selectedCats.length > 0) await supabase.from('categorias_rotas').insert(selectedCats);
        
        await supabase.from('segmentos_rota').delete().eq('rota_id', rotaId);
        const segmentos = [];
        for (let i = 0; i < selectedPontosRota.length - 1; i++) {
            segmentos.push({ 
                rota_id: rotaId, 
                local_origem_id: selectedPontosRota[i].id, 
                local_destino_id: selectedPontosRota[i + 1].id, 
                ordem_segmento: i + 1 
            });
        }
        if (segmentos.length > 0) await supabase.from('segmentos_rota').insert(segmentos);
    }
    showToast('Rota guardada com sucesso!');
    closeModalRota();
    await loadRotas();
    updateDashboardCounts();
};

window.deleteRota = async function(id) {
    if (!confirm('Tem a certeza que quer apagar esta rota?')) return;
    await supabase.from('segmentos_rota').delete().eq('rota_id', id);
    await supabase.from('categorias_rotas').delete().eq('rota_id', id);
    await supabase.from('rotas').delete().eq('id', id);
    showToast('Rota removida');
    await loadRotas();
    updateDashboardCounts();
};

window.closeModalRota = function() {
    const modal = document.getElementById('modalRotaOverlay');
    if (modal) modal.classList.remove('show');
    if (routeMap) { 
        routeMap.remove(); 
        routeMap = null; 
    }
};

window.closeModalRotaOutside = function(e) { 
    if (e.target.id === 'modalRotaOverlay') closeModalRota(); 
};

// ==================== MODAL GERAL ====================
window.saveModal = async function() {
    if (currentEditType === 'categoria') await saveCategoria();
    else if (currentEditType === 'posto') await saveLocal();
    else if (currentEditType === 'user') await saveUser();
};

async function saveCategoria() {
    const nomeInput = document.getElementById('catNome');
    const nome = nomeInput?.value.trim();
    if (!nome) { 
        showToast('Nome obrigatório', 'warning'); 
        return; 
    }
    const data = { 
        nome, 
        cor: document.getElementById('catCor')?.value || '#979d23', 
        simbolo: document.getElementById('catSimbolo')?.value || '📍' 
    };
    
    if (currentEditId) {
        await supabase.from('categorias').update(data).eq('id', currentEditId);
    } else {
        await supabase.from('categorias').insert([data]);
    }
    
    showToast('Categoria guardada');
    closeModal();
    await loadCategorias();
    renderCategoriasTable();
    updateDashboardCounts();
}

async function saveLocal() {
    const nomeInput = document.getElementById('localNome');
    const nome = nomeInput?.value.trim();
    if (!nome) { 
        showToast('Nome obrigatório', 'warning'); 
        return; 
    }
    
    const data = { 
        nome, 
        descricao: document.getElementById('localDescricao')?.value || '', 
        latitude: currentLat, 
        longitude: currentLng 
    };
    let localId = currentEditId;
    
    if (currentEditId) {
        await supabase.from('locais').update(data).eq('id', currentEditId);
    } else {
        const res = await supabase.from('locais').insert([data]).select();
        if (res.data) localId = res.data[0].id;
    }
    
    if (localId) {
        await supabase.from('categorias_locais').delete().eq('local_id', localId);
        const selectedCats = [];
        document.querySelectorAll('#localCategoriasList input:checked').forEach(cb => {
            selectedCats.push({ local_id: localId, categoria_id: parseInt(cb.value) });
        });
        if (selectedCats.length > 0) await supabase.from('categorias_locais').insert(selectedCats);
        
        await supabase.from('fotos').delete().eq('locais_id', localId);
        const urlsText = document.getElementById('localImagensUrls')?.value || '';
        const lines = urlsText.split('\n').map(url => url.trim()).filter(url => url.length > 0);
        if (lines.length > 0) {
            const fotosInsert = lines.map(url => ({ locais_id: localId, url: url }));
            await supabase.from('fotos').insert(fotosInsert);
        }
    }
    showToast('Ponto turístico guardado!');
    closeModal();
    await loadLocais();
    updateDashboardCounts();
}

async function saveUser() {
    const fullName = document.getElementById('editUserName')?.value || '';
    const role = document.getElementById('editUserRole')?.value || 'user';
    const status = document.getElementById('editUserStatus')?.value || 'pending';
    await supabase.from('perfis').update({ nome_completo: fullName, role, status }).eq('id', currentEditId);
    showToast('Utilizador atualizado');
    closeModal();
    await loadUsers();
}

window.openModal = function(type) {
    if (type === 'categoria') {
        currentEditType = 'categoria';
        currentEditId = null;
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;
        modalBody.innerHTML = `
            <div class="modal-form-group"><label class="modal-label">Nome da categoria</label><input type="text" class="modal-input" id="catNome" placeholder="Ex: Histórico, Natureza..."></div>
            <div class="modal-row" style="display:flex; gap:15px;"><div class="modal-form-group" style="flex:1;"><label class="modal-label">Cor</label><input type="color" class="modal-input" id="catCor" style="height:42px" value="#979d23"></div><div class="modal-form-group" style="flex:1;"><label class="modal-label">Símbolo</label><input type="text" class="modal-input" id="catSimbolo" placeholder="🏰"></div></div>
        `;
        const modalTitle = document.getElementById('modalTitle');
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-tag"></i> Nova Categoria';
        if (modalOverlay) modalOverlay.classList.add('show');
    } else if (type === 'posto') {
        currentEditType = 'posto';
        currentEditId = null;
        currentLat = 38.4446;
        currentLng = -9.1016;
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;
        modalBody.innerHTML = `
            <div class="modal-form-group"><label class="modal-label">Nome do ponto</label><input type="text" class="modal-input" id="localNome" placeholder="Ex: Castelo de Sesimbra"></div>
            <div class="modal-form-group"><label class="modal-label">Descrição</label><textarea class="modal-textarea" id="localDescricao" placeholder="Descrição do ponto..."></textarea></div>
            <div class="modal-form-group"><label class="modal-label">URLs das Imagens (uma por linha)</label><textarea class="modal-textarea" id="localImagensUrls" rows="3" placeholder="https://url.com/imagem.jpg"></textarea></div>
            <div class="modal-form-group"><label class="modal-label">Categorias</label><div id="localCategoriasList" style="display:flex;flex-wrap:wrap;gap:8px"></div></div>
            <div class="modal-form-group"><label class="modal-label">Localização</label><div id="locationMapContainer" class="location-map-container"><div id="locationPickerMap" style="height:250px;"></div></div><div class="location-coords-display" style="display:flex; gap:20px; margin-top:10px;"><div class="coord-item">Lat: <span id="coordLatDisplay">38.4446</span></div><div class="coord-item">Lng: <span id="coordLngDisplay">-9.1016</span></div></div></div>
        `;
        setTimeout(() => {
            const container = document.getElementById('localCategoriasList');
            if (container) {
                container.innerHTML = categoriasList.map(cat => 
                    `<label style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:#f3f4f6;border-radius:20px; cursor:pointer;">
                        <input type="checkbox" value="${cat.id}"> 
                        <span>${escapeHtml(cat.simbolo || '')} ${escapeHtml(cat.nome)}</span>
                    </label>`
                ).join('');
            }
            initLocationPickerMap();
        }, 100);
        const modalTitle = document.getElementById('modalTitle');
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Novo Ponto Turístico';
        if (modalOverlay) modalOverlay.classList.add('show');
    }
};

window.closeModal = function() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) modalOverlay.classList.remove('show');
    currentEditId = null;
    currentEditType = null;
    if (locationMap) { 
        locationMap.remove(); 
        locationMap = null; 
    }
};

window.closeModalOutside = function(e) { 
    if (e.target.id === 'modalOverlay') closeModal(); 
};

// ==================== UTILITÁRIOS ====================
function formatDate(dateStr) { 
    if (!dateStr) return '-'; 
    return new Date(dateStr).toLocaleDateString('pt-PT'); 
}

function getStatusText(status) { 
    const statusMap = { active: 'Ativo', inactive: 'Inativo', pending: 'Pendente' }; 
    return statusMap[status] || status; 
}

function getInitials(name) { 
    if (!name) return 'U'; 
    const parts = name.split(' '); 
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase(); 
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase(); 
}

function escapeHtml(text) { 
    if (!text) return ''; 
    const div = document.createElement('div'); 
    div.textContent = text; 
    return div.innerHTML; 
}

function showToast(message, type = 'success') { 
    const toast = document.getElementById('toast'); 
    const toastMsg = document.getElementById('toastMsg'); 
    if (toastMsg) toastMsg.textContent = message; 
    if (toast) toast.classList.add('show'); 
    setTimeout(() => {
        if (toast) toast.classList.remove('show');
    }, 3000); 
}
