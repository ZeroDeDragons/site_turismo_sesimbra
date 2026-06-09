// src/paginaAdmin.js
import { supabase } from './supabaseClient.js';

// ==================== VARIÁVEIS GLOBAIS ====================
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

// Variáveis para o mapa de rotas com routing
let routeMap = null;
let routeMarkers = [];
let selectedPontosRota = [];
let allLocaisForMap = [];
let currentRouteLayer = null;
let currentRouteDistance = 0;
let currentRouteDuration = 0;

// Serviço de roteamento OSRM (gratuito)
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
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
    
    if (profile?.role !== 'admin') {
        window.location.href = 'index.html';
    }
}

function setupEventListeners() {
    document.getElementById('btnSair').addEventListener('click', logout);
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

// ==================== NAVEGAÇÃO ====================
window.showSection = function(section, element) {
    currentSection = section;
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (element) element.classList.add('active');
    
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`sec-${section}`).classList.add('active');
    
    const titles = {
        dashboard: 'Painel de Administração',
        utilizadores: 'Gestão de Utilizadores',
        rotas: 'Gestão de Rotas',
        postos: 'Gestão de Pontos Turísticos'
    };
    document.getElementById('topbarTitle').textContent = titles[section] || 'Administração';
    
    if (section === 'utilizadores') loadUsers();
    else if (section === 'rotas') loadRotas();
    else if (section === 'postos') loadLocais();
    else if (section === 'dashboard') { updateDashboardCounts(); loadLastUsers(); }
};

// ==================== DASHBOARD ====================
async function updateDashboardCounts() {
    try {
        const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: rotasCount } = await supabase.from('rotas').select('*', { count: 'exact', head: true });
        const { count: locaisCount } = await supabase.from('locais').select('*', { count: 'exact', head: true });
        const { count: catsCount } = await supabase.from('categorias').select('*', { count: 'exact', head: true });
        
        document.getElementById('statUsers').textContent = usersCount || 0;
        document.getElementById('statRotas').textContent = rotasCount || 0;
        document.getElementById('statPostos').textContent = locaisCount || 0;
        document.getElementById('statCats').textContent = catsCount || 0;
        
        const badge = document.querySelector('.nav-item[onclick*="utilizadores"] .nav-badge');
        if (badge) badge.textContent = usersCount || 0;
    } catch (error) { console.error('Erro ao carregar estatísticas:', error); }
}

async function loadLastUsers() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('full_name, email, created_at, status, role')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        const tbody = document.getElementById('dashLastUsers');
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhum utilizador registado</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(user => `
            <tr>
                <td>${user.full_name || 'N/A'}</td>
                <td>${user.email || 'N/A'}</td>
                <td>${formatDate(user.created_at)}</td>
                <td><span class="badge ${user.status === 'active' ? 'active' : 'inactive'}">${getStatusText(user.status)}</span></td>
            </tr>
        `).join('');
    } catch (error) { console.error('Erro ao carregar últimos utilizadores:', error); }
}

// ==================== UTILIZADORES ====================
async function loadUsers() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, status, created_at')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        window.allUsers = data || [];
        document.getElementById('userCount').textContent = window.allUsers.length;
        filterUsers();
    } catch (error) { console.error('Erro ao carregar utilizadores:', error); showToast('Erro ao carregar utilizadores', 'error'); }
}

window.filterUsers = function() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const roleFilter = document.getElementById('userRoleFilter').value;
    const statusFilter = document.getElementById('userStatusFilter').value;
    
    let filtered = window.allUsers || [];
    
    if (searchTerm) filtered = filtered.filter(user => (user.full_name && user.full_name.toLowerCase().includes(searchTerm)) || (user.email && user.email.toLowerCase().includes(searchTerm)));
    if (roleFilter) filtered = filtered.filter(user => user.role === roleFilter);
    if (statusFilter) filtered = filtered.filter(user => user.status === statusFilter);
    
    renderUserTable(filtered);
};

function renderUserTable(users) {
    const tbody = document.getElementById('userTable');
    if (!users || users.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum utilizador encontrado</td></tr>'; return; }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td><div class="td-name"><div class="td-avatar ${user.role === 'admin' ? 'green' : ''}">${getInitials(user.full_name || user.email)}</div><div><div class="td-main">${user.full_name || 'Sem nome'}</div><div class="td-sub">ID: ${user.id.slice(0,8)}...</div></div></div></td>
            <td>${user.email || '-'}</td>
            <td><span class="badge ${user.role === 'admin' ? 'admin' : 'user'}">${user.role === 'admin' ? 'Administrador' : 'Utilizador'}</span></td>
            <td><span class="badge ${user.status === 'active' ? 'active' : user.status === 'pending' ? 'pending' : 'inactive'}">${getStatusText(user.status)}</span></td>
            <td>${formatDate(user.created_at)}</td>
            <td class="td-actions"><button class="action-btn edit" onclick="editUser('${user.id}')" title="Editar"><i class="fas fa-edit"></i></button><button class="action-btn del" onclick="toggleUserStatus('${user.id}', '${user.status}')" title="${user.status === 'active' ? 'Desativar' : 'Ativar'}"><i class="fas ${user.status === 'active' ? 'fa-ban' : 'fa-check-circle'}"></i></button></td>
        </tr>
    `).join('');
}

window.editUser = async function(userId) {
    const user = window.allUsers.find(u => u.id === userId);
    if (!user) return;
    
    currentEditId = userId;
    currentEditType = 'user';
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="modal-form-group"><label class="modal-label">Nome completo</label><input type="text" class="modal-input" id="editUserName" value="${user.full_name || ''}"></div>
        <div class="modal-form-group"><label class="modal-label">Email</label><input type="email" class="modal-input" id="editUserEmail" value="${user.email || ''}" disabled></div>
        <div class="modal-form-group"><label class="modal-label">Perfil</label><select class="modal-select" id="editUserRole"><option value="user" ${user.role === 'user' ? 'selected' : ''}>Utilizador</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option></select></div>
        <div class="modal-form-group"><label class="modal-label">Estado</label><select class="modal-select" id="editUserStatus"><option value="active" ${user.status === 'active' ? 'selected' : ''}>Ativo</option><option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Inativo</option><option value="pending" ${user.status === 'pending' ? 'selected' : ''}>Pendente</option></select></div>
    `;
    
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-edit"></i> Editar Utilizador';
    document.getElementById('modalOverlay').classList.add('show');
};

window.toggleUserStatus = async function(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userId);
    if (error) { showToast('Erro ao alterar estado', 'error'); return; }
    showToast(`Utilizador ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso`);
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
        
        if (rotaCatFilter) rotaCatFilter.innerHTML = '<option value="">Todas as categorias</option>' + categoriasList.map(cat => `<option value="${cat.id}">${cat.nome}</option>`).join('');
        if (postoCatFilter) postoCatFilter.innerHTML = '<option value="">Todas as categorias</option>' + categoriasList.map(cat => `<option value="${cat.id}">${cat.nome}</option>`).join('');
    } catch (error) { console.error('Erro ao carregar categorias:', error); }
}

window.openModalCategoria = function() {
    currentEditType = 'categoria';
    currentEditId = null;
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="modal-form-group"><label class="modal-label">Nome da categoria</label><input type="text" class="modal-input" id="catNome" placeholder="Ex: Histórico, Natureza..."></div>
        <div class="modal-row"><div class="modal-form-group"><label class="modal-label">Cor (opcional)</label><input type="color" class="modal-input" id="catCor" style="height:42px" value="#979d23"></div><div class="modal-form-group"><label class="modal-label">Símbolo/Ícone (opcional)</label><input type="text" class="modal-input" id="catSimbolo" placeholder="🏰 🌲 ⛪"></div></div>
    `;
    
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-tag"></i> Nova Categoria';
    document.getElementById('modalOverlay').classList.add('show');
};

// ==================== PONTOS TURÍSTICOS ====================
async function loadLocais() {
    try {
        const { data, error } = await supabase.from('locais').select('*').order('nome');
        if (error) throw error;
        
        locaisList = data || [];
        allLocaisForMap = [...locaisList];
        document.getElementById('postoCount').textContent = locaisList.length;
        
        for (let local of locaisList) {
            const { data: cats } = await supabase.from('categorias_locais').select('categoria_id').eq('local_id', local.id);
            local.categorias = cats || [];
        }
        
        filterPostos();
    } catch (error) { console.error('Erro ao carregar locais:', error); }
}

window.filterPostos = function() {
    const searchTerm = document.getElementById('postoSearch').value.toLowerCase();
    const catFilter = parseInt(document.getElementById('postoCatFilter').value);
    
    let filtered = [...locaisList];
    if (searchTerm) filtered = filtered.filter(local => local.nome.toLowerCase().includes(searchTerm) || (local.descricao && local.descricao.toLowerCase().includes(searchTerm)));
    if (catFilter) filtered = filtered.filter(local => local.categorias && local.categorias.some(c => c.categoria_id === catFilter));
    
    renderPostosGrid(filtered);
};

function renderPostosGrid(locais) {
    const grid = document.getElementById('postoGrid');
    if (!locais || locais.length === 0) { grid.innerHTML = `<div class="empty"><i class="fas fa-map-marker-alt" style="font-size:48px"></i><p>Nenhum ponto turístico encontrado</p></div>`; return; }
    
    grid.innerHTML = locais.map(local => {
        const categoria = local.categorias && local.categorias.length > 0 ? categoriasList.find(c => c.id === local.categorias[0].categoria_id) : null;
        return `
            <div class="posto-card">
                <div class="posto-icon" style="background: ${categoria?.cor || '#e5e7eb'}20; color: ${categoria?.cor || '#979d23'}">${categoria?.simbolo || '📍'}</div>
                <div class="posto-info"><div class="posto-name">${escapeHtml(local.nome)}</div><div class="posto-cat">${categoria ? `<span style="color:${categoria.cor}">${categoria.simbolo || ''} ${categoria.nome}</span>` : 'Sem categoria'} <span>📍 ${local.latitude.toFixed(4)}, ${local.longitude.toFixed(4)}</span></div><div class="posto-desc">${local.descricao ? local.descricao.substring(0, 100) + (local.descricao.length > 100 ? '...' : '') : 'Sem descrição'}</div></div>
                <div class="posto-actions"><button class="action-btn edit" onclick="editLocal(${local.id})" title="Editar"><i class="fas fa-edit"></i></button><button class="action-btn del" onclick="deleteLocal(${local.id})" title="Eliminar"><i class="fas fa-trash"></i></button></div>
            </div>
        `;
    }).join('');
}

window.openModalPosto = function() {
    currentEditType = 'posto';
    currentEditId = null;
    currentLat = 38.4446;
    currentLng = -9.1016;
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="modal-form-group"><label class="modal-label">Nome do ponto</label><input type="text" class="modal-input" id="localNome" placeholder="Ex: Castelo de Sesimbra"></div>
        <div class="modal-form-group"><label class="modal-label">Descrição</label><textarea class="modal-textarea" id="localDescricao" placeholder="Descrição do ponto turístico..."></textarea></div>
        <div class="modal-form-group"><label class="modal-label">Categorias</label><div id="localCategoriasList" style="display:flex;flex-wrap:wrap;gap:8px"></div></div>
        <div class="modal-form-group"><label class="modal-label">Localização</label><div class="map-instruction"><i class="fas fa-info-circle"></i> Clique no mapa para definir a localização</div><div id="locationMapContainer" class="location-map-container"><div id="locationPickerMap" class="location-map"></div></div><div class="location-coords-display"><div class="coord-item"><i class="fas fa-map-pin"></i> <span id="coordLatDisplay">38.4446</span></div><div class="coord-item"><i class="fas fa-map-pin"></i> <span id="coordLngDisplay">-9.1016</span></div></div></div>
    `;
    
    setTimeout(() => {
        const container = document.getElementById('localCategoriasList');
        if (container) container.innerHTML = categoriasList.map(cat => `<label style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:#f3f4f6;border-radius:20px"><input type="checkbox" value="${cat.id}"> <span>${cat.simbolo || ''} ${cat.nome}</span></label>`).join('');
        initLocationPickerMap();
    }, 100);
    
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Novo Ponto Turístico';
    document.getElementById('modalOverlay').classList.add('show');
};

window.editLocal = async function(id) {
    const local = locaisList.find(l => l.id === id);
    if (!local) return;
    
    currentEditType = 'posto';
    currentEditId = id;
    currentLat = local.latitude;
    currentLng = local.longitude;
    
    const { data: localCats } = await supabase.from('categorias_locais').select('categoria_id').eq('local_id', id);
    const associatedCatIds = (localCats || []).map(lc => lc.categoria_id);
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="modal-form-group"><label class="modal-label">Nome do ponto</label><input type="text" class="modal-input" id="localNome" value="${escapeHtml(local.nome)}"></div>
        <div class="modal-form-group"><label class="modal-label">Descrição</label><textarea class="modal-textarea" id="localDescricao">${escapeHtml(local.descricao || '')}</textarea></div>
        <div class="modal-form-group"><label class="modal-label">Categorias</label><div id="localCategoriasList" style="display:flex;flex-wrap:wrap;gap:8px"></div></div>
        <div class="modal-form-group"><label class="modal-label">Localização</label><div class="map-instruction"><i class="fas fa-info-circle"></i> Clique no mapa para ajustar a localização</div><div id="locationMapContainer" class="location-map-container"><div id="locationPickerMap" class="location-map"></div></div><div class="location-coords-display"><div class="coord-item"><i class="fas fa-map-pin"></i> <span id="coordLatDisplay">${local.latitude.toFixed(6)}</span></div><div class="coord-item"><i class="fas fa-map-pin"></i> <span id="coordLngDisplay">${local.longitude.toFixed(6)}</span></div></div></div>
    `;
    
    setTimeout(() => {
        const container = document.getElementById('localCategoriasList');
        if (container) container.innerHTML = categoriasList.map(cat => `<label style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:#f3f4f6;border-radius:20px"><input type="checkbox" value="${cat.id}" ${associatedCatIds.includes(cat.id) ? 'checked' : ''}> <span>${cat.simbolo || ''} ${cat.nome}</span></label>`).join('');
        initLocationPickerMap(local.latitude, local.longitude);
    }, 100);
    
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Ponto Turístico';
    document.getElementById('modalOverlay').classList.add('show');
};

window.deleteLocal = async function(id) {
    if (!confirm('Tem certeza que deseja eliminar este ponto turístico?')) return;
    await supabase.from('categorias_locais').delete().eq('local_id', id);
    await supabase.from('segmentos_rota').delete().or(`local_origem_id.eq.${id},local_destino_id.eq.${id}`);
    const { error } = await supabase.from('locais').delete().eq('id', id);
    if (error) { showToast('Erro ao eliminar ponto', 'error'); return; }
    showToast('Ponto eliminado com sucesso');
    await loadLocais();
    updateDashboardCounts();
};

function initLocationPickerMap(lat = 38.4446, lng = -9.1016) {
    const mapContainer = document.getElementById('locationPickerMap');
    if (!mapContainer) return;
    if (locationMap) { locationMap.remove(); locationMap = null; }
    
    locationMap = L.map('locationPickerMap').setView([lat, lng], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB', subdomains: 'abcd', maxZoom: 19 }).addTo(locationMap);
    
    locationMarker = L.marker([lat, lng], { draggable: true }).addTo(locationMap);
    locationMarker.on('dragend', function(e) { const pos = e.target.getLatLng(); currentLat = pos.lat; currentLng = pos.lng; document.getElementById('coordLatDisplay').textContent = pos.lat.toFixed(6); document.getElementById('coordLngDisplay').textContent = pos.lng.toFixed(6); });
    locationMap.on('click', function(e) { currentLat = e.latlng.lat; currentLng = e.latlng.lng; locationMarker.setLatLng(e.latlng); document.getElementById('coordLatDisplay').textContent = e.latlng.lat.toFixed(6); document.getElementById('coordLngDisplay').textContent = e.latlng.lng.toFixed(6); });
    setTimeout(() => locationMap.invalidateSize(), 200);
}

// ==================== ROTAS COM ROTEAMENTO POR ESTRADAS ====================
async function loadRotas() {
    try {
        const { data, error } = await supabase.from('rotas').select('*').order('nome');
        if (error) throw error;
        
        rotasList = data || [];
        document.getElementById('rotaCount').textContent = rotasList.length;
        
        for (let rota of rotasList) {
            const { data: cats } = await supabase.from('categorias_rotas').select('categoria_id').eq('rota_id', rota.id);
            rota.categorias = cats || [];
            
            const { data: segs } = await supabase.from('segmentos_rota').select('*, local_origem_id, local_destino_id, ordem_segmento').eq('rota_id', rota.id).order('ordem_segmento');
            rota.segmentos = segs || [];
            
            // Calcular distância total da rota por estradas
            if (segs && segs.length > 0) {
                const pontos = [];
                const primeiroLocal = locaisList.find(l => l.id === segs[0].local_origem_id);
                if (primeiroLocal) pontos.push(primeiroLocal);
                for (const seg of segs) {
                    const localDestino = locaisList.find(l => l.id === seg.local_destino_id);
                    if (localDestino) pontos.push(localDestino);
                }
                if (pontos.length >= 2) {
                    const dist = await calculateRouteDistance(pontos);
                    rota.distancia_total = dist;
                }
            }
        }
        
        filterRotas();
    } catch (error) { console.error('Erro ao carregar rotas:', error); }
}

async function calculateRouteDistance(pontos) {
    if (pontos.length < 2) return 0;
    
    try {
        // Construir string de coordenadas para a API OSRM: "lng,lat;lng,lat;..."
        const coordinates = pontos.map(p => `${p.longitude},${p.latitude}`).join(';');
        const url = `${ROUTING_API}${coordinates}?overview=false&geometries=geojson`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
            // Distância em metros, converter para km
            return data.routes[0].distance / 1000;
        }
        return 0;
    } catch (error) {
        console.error('Erro ao calcular distância:', error);
        return 0;
    }
}

window.filterRotas = function() {
    const searchTerm = document.getElementById('rotaSearch').value.toLowerCase();
    const catFilter = parseInt(document.getElementById('rotaCatFilter').value);
    
    let filtered = [...rotasList];
    if (searchTerm) filtered = filtered.filter(rota => rota.nome.toLowerCase().includes(searchTerm) || (rota.descricao && rota.descricao.toLowerCase().includes(searchTerm)));
    if (catFilter) filtered = filtered.filter(rota => rota.categorias && rota.categorias.some(c => c.categoria_id === catFilter));
    
    renderRotasGrid(filtered);
};

function renderRotasGrid(rotas) {
    const grid = document.getElementById('routeGrid');
    if (!rotas || rotas.length === 0) { grid.innerHTML = `<div class="empty"><i class="fas fa-route" style="font-size:48px"></i><p>Nenhuma rota encontrada</p></div>`; return; }
    
    grid.innerHTML = rotas.map(rota => {
        const categoria = rota.categorias && rota.categorias.length > 0 ? categoriasList.find(c => c.id === rota.categorias[0].categoria_id) : null;
        const pontosCount = rota.segmentos ? rota.segmentos.length + 1 : 0;
        const distancia = rota.distancia_total ? rota.distancia_total.toFixed(1) : '?';
        
        return `
            <div class="route-card">
                <div class="route-img" style="background: ${categoria?.cor || '#979d23'}20"><div class="route-img-icon">${categoria?.simbolo || '🗺️'}</div></div>
                <div class="route-body">
                    <div class="route-name">${escapeHtml(rota.nome)}</div>
                    <div class="route-meta"><span><i class="fas fa-map-marker-alt"></i> ${pontosCount} pontos</span><span><i class="fas fa-road"></i> ${distancia} km</span><span><i class="fas fa-layer-group"></i> ${categoria?.nome || 'Sem categoria'}</span></div>
                    <div class="route-desc">${rota.descricao ? rota.descricao.substring(0, 80) + (rota.descricao.length > 80 ? '...' : '') : 'Sem descrição'}</div>
                    <div class="route-footer"><div class="route-actions"><button class="action-btn edit" onclick="openModalRota(${rota.id})" title="Editar"><i class="fas fa-edit"></i></button><button class="action-btn del" onclick="deleteRota(${rota.id})" title="Eliminar"><i class="fas fa-trash"></i></button></div></div>
                </div>
            </div>
        `;
    }).join('');
}

async function getRouteFromOSRM(pontos) {
    if (pontos.length < 2) return null;
    
    try {
        const coordinates = pontos.map(p => `${p.longitude},${p.latitude}`).join(';');
        const url = `${ROUTING_API}${coordinates}?overview=full&geometries=geojson&steps=true`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
            return {
                geometry: data.routes[0].geometry,
                distance: data.routes[0].distance / 1000,
                duration: data.routes[0].duration / 60,
                legs: data.routes[0].legs
            };
        }
        return null;
    } catch (error) {
        console.error('Erro ao obter rota do OSRM:', error);
        return null;
    }
}

function initRouteMap() {
    const mapContainer = document.getElementById('routeMap');
    if (!mapContainer) return;
    if (routeMap) { routeMap.remove(); routeMap = null; }
    
    routeMap = L.map('routeMap').setView([38.4446, -9.1016], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB', subdomains: 'abcd', maxZoom: 19 }).addTo(routeMap);
    
    loadAllPontosToMap();
    setTimeout(() => { if (routeMap) routeMap.invalidateSize(); }, 200);
}

async function loadAllPontosToMap() {
    try {
        routeMarkers.forEach(marker => { if (routeMap) marker.removeFrom(routeMap); });
        routeMarkers = [];
        
        allLocaisForMap.forEach(local => {
            const isSelected = selectedPontosRota.some(p => p.id === local.id);
            const icon = L.divIcon({ className: 'custom-marker', html: `<div style="background:${isSelected ? '#979d23' : 'white'}; color:${isSelected ? 'white' : '#979d23'}; border:2px solid #979d23; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; font-weight:bold; cursor:pointer; font-size:14px">${isSelected ? '✓' : (local.simbolo || '📍')}</div>`, iconSize: [30, 30], popupAnchor: [0, -15] });
            
            const marker = L.marker([local.latitude, local.longitude], { icon }).addTo(routeMap).bindPopup(`<div style="padding:8px"><strong>${escapeHtml(local.nome)}</strong><br><small>${local.descricao ? local.descricao.substring(0, 100) : 'Sem descrição'}</small><br><button onclick="togglePontoOnRoute(${local.id})" style="margin-top:8px; padding:4px 12px; background:#979d23; color:white; border:none; border-radius:6px; cursor:pointer">${isSelected ? 'Remover da rota' : 'Adicionar à rota'}</button></div>`);
            marker.localId = local.id;
            routeMarkers.push(marker);
        });
        
        await drawRouteOnMap();
    } catch (error) { console.error('Erro ao carregar pontos para o mapa:', error); }
}

async function drawRouteOnMap() {
    if (currentRouteLayer && routeMap) routeMap.removeLayer(currentRouteLayer);
    if (selectedPontosRota.length < 2) return;
    
    // Mostrar loading
    const statsEl = document.getElementById('routeStats');
    if (statsEl) statsEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A calcular rota pelas estradas...';
    
    try {
        const route = await getRouteFromOSRM(selectedPontosRota);
        
        if (route && route.geometry) {
            currentRouteLayer = L.geoJSON(route.geometry, {
                style: { color: document.getElementById('rotaCor')?.value || '#979d23', weight: 5, opacity: 0.9, lineJoin: 'round' }
            }).addTo(routeMap);
            
            currentRouteDistance = route.distance;
            currentRouteDuration = route.duration;
            
            const bounds = currentRouteLayer.getBounds();
            if (bounds.isValid()) routeMap.fitBounds(bounds.pad(0.1));
            
            updateRouteStats();
        } else {
            // Fallback: linha reta se o routing falhar
            const coordinates = selectedPontosRota.map(p => [p.latitude, p.longitude]);
            currentRouteLayer = L.polyline(coordinates, { color: document.getElementById('rotaCor')?.value || '#979d23', weight: 4, opacity: 0.8, dashArray: '10, 10' }).addTo(routeMap);
            currentRouteDistance = 0;
            currentRouteDuration = 0;
            updateRouteStats(true);
        }
    } catch (error) {
        console.error('Erro ao desenhar rota:', error);
        const coordinates = selectedPontosRota.map(p => [p.latitude, p.longitude]);
        currentRouteLayer = L.polyline(coordinates, { color: document.getElementById('rotaCor')?.value || '#979d23', weight: 4, opacity: 0.8, dashArray: '10, 10' }).addTo(routeMap);
        updateRouteStats(true);
    }
}

function updateRouteStats(fallback = false) {
    const statsEl = document.getElementById('routeStats');
    if (!statsEl) return;
    
    const totalPontos = selectedPontosRota.length;
    
    if (fallback || currentRouteDistance === 0) {
        statsEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${totalPontos} ${totalPontos === 1 ? 'ponto' : 'pontos'} | Distância: calculando... | ⚠️ Rota em linha reta (não segue estradas)`;
    } else {
        const horas = Math.floor(currentRouteDuration / 60);
        const minutos = Math.floor(currentRouteDuration % 60);
        const tempoStr = horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;
        
        statsEl.innerHTML = `<i class="fas fa-route"></i> ${totalPontos} ${totalPontos === 1 ? 'ponto' : 'pontos'} | <i class="fas fa-road"></i> ${currentRouteDistance.toFixed(1)} km | <i class="fas fa-clock"></i> ${tempoStr} | 🚗 Rota por estradas reais`;
    }
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
    if (index > 0) [selectedPontosRota[index - 1], selectedPontosRota[index]] = [selectedPontosRota[index], selectedPontosRota[index - 1]];
    renderPontosRotaListUI();
    await loadAllPontosToMap();
};

window.movePontoDown = async function(index) {
    if (index < selectedPontosRota.length - 1) [selectedPontosRota[index], selectedPontosRota[index + 1]] = [selectedPontosRota[index + 1], selectedPontosRota[index]];
    renderPontosRotaListUI();
    await loadAllPontosToMap();
};

function renderPontosRotaListUI() {
    const container = document.getElementById('rotaPontosList');
    if (!container) return;
    
    if (selectedPontosRota.length === 0) { container.innerHTML = '<div class="empty" style="padding:20px"><p>Nenhum ponto adicionado. Clique nos pontos do mapa para adicionar à rota.</p></div>'; return; }
    
    container.innerHTML = selectedPontosRota.map((ponto, idx) => `
        <div class="route-point-item">
            <div style="display:flex; align-items:center; flex:1"><span class="route-point-number">${idx + 1}</span><span class="route-point-name">${escapeHtml(ponto.nome)}</span><small style="color:#9ca3af; margin-left:8px">📍 ${ponto.latitude.toFixed(4)}, ${ponto.longitude.toFixed(4)}</small></div>
            <div style="display:flex; gap:4px"><button class="action-btn edit" onclick="movePontoUp(${idx})" title="Subir" ${idx === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button><button class="action-btn edit" onclick="movePontoDown(${idx})" title="Descer" ${idx === selectedPontosRota.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button><button class="action-btn del" onclick="removePontoFromRoute(${idx})" title="Remover"><i class="fas fa-trash"></i></button></div>
        </div>
    `).join('');
}

window.clearAllPontos = async function() {
    if (confirm('Tem certeza que deseja remover todos os pontos da rota?')) {
        selectedPontosRota = [];
        renderPontosRotaListUI();
        await loadAllPontosToMap();
        showToast('Todos os pontos foram removidos');
    }
};

window.openModalRota = function(rotaId = null) {
    currentEditType = 'rota';
    currentEditId = rotaId;
    selectedPontosRota = [];
    currentRouteDistance = 0;
    currentRouteDuration = 0;
    
    const modal = document.getElementById('modalRotaOverlay');
    const title = document.getElementById('modalRotaTitle');
    
    if (rotaId) {
        title.innerHTML = '<i class="fas fa-edit"></i> Editar Rota';
        loadRotaData(rotaId);
    } else {
        title.innerHTML = '<i class="fas fa-plus-circle"></i> Nova Rota';
        document.getElementById('rotaNome').value = '';
        document.getElementById('rotaDescricao').value = '';
        document.getElementById('rotaCor').value = '#979d23';
        const container = document.getElementById('rotaCategoriasList');
        if (container && categoriasList) container.innerHTML = categoriasList.map(cat => `<label style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:#f3f4f6;border-radius:20px"><input type="checkbox" value="${cat.id}"> <span>${cat.simbolo || ''} ${cat.nome}</span></label>`).join('');
    }
    
    modal.classList.add('show');
    setTimeout(() => initRouteMap(), 100);
};

async function loadRotaData(rotaId) {
    try {
        const rota = rotasList.find(r => r.id === rotaId);
        if (!rota) return;
        
        document.getElementById('rotaNome').value = rota.nome;
        document.getElementById('rotaDescricao').value = rota.descricao || '';
        document.getElementById('rotaCor').value = rota.cor || '#979d23';
        
        const { data: rotaCats } = await supabase.from('categorias_rotas').select('categoria_id').eq('rota_id', rotaId);
        const associatedCatIds = (rotaCats || []).map(rc => rc.categoria_id);
        
        const container = document.getElementById('rotaCategoriasList');
        if (container && categoriasList) container.innerHTML = categoriasList.map(cat => `<label style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:#f3f4f6;border-radius:20px"><input type="checkbox" value="${cat.id}" ${associatedCatIds.includes(cat.id) ? 'checked' : ''}> <span>${cat.simbolo || ''} ${cat.nome}</span></label>`).join('');
        
        const { data: segs } = await supabase.from('segmentos_rota').select('*, local_origem_id, local_destino_id').eq('rota_id', rotaId).order('ordem_segmento');
        
        const pontosRota = [];
        if (segs && segs.length > 0) {
            const primeiroLocal = allLocaisForMap.find(l => l.id === segs[0].local_origem_id);
            if (primeiroLocal) pontosRota.push(primeiroLocal);
            for (const seg of segs) {
                const localDestino = allLocaisForMap.find(l => l.id === seg.local_destino_id);
                if (localDestino) pontosRota.push(localDestino);
            }
        }
        
        selectedPontosRota = pontosRota;
        renderPontosRotaListUI();
    } catch (error) { console.error('Erro ao carregar dados da rota:', error); }
}

window.saveRotaFromModal = async function() {
    const nome = document.getElementById('rotaNome')?.value.trim();
    if (!nome) { showToast('Nome da rota é obrigatório', 'warning'); return; }
    if (selectedPontosRota.length < 2) { showToast('A rota deve ter pelo menos 2 pontos', 'warning'); return; }
    
    const data = { nome, descricao: document.getElementById('rotaDescricao')?.value || null, cor: document.getElementById('rotaCor')?.value || '#979d23' };
    
    let rotaId = currentEditId;
    let result;
    
    if (currentEditId) result = await supabase.from('rotas').update(data).eq('id', currentEditId);
    else { result = await supabase.from('rotas').insert([data]).select(); if (result.data && result.data[0]) rotaId = result.data[0].id; }
    
    if (result.error) { showToast('Erro ao guardar rota', 'error'); return; }
    
    if (rotaId) {
        await supabase.from('categorias_rotas').delete().eq('rota_id', rotaId);
        const selectedCats = [];
        document.querySelectorAll('#rotaCategoriasList input:checked').forEach(cb => selectedCats.push({ rota_id: rotaId, categoria_id: parseInt(cb.value) }));
        if (selectedCats.length > 0) await supabase.from('categorias_rotas').insert(selectedCats);
        
        await supabase.from('segmentos_rota').delete().eq('rota_id', rotaId);
        const segmentos = [];
        for (let i = 0; i < selectedPontosRota.length - 1; i++) segmentos.push({ rota_id: rotaId, local_origem_id: selectedPontosRota[i].id, local_destino_id: selectedPontosRota[i + 1].id, ordem_segmento: i + 1 });
        if (segmentos.length > 0) await supabase.from('segmentos_rota').insert(segmentos);
    }
    
    showToast(`Rota ${currentEditId ? 'atualizada' : 'criada'} com sucesso`);
    closeModalRota();
    await loadRotas();
    updateDashboardCounts();
};

window.deleteRota = async function(id) {
    if (!confirm('Tem certeza que deseja eliminar esta rota?')) return;
    await supabase.from('segmentos_rota').delete().eq('rota_id', id);
    await supabase.from('categorias_rotas').delete().eq('rota_id', id);
    const { error } = await supabase.from('rotas').delete().eq('id', id);
    if (error) { showToast('Erro ao eliminar rota', 'error'); return; }
    showToast('Rota eliminada com sucesso');
    await loadRotas();
    updateDashboardCounts();
};

window.closeModalRota = function() {
    const modal = document.getElementById('modalRotaOverlay');
    modal.classList.remove('show');
    currentEditId = null;
    currentEditType = null;
    selectedPontosRota = [];
    if (routeMap) { routeMap.remove(); routeMap = null; }
};

window.closeModalRotaOutside = function(event) { if (event.target === document.getElementById('modalRotaOverlay')) closeModalRota(); };

// ==================== MODAL SAVE ====================
window.saveModal = async function() {
    if (currentEditType === 'categoria') await saveCategoria();
    else if (currentEditType === 'posto') await saveLocal();
    else if (currentEditType === 'user') await saveUser();
};

async function saveCategoria() {
    const nome = document.getElementById('catNome')?.value.trim();
    if (!nome) { showToast('Nome da categoria é obrigatório', 'warning'); return; }
    
    const data = { nome, cor: document.getElementById('catCor')?.value || null, simbolo: document.getElementById('catSimbolo')?.value || null };
    let result;
    if (currentEditId) result = await supabase.from('categorias').update(data).eq('id', currentEditId);
    else result = await supabase.from('categorias').insert([data]);
    
    if (result.error) { showToast('Erro ao guardar categoria', 'error'); return; }
    showToast(`Categoria ${currentEditId ? 'atualizada' : 'criada'} com sucesso`);
    closeModal();
    await loadCategorias();
    await loadLocais();
    await loadRotas();
    updateDashboardCounts();
}

async function saveLocal() {
    const nome = document.getElementById('localNome')?.value.trim();
    if (!nome) { showToast('Nome do ponto é obrigatório', 'warning'); return; }
    if (currentLat === null || currentLng === null) { showToast('Selecione a localização no mapa', 'warning'); return; }
    
    const data = { nome, descricao: document.getElementById('localDescricao')?.value || null, latitude: currentLat, longitude: currentLng };
    let localId = currentEditId;
    let result;
    
    if (currentEditId) result = await supabase.from('locais').update(data).eq('id', currentEditId);
    else { result = await supabase.from('locais').insert([data]).select(); if (result.data && result.data[0]) localId = result.data[0].id; }
    
    if (result.error) { showToast('Erro ao guardar ponto', 'error'); return; }
    
    if (localId) {
        await supabase.from('categorias_locais').delete().eq('local_id', localId);
        const selectedCats = [];
        document.querySelectorAll('#localCategoriasList input:checked').forEach(cb => selectedCats.push({ local_id: localId, categoria_id: parseInt(cb.value) }));
        if (selectedCats.length > 0) await supabase.from('categorias_locais').insert(selectedCats);
    }
    
    showToast(`Ponto ${currentEditId ? 'atualizado' : 'criado'} com sucesso`);
    closeModal();
    await loadLocais();
    updateDashboardCounts();
}

async function saveUser() {
    const fullName = document.getElementById('editUserName')?.value.trim();
    const role = document.getElementById('editUserRole')?.value;
    const status = document.getElementById('editUserStatus')?.value;
    
    const { error } = await supabase.from('profiles').update({ full_name: fullName || null, role, status }).eq('id', currentEditId);
    if (error) { showToast('Erro ao atualizar utilizador', 'error'); return; }
    showToast('Utilizador atualizado com sucesso');
    closeModal();
    await loadUsers();
    updateDashboardCounts();
}

// ==================== MODAL UTILS ====================
window.openModal = function(type) {
    if (type === 'categoria') openModalCategoria();
    else if (type === 'posto') openModalPosto();
    else if (type === 'rota') openModalRota();
};

window.closeModal = function() {
    document.getElementById('modalOverlay').classList.remove('show');
    currentEditId = null;
    currentEditType = null;
    if (locationMap) { locationMap.remove(); locationMap = null; }
};

window.closeModalOutside = function(event) { if (event.target === document.getElementById('modalOverlay')) closeModal(); };

// ==================== UTILITÁRIOS ====================
function formatDate(dateStr) { if (!dateStr) return '-'; return new Date(dateStr).toLocaleDateString('pt-PT'); }
function getStatusText(status) { const statusMap = { active: 'Ativo', inactive: 'Inativo', pending: 'Pendente' }; return statusMap[status] || status; }
function getInitials(name) { if (!name) return 'U'; const parts = name.split(' '); if (parts.length === 1) return parts[0].charAt(0).toUpperCase(); return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase(); }
function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function showToast(message, type = 'success') { const toast = document.getElementById('toast'); const toastMsg = document.getElementById('toastMsg'); toastMsg.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
