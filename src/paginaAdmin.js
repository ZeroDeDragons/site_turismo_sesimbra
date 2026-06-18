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

let routeMap = null;
let routeMarkers = [];
let selectedPontosRota = [];
let allLocaisForMap = [];
let currentRouteLayerGroup = null;

let currentRouteDistance = 0;
let currentRouteDuration = 0;
let currentTransportMode = 'driving';

const ROUTING_API_BASE = 'https://router.project-osrm.org/route/v1/';
let cacheLinhasCarris = null;

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadCategorias();
    await loadLocais();
    await loadRotas();
    await loadUsers();
    updateDashboardCounts();
    setupEventListeners();
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
        const { data, error } = await supabase.from('profiles').select('full_name, email, created_at, status, role').order('created_at', { ascending: false }).limit(5);
        if (error) throw error;
        const tbody = document.getElementById('dashLastUsers');
        if (!tbody) return;
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhum utilizador registado</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(user => `
            <tr>
                <td>${escapeHtml(user.full_name || 'N/A')}</td>
                <td>${escapeHtml(user.email || 'N/A')}</td>
                <td>${formatDate(user.created_at)}</td>
                <td><span class="badge ${user.status === 'active' ? 'active' : 'inactive'}">${getStatusText(user.status)}</span></td>
            </tr>
        `).join('');
    } catch (error) { 
        console.error('Erro ao carregar últimos utilizadores:', error); 
    }
}

// ==================== CARRIS METROPOLITANA ====================
function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function getLinhasCarris() {
    if (cacheLinhasCarris) return cacheLinhasCarris;
    try {
        const response = await fetch('https://api.carrismetropolitana.pt/v2/lines');
        const linhas = await response.json();
        cacheLinhasCarris = {};
        if (Array.isArray(linhas)) {
            linhas.forEach(l => {
                cacheLinhasCarris[l.id] = { short_name: l.short_name, long_name: l.long_name, color: l.color };
            });
        }
        return cacheLinhasCarris;
    } catch (error) {
        console.error('Erro ao buscar linhas da Carris:', error);
        return {};
    }
}

async function getCarrisMetropolitanaData(lat, lng) {
    try {
        const response = await fetch('https://api.carrismetropolitana.pt/v2/stops');
        if (!response.ok) throw new Error('Falha ao obter paragens');
        const todasParagens = await response.json();

        if (!Array.isArray(todasParagens) || todasParagens.length === 0) {
            return "<br>🚌 <b>Autocarros:</b> Sem dados de paragens disponíveis de momento.";
        }

        const RAIO_MAX_METROS = 400;
        const paragensComDistancia = todasParagens
            .map(p => ({
                ...p,
                distancia: calcularDistanciaMetros(lat, lng, p.lat, p.lon)
            }))
            .filter(p => p.distancia <= RAIO_MAX_METROS)
            .sort((a, b) => a.distancia - b.distancia);

        if (paragensComDistancia.length === 0) {
            return "<br>🚌 <b>Autocarros:</b> Nenhuma paragem da Carris Metropolitana num raio de 400m.";
        }

        const paragem = paragensComDistancia[0];
        const lineIds = Array.isArray(paragem.line_ids) ? [...new Set(paragem.line_ids)] : [];
        const linhasInfo = await getLinhasCarris();
        const linhasStr = lineIds.length > 0
            ? lineIds.map(id => linhasInfo[id]?.short_name || id).join(', ')
            : 'sem linhas associadas';

        let horariosHtml = '';
        try {
            const realtimeRes = await fetch(`https://api.carrismetropolitana.pt/v2/stops/${paragem.id}/realtime`);
            if (realtimeRes.ok) {
                const arrivals = await realtimeRes.json();
                if (Array.isArray(arrivals) && arrivals.length > 0) {
                    const agora = Date.now() / 1000;
                    const proximos = arrivals
                        .filter(a => (a.estimated_arrival_unix || a.scheduled_arrival_unix) >= agora)
                        .sort((a, b) => (a.estimated_arrival_unix || a.scheduled_arrival_unix) - (b.estimated_arrival_unix || b.scheduled_arrival_unix))
                        .slice(0, 3);

                    if (proximos.length > 0) {
                        horariosHtml = '<div style="margin-top:6px;"><b>Próximas passagens:</b><br>' +
                            proximos.map(a => {
                                const linhaInfo = linhasInfo[a.line_id] || {};
                                const tsFinal = a.estimated_arrival_unix || a.scheduled_arrival_unix;
                                const minutosFaltam = Math.round((tsFinal - agora) / 60);
                                return `🚌 ${escapeHtml(linhaInfo.short_name || a.line_id)} → ${escapeHtml(a.headsign || '')} — ${minutosFaltam <= 0 ? 'a chegar' : `${minutosFaltam} min`}`;
                            }).join('<br>') +
                            '</div>';
                    }
                }
            }
        } catch (e) {}

        return `
            <hr style="margin: 8px 0; border: 0; border-top: 1px dashed #ccc;">
            <div style="font-size:12px;">
                <b>Paragem mais próxima:</b> ${escapeHtml(paragem.name || paragem.id)} (${Math.round(paragem.distancia)}m a pé)<br>
                🚌 <b>Linhas:</b> ${escapeHtml(linhasStr)}
                ${horariosHtml}
            </div>
        `;
    } catch (error) {
        console.error("Erro ao buscar dados da Carris Metropolitana:", error);
        return "<br>🚌 <b>Autocarros:</b> Erro ao carregar dados da Carris Metropolitana.";
    }
}

// ==================== UTILIZADORES ====================
async function loadUsers() {
    try {
        const { data, error } = await supabase.from('profiles').select('id, email, full_name, role, status, created_at').order('created_at', { ascending: false });
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
            (user.full_name && user.full_name.toLowerCase().includes(searchTerm)) || 
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
            <td><div class="td-name"><div class="td-avatar ${user.role === 'admin' ? 'green' : ''}">${getInitials(user.full_name || user.email)}</div><div><div class="td-main">${escapeHtml(user.full_name || 'Sem nome')}</div><div class="td-sub">ID: ${user.id.slice(0,8)}...</div></div></div></td>
            <td>${escapeHtml(user.email || '-')}</td>
            <td><span class="badge ${user.role === 'admin' ? 'admin' : 'user'}">${user.role === 'admin' ? 'Administrador' : 'Utilizador'}</span></td>
            <td><span class="badge ${user.status === 'active' ? 'active' : user.status === 'pending' ? 'pending' : 'inactive'}">${getStatusText(user.status)}</span></td>
            <td>${formatDate(user.created_at)}</td>
            <td class="td-actions">
                <button class="action-btn edit" onclick="toggleAdmin('${user.id}', '${user.role}')" title="${user.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}"><i class="fas ${user.role === 'admin' ? 'fa-user-shield' : 'fa-user'}"></i></button>
                <button class="action-btn del" onclick="deleteUser('${user.id}')" title="Apagar"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.toggleAdmin = async function(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const acaoTexto = newRole === 'admin' ? 'tornar este utilizador Administrador' : 'remover o estatuto de Administrador deste utilizador';
    if (!confirm(`Tem a certeza que quer ${acaoTexto}?`)) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) {
        showToast('Erro ao alterar perfil', 'error');
        return;
    }
    showToast('Perfil de utilizador atualizado');
    await loadUsers();
};

window.deleteUser = async function(userId) {
    if (!confirm('Tem a certeza que quer apagar este utilizador? Esta ação é irreversível.')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) {
        showToast('Erro ao apagar utilizador', 'error');
        return;
    }
    showToast('Utilizador apagado com sucesso');
    await loadUsers();
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
            const { data: imgs } = await supabase.from('fotos').select('id, nome, descricao, url, criado_em').eq('locais_id', local.id);
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
                    <div class="posto-icon" style="position: absolute; top: 10px; left: 10px; background: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.15); color: ${escapeHtml(local.cor || categoria?.cor || '#979d23')}">${escapeHtml(categoria?.simbolo || '📍')}</div>
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

// ==================== FUNÇÃO DE UPLOAD PARA SUPABASE STORAGE (MELHORADA) ====================
// Compress image file to target max size (KB) using canvas
async function comprimirImagemParaUpload(file, maxSizeKB = 500) {
    if (!file || !file.type.startsWith('image/')) return file;

    const loadImage = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const image = await loadImage(file);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let width = image.width;
    let height = image.height;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);

    const toBlob = (quality) => new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));

    let quality = 0.92;
    let blob = await toBlob(quality);

    // If already under limit, return as File
    if (blob && (blob.size / 1024) <= maxSizeKB) {
        return new File([blob], (file.name || 'image') .replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    }

    // Try reducing quality first
    while (quality > 0.4) {
        quality -= 0.07;
        blob = await toBlob(quality);
        if (blob && (blob.size / 1024) <= maxSizeKB) {
            return new File([blob], (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
        }
    }

    // If still too large, progressively scale down dimensions
    let scale = 0.9;
    while (scale > 0.2) {
        width = Math.round(image.width * scale);
        height = Math.round(image.height * scale);
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);
        quality = 0.85;
        blob = await toBlob(quality);
        if (blob && (blob.size / 1024) <= maxSizeKB) {
            return new File([blob], (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
        }
        // reduce quality on this scale too
        while (quality > 0.45) {
            quality -= 0.08;
            blob = await toBlob(quality);
            if (blob && (blob.size / 1024) <= maxSizeKB) {
                return new File([blob], (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
            }
        }
        scale -= 0.1;
    }

    // Fallback: return the last generated blob as File (might be larger than target)
    if (blob) return new File([blob], (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    return file;
}

async function uploadImagemParaSupabase(file, localId) {
    try {
        // Verificar autenticação antes de tentar upload
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('Utilizador não autenticado. Faça login novamente.');
        }

        // Comprimir a imagem para < 500 KB
        const imagemComprimida = await comprimirImagemParaUpload(file);
        
        // Gerar nome único para a imagem no Storage
        const timestamp = Date.now();
        const nomeLimpo = file.name
            .replace(/\.[^.]+$/, '')
            .substring(0, 30)
            .replace(/[^a-zA-Z0-9]/g, '_');
        const nomeUnico = `locais/${localId}/${timestamp}_${nomeLimpo}.jpg`;
        
        console.log(`📤 A fazer upload de: ${nomeUnico} (${(imagemComprimida.size / 1024).toFixed(0)} KB)`);
        
        // Upload para o Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('fotos-guiasesimbra')
            .upload(nomeUnico, imagemComprimida, {
                cacheControl: '3600',
                upsert: false,
                contentType: 'image/jpeg'
            });
        
        if (uploadError) {
            console.error('Erro detalhado do upload:', uploadError);
            
            // Verificar se o erro é de permissão
            if (uploadError.message.includes('row-level security policy') || 
                uploadError.message.includes('permission denied')) {
                throw new Error('Permissão negada. Verifique as políticas RLS do bucket "fotos-guiasesimbra".');
            }
            
            throw new Error(uploadError.message);
        }
        
        // Obter a URL pública da imagem
        const { data: publicUrlData } = supabase.storage
            .from('fotos-guiasesimbra')
            .getPublicUrl(nomeUnico);
        
        console.log(`✅ Upload concluído: ${publicUrlData.publicUrl}`);
        return publicUrlData.publicUrl;
        
    } catch (error) {
        console.error('Erro no upload da imagem:', error);
        throw error;
    }
}



// ==================== EDITAR LOCAL (COM UPLOAD DE IMAGENS) ====================
window.editLocal = async function(id) {
    const local = locaisList.find(l => l.id === id);
    if (!local) return;
    
    currentEditType = 'posto';
    currentEditId = id;
    currentLat = local.latitude;
    currentLng = local.longitude;
    
    const associatedCatIds = (local.categorias || []).map(lc => lc.categoria_id);
    
    // Buscar imagens existentes
    const { data: imagensExistentes } = await supabase
        .from('fotos')
        .select('*')
        .eq('locais_id', id);
    
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;
    
    // Gerar HTML das imagens existentes
    let imagensHtml = '';
    if (imagensExistentes && imagensExistentes.length > 0) {
        imagensHtml = imagensExistentes.map(img => `
            <div class="imagem-item" data-id="${img.id}" style="display:inline-block; margin:5px; position:relative; border:1px solid #e5e7eb; border-radius:8px; padding:5px; background:white; width:100px; text-align:center;">
                <img src="${escapeHtml(img.url)}" style="width:80px; height:80px; object-fit:cover; border-radius:4px;">
                <div style="font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:90px;">${escapeHtml(img.nome || '')}</div>
                <button type="button" onclick="removerImagemExistente(${img.id}, ${id})" style="position:absolute; top:-5px; right:-5px; background:#ef4444; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:10px; display:flex; align-items:center; justify-content:center;">×</button>
            </div>
        `).join('');
    }
    
    modalBody.innerHTML = `
        <div class="modal-form-group">
            <label class="modal-label">Nome do ponto</label>
            <input type="text" class="modal-input" id="localNome" value="${escapeHtml(local.nome)}">
        </div>
        <div class="modal-form-group">
            <label class="modal-label">Descrição</label>
            <textarea class="modal-textarea" id="localDescricao">${escapeHtml(local.descricao || '')}</textarea>
        </div>
        <div class="modal-form-group">
            <label class="modal-label">Cor do marcador no mapa</label>
            <input type="color" class="modal-input" id="localCor" style="height:42px; width:100%" value="${escapeHtml(local.cor || '#979d23')}">
        </div>
        <div class="modal-form-group">
            <label class="modal-label">Categorias</label>
            <div id="localCategoriasList" style="display:flex;flex-wrap:wrap;gap:8px"></div>
        </div>
        <div class="modal-form-group">
            <label class="modal-label">Imagens existentes</label>
            <div id="imagensExistentesContainer" style="display:flex; flex-wrap:wrap; gap:5px; margin-top:5px;">
                ${imagensHtml || '<span style="color:#9ca3af; font-size:13px;">Nenhuma imagem associada.</span>'}
            </div>
        </div>
        <div class="modal-form-group">
            <label class="modal-label">Adicionar novas imagens</label>
            <input type="file" id="novasImagens" accept="image/*" multiple style="display:block; margin-top:5px; padding:8px; border:1px dashed #d1d5db; border-radius:8px; width:100%;">
            <div style="font-size:12px; color:#6b7280; margin-top:4px;">Selecione uma ou mais imagens. Serão comprimidas automaticamente para menos de 500 KB.</div>
            <div id="previewNovasImagens" style="display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; min-height:40px;"></div>
        </div>
        <div class="modal-form-group">
            <label class="modal-label">Buscar localização</label>
            <div class="search-bar-container" style="margin-bottom: 12px;"><div class="search-bar-wrapper"><div class="search-input-group"><i class="fas fa-search search-icon"></i><input type="text" id="admin-point-search-input" placeholder="Pesquisar lugar em Sesimbra..." class="search-input"><button id="admin-point-search-btn" class="search-btn-action"><i class="fas fa-arrow-right"></i></button></div><div id="admin-point-search-results-dropdown" class="search-results-dropdown" style="display: none;"><div class="search-results-list"></div></div></div></div>
        </div>
        <div class="modal-form-group">
            <label class="modal-label">Localização</label>
            <div id="locationMapContainer" class="location-map-container">
                <div id="locationPickerMap" style="height:250px;"></div>
            </div>
            <div class="location-coords-display" style="display:flex; gap:20px; margin-top:10px;">
                <div class="coord-item">Lat: <span id="coordLatDisplay">${local.latitude.toFixed(6)}</span></div>
                <div class="coord-item">Lng: <span id="coordLngDisplay">${local.longitude.toFixed(6)}</span></div>
            </div>
        </div>
    `;
    
    // Preencher categorias e inicializar mapa
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
        configurarPesquisaPonto(locationMap);
        
        // Preview das novas imagens
        const inputImagens = document.getElementById('novasImagens');
        if (inputImagens) {
            inputImagens.addEventListener('change', function(e) {
                const previewContainer = document.getElementById('previewNovasImagens');
                if (!previewContainer) return;
                previewContainer.innerHTML = '';
                const files = Array.from(e.target.files);
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const div = document.createElement('div');
                        div.style.cssText = 'position:relative; display:inline-block; margin:3px;';
                        div.innerHTML = `
                            <img src="${event.target.result}" style="width:80px; height:80px; object-fit:cover; border-radius:4px; border:2px solid #979d23;">
                            <span style="position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,0.7); color:white; font-size:10px; padding:1px 4px; border-radius:4px;">${(file.size / 1024).toFixed(0)} KB</span>
                        `;
                        previewContainer.appendChild(div);
                    };
                    reader.readAsDataURL(file);
                });
            });
        }
    }, 100);
    
    const modalTitle = document.getElementById('modalTitle');
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Ponto Turístico';
    if (modalOverlay) modalOverlay.classList.add('show');
};

// ==================== REMOVER IMAGEM EXISTENTE ====================
window.removerImagemExistente = async function(fotoId, localId) {
    if (!confirm('Tem certeza que deseja remover esta imagem?')) return;
    
    const { error } = await supabase
        .from('fotos')
        .delete()
        .eq('id', fotoId);
    
    if (error) {
        showToast('Erro ao remover imagem', 'error');
        return;
    }
    
    showToast('Imagem removida com sucesso');
    await editLocal(localId);
};

// ==================== SALVAR LOCAL (COM UPLOAD DE IMAGENS) ====================
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
        cor: document.getElementById('localCor')?.value || '#979d23',
        latitude: currentLat, 
        longitude: currentLng 
    };
    
    let localId = currentEditId;
    
    // Salvar ou atualizar o local
    if (currentEditId) {
        const { error } = await supabase.from('locais').update(data).eq('id', currentEditId);
        if (error) {
            showToast('Erro ao atualizar local: ' + error.message, 'error');
            return;
        }
    } else {
        const res = await supabase.from('locais').insert([data]).select();
        if (res.error) {
            showToast('Erro ao criar local: ' + res.error.message, 'error');
            return;
        }
        if (res.data) localId = res.data[0].id;
    }
    
    if (!localId) {
        showToast('Erro ao obter ID do local', 'error');
        return;
    }
    
    // Atualizar categorias
    await supabase.from('categorias_locais').delete().eq('local_id', localId);
    const selectedCats = [];
    document.querySelectorAll('#localCategoriasList input:checked').forEach(cb => {
        selectedCats.push({ local_id: localId, categoria_id: parseInt(cb.value) });
    });
    if (selectedCats.length > 0) {
        await supabase.from('categorias_locais').insert(selectedCats);
    }
    
    // Processar novas imagens
    const inputImagens = document.getElementById('novasImagens');
    if (inputImagens && inputImagens.files.length > 0) {
        showToast('A processar imagens...', 'info');
        
        const files = Array.from(inputImagens.files);
        let imagensUploaded = 0;
        let imagensComErro = 0;
        
        for (const file of files) {
            try {
                if (!file.type.startsWith('image/')) {
                    imagensComErro++;
                    continue;
                }
                
                // Upload da imagem comprimida
                const urlPublica = await uploadImagemParaSupabase(file, localId);
                
                // Salvar a URL na tabela fotos
                const { error: insertError } = await supabase
                    .from('fotos')
                    .insert([{
                        locais_id: localId,
                        url: urlPublica,
                        nome: file.name,
                        descricao: 'Imagem carregada automaticamente'
                    }]);
                
                if (insertError) {
                    console.error('Erro ao salvar URL da foto:', insertError);
                    imagensComErro++;
                    continue;
                }
                
                imagensUploaded++;
                
            } catch (erro) {
                console.error('Erro ao processar imagem:', erro);
                imagensComErro++;
            }
        }
        
        let mensagem = `Local guardado! ${imagensUploaded} imagem(ens) enviada(s).`;
        if (imagensComErro > 0) {
            mensagem += ` ${imagensComErro} falha(s) no upload.`;
        }
        showToast(mensagem, imagensComErro > 0 ? 'warning' : 'success');
        
    } else {
        showToast('Ponto turístico guardado com sucesso!');
    }
    
    closeModal();
    await loadLocais();
    updateDashboardCounts();
}

// ==================== DELETAR LOCAL ====================
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

// ==================== MAPA DE LOCALIZAÇÃO ====================
function initLocationPickerMap(lat = 38.4446, lng = -9.1016) {
    if (locationMap) { 
        locationMap.remove(); 
        locationMap = null; 
    }
    locationMap = L.map('locationPickerMap').setView([lat, lng], 15);
    
    const camadaRuas = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { 
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>' 
    }).addTo(locationMap);
    
    const camadaSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri'
    });
    
    L.control.layers({
        'Mapa': camadaRuas,
        'Satélite': camadaSatelite
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

// ==================== MODAL ROTA ====================
window.openModalRota = function(rotaId = null) {
    currentEditType = 'rota';
    currentEditId = rotaId;
    selectedPontosRota = [];
    currentTransportMode = 'driving';
    
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
    setTimeout(() => {
        document.querySelectorAll('.transport-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === 'driving'));
        initRouteMap();
    }, 200);
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

// ==================== MAPA DE ROTAS ====================
function initRouteMap() {
    if (routeMap) { 
        routeMap.remove(); 
        routeMap = null; 
    }
    routeMap = L.map('routeMap').setView([38.4446, -9.1016], 13);
    
    const camadaRuas = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { 
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>' 
    }).addTo(routeMap);
    
    const camadaSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri'
    });
    
    L.control.layers({
        'Mapa': camadaRuas,
        'Satélite': camadaSatelite
    }).addTo(routeMap);
    
    currentRouteLayerGroup = L.layerGroup().addTo(routeMap);
    loadAllPontosToMap();
}

function configurarPesquisaAdmin(map) {
    window.adminRouteMap = map;

    async function searchPlaces(query) {
        const resultsDiv = document.getElementById('admin-route-search-results-dropdown');
        const resultsList = document.querySelector('#admin-route-search-results-dropdown .search-results-list');
        if (!query || query.length < 3) {
            if (resultsDiv) resultsDiv.style.display = 'none';
            return;
        }

        try {
            const viewbox = '-9.28,38.56,-9.03,38.35';
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&viewbox=${viewbox}&bounded=1&countrycodes=pt`;
            const resp = await fetch(url, { headers: { 'Accept-Language': 'pt-PT,pt;q=0.9' } });
            const data = await resp.json();

            if (data && data.length) {
                resultsList.innerHTML = '';
                data.forEach(r => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.innerHTML = `
                        <div class="search-result-name">${r.display_name.split(',')[0]}</div>
                        <div class="search-result-address">${r.display_name.split(',').slice(1, 4).join(',')}</div>
                    `;
                    item.addEventListener('click', () => {
                        const lat = parseFloat(r.lat);
                        const lng = parseFloat(r.lon);
                        if (!isNaN(lat) && !isNaN(lng) && window.adminRouteMap) {
                            window.adminRouteMap.flyTo([lat, lng], 15);
                            if (window.tempAdminSearchMarker) window.tempAdminSearchMarker.remove();
                            window.tempAdminSearchMarker = L.marker([lat, lng]).addTo(window.adminRouteMap);
                            window.tempAdminSearchMarker.bindPopup(r.display_name.split(',')[0]).openPopup();
                            setTimeout(() => {
                                if (window.tempAdminSearchMarker) {
                                    window.tempAdminSearchMarker.remove();
                                    window.tempAdminSearchMarker = null;
                                }
                            }, 5000);
                        }
                        if (resultsDiv) resultsDiv.style.display = 'none';
                        const input = document.getElementById('admin-route-search-input');
                        if (input) input.value = r.display_name.split(',')[0];
                    });
                    resultsList.appendChild(item);
                });
                resultsDiv.style.display = 'block';
            } else {
                resultsList.innerHTML = '<div class="search-result-item" style="color:#888">Nenhum resultado encontrado</div>';
                resultsDiv.style.display = 'block';
            }
        } catch (e) {
            console.error('Erro na pesquisa de locais (admin):', e);
        }
    }

    const searchInput = document.getElementById('admin-route-search-input');
    const searchBtn = document.getElementById('admin-route-search-btn');
    let timeout;

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => searchPlaces(searchInput.value), 500);
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => searchPlaces(searchInput?.value || ''));
    }

    document.addEventListener('click', (e) => {
        const container = document.querySelector('.search-bar-container');
        const resultsDiv = document.getElementById('admin-route-search-results-dropdown');
        if (container && resultsDiv && !container.contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });
}

function configurarPesquisaPonto(map) {
    if (window.adminPointSearchConfigured) return;
    window.adminPointSearchConfigured = true;
    window.adminPointMap = map;

    async function searchPlaces(query) {
        const resultsDiv = document.getElementById('admin-point-search-results-dropdown');
        const resultsList = document.querySelector('#admin-point-search-results-dropdown .search-results-list');
        if (!resultsDiv || !resultsList) return;
        if (!query || query.length < 3) {
            resultsDiv.style.display = 'none';
            return;
        }

        try {
            const viewbox = '-9.28,38.56,-9.03,38.35';
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&viewbox=${viewbox}&bounded=1&countrycodes=pt`;
            const resp = await fetch(url, { headers: { 'Accept-Language': 'pt-PT,pt;q=0.9' } });
            const data = await resp.json();

            resultsList.innerHTML = '';
            if (data && data.length) {
                data.forEach(r => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.innerHTML = `
                        <div class="search-result-name">${r.display_name.split(',')[0]}</div>
                        <div class="search-result-address">${r.display_name.split(',').slice(1, 4).join(',')}</div>
                    `;
                    item.addEventListener('click', () => {
                        const lat = parseFloat(r.lat);
                        const lng = parseFloat(r.lon);
                        if (!isNaN(lat) && !isNaN(lng) && window.adminPointMap) {
                            window.adminPointMap.flyTo([lat, lng], 15);
                            if (window.tempPointSearchMarker) window.tempPointSearchMarker.remove();
                            window.tempPointSearchMarker = L.marker([lat, lng]).addTo(window.adminPointMap);
                            window.tempPointSearchMarker.bindPopup(r.display_name.split(',')[0]).openPopup();
                            currentLat = lat;
                            currentLng = lng;
                            const latDisplay = document.getElementById('coordLatDisplay');
                            const lngDisplay = document.getElementById('coordLngDisplay');
                            if (latDisplay) latDisplay.textContent = lat.toFixed(6);
                            if (lngDisplay) lngDisplay.textContent = lng.toFixed(6);
                        }
                        resultsDiv.style.display = 'none';
                        const input = document.getElementById('admin-point-search-input');
                        if (input) input.value = r.display_name.split(',')[0];
                    });
                    resultsList.appendChild(item);
                });
            } else {
                resultsList.innerHTML = '<div class="search-result-item" style="color:#888">Nenhum resultado encontrado</div>';
            }
            resultsDiv.style.display = 'block';
        } catch (e) {
            console.error('Erro na pesquisa de locais (admin ponto):', e);
        }
    }

    const searchInput = document.getElementById('admin-point-search-input');
    const searchBtn = document.getElementById('admin-point-search-btn');
    let timeout;

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => searchPlaces(searchInput.value), 500);
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => searchPlaces(searchInput?.value || ''));
    }

    document.addEventListener('click', (e) => {
        const container = document.querySelector('.search-bar-container');
        const resultsDiv = document.getElementById('admin-point-search-results-dropdown');
        if (container && resultsDiv && !container.contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });
}

async function loadAllPontosToMap() {
    routeMarkers.forEach(marker => marker.removeFrom(routeMap));
    routeMarkers = [];
    
    allLocaisForMap.forEach(local => {
        const orderIdx = selectedPontosRota.findIndex(p => p.id === local.id);
        const isSelected = orderIdx !== -1;
        const corMarcador = local.cor || '#979d23';
        
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background:${isSelected ? corMarcador : 'white'}; color:${isSelected ? 'white' : corMarcador}; border:2px solid ${corMarcador}; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:13px">${isSelected ? (orderIdx + 1) : (local.simbolo || '📍')}</div>`,
            iconSize: [30, 30]
        });
        
        const marker = L.marker([local.latitude, local.longitude], { icon }).addTo(routeMap)
            .bindPopup(buildLocalPopupHtml(local, isSelected), { maxWidth: 240 });
        
        marker.localId = local.id;
        routeMarkers.push(marker);
    });
    await window.drawRouteOnMap();
}

window.carrosselIndices = window.carrosselIndices || {};

function buildLocalPopupHtml(local, isSelected) {
    const imagens = local.imagens || [];
    window.carrosselIndices[local.id] = window.carrosselIndices[local.id] || 0;
    
    let carrosselHtml = '';
    if (imagens.length > 0) {
        carrosselHtml = `<div id="carrossel-${local.id}">${renderCarrosselSlide(local.id, imagens, 0)}</div>`;
    }
    
    return `
        <div style="padding:5px; width:200px;">
            <strong>${escapeHtml(local.nome)}</strong>
            ${carrosselHtml}
            <button onclick="togglePontoOnRoute(${local.id})" style="margin-top:8px; width:100%; padding:5px; background:${local.cor || '#979d23'}; color:white; border:none; border-radius:4px; cursor:pointer">${isSelected ? 'Remover' : 'Adicionar à Rota'}</button>
        </div>
    `;
}

function renderCarrosselSlide(localId, imagens, index) {
    const img = imagens[index];
    return `
        <div style="margin-top:5px;">
            <img src="${escapeHtml(img.url)}" style="width:100%; height:90px; object-fit:cover; border-radius:4px;">
            <div style="font-size:12px; font-weight:600; margin-top:4px;">${escapeHtml(img.nome || '')}</div>
            <div style="font-size:11px; color:#6b7280;">${escapeHtml(img.descricao || '')}</div>
            ${imagens.length > 1 ? `
                <div style="display:flex; justify-content:space-between; margin-top:4px;">
                    <button onclick="carrosselNavegar(${localId}, -1)" style="padding:2px 8px; border:none; background:#f3f4f6; border-radius:4px; cursor:pointer;"><i class="fas fa-chevron-left"></i></button>
                    <span style="font-size:11px; color:#9ca3af;">${index + 1} / ${imagens.length}</span>
                    <button onclick="carrosselNavegar(${localId}, 1)" style="padding:2px 8px; border:none; background:#f3f4f6; border-radius:4px; cursor:pointer;"><i class="fas fa-chevron-right"></i></button>
                </div>
            ` : ''}
        </div>
    `;
}

window.carrosselNavegar = function(localId, direcao) {
    const local = allLocaisForMap.find(l => l.id === localId);
    if (!local || !local.imagens || local.imagens.length === 0) return;
    
    const total = local.imagens.length;
    let novoIndex = (window.carrosselIndices[localId] || 0) + direcao;
    if (novoIndex < 0) novoIndex = total - 1;
    if (novoIndex >= total) novoIndex = 0;
    window.carrosselIndices[localId] = novoIndex;
    
    const container = document.getElementById(`carrossel-${localId}`);
    if (container) container.innerHTML = renderCarrosselSlide(localId, local.imagens, novoIndex);
};

window.setTransportMode = async function(mode) {
    currentTransportMode = mode;
    document.querySelectorAll('.transport-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    await window.drawRouteOnMap();
};

window.getRouteFromOSRM = async function(pontos) {
    if (pontos.length < 2) return null;
    try {
        const coordinates = pontos.map(p => `${p.longitude},${p.latitude}`).join(';');
        const url = `${ROUTING_API_BASE}${currentTransportMode}/${coordinates}?overview=full&geometries=geojson&steps=true`;
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
};

window.updateRouteStats = function(fallback = false) {
    const statsEl = document.getElementById('routeStats');
    if (!statsEl) return;
    const totalPontos = selectedPontosRota.length;
    const modoIcon = currentTransportMode === 'foot' ? '🚶' : '🚗';
    const modoTexto = currentTransportMode === 'foot' ? 'Rota a pé por caminhos' : 'Rota por estradas reais';
    if (fallback || currentRouteDistance === 0) {
        statsEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${totalPontos} ${totalPontos === 1 ? 'ponto' : 'pontos'} | Distância: calculando... | ⚠️ Rota em linha reta (não segue estradas)`;
    } else {
        const horas = Math.floor(currentRouteDuration / 60);
        const minutos = Math.floor(currentRouteDuration % 60);
        const tempoStr = horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;
        statsEl.innerHTML = `<i class="fas fa-route"></i> ${totalPontos} ${totalPontos === 1 ? 'ponto' : 'pontos'} | <i class="fas fa-road"></i> ${currentRouteDistance.toFixed(1)} km | <i class="fas fa-clock"></i> ${tempoStr} | ${modoIcon} ${modoTexto}`;
    }
};

window.drawRouteOnMap = async function() {
    if (routeMap && routeMap.currentRouteLayer) {
        routeMap.removeLayer(routeMap.currentRouteLayer);
        routeMap.currentRouteLayer = null;
    }
    
    if (selectedPontosRota.length < 2) return;
    
    const statsEl = document.getElementById('routeStats');
    if (statsEl) statsEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A calcular rota pelas estradas...';
    
    try {
        const route = await window.getRouteFromOSRM(selectedPontosRota);
        const rotaCor = document.getElementById('rotaCor')?.value || '#979d23';
        const estiloLinha = { color: rotaCor, weight: 6, opacity: 0.8, lineJoin: 'round', cursor: 'pointer' };
        
        let novaCamada;
        
        if (route && route.geometry) {
            novaCamada = L.geoJSON(route.geometry, { style: estiloLinha }).addTo(routeMap);
            currentRouteDistance = route.distance;
            currentRouteDuration = route.duration;
            
            const bounds = novaCamada.getBounds();
            if (bounds.isValid()) routeMap.fitBounds(bounds.pad(0.1));
            
            window.updateRouteStats();
        } else {
            const coordinates = selectedPontosRota.map(p => [p.latitude, p.longitude]);
            novaCamada = L.polyline(coordinates, { ...estiloLinha, dashArray: '10, 10' }).addTo(routeMap);
            currentRouteDistance = 0;
            currentRouteDuration = 0;
            window.updateRouteStats(true);
        }
        
        if (routeMap && novaCamada) {
            routeMap.currentRouteLayer = novaCamada;
            routeMap.currentRouteLayer.bindPopup("A carregar dados dos transportes...");
            
            routeMap.currentRouteLayer.on('click', async function(e) {
                const cliqueLat = e.latlng.lat;
                const cliqueLng = e.latlng.lng;
                let popupConteudo = `
                    <div style="font-family: sans-serif; min-width: 220px;">
                        <strong style="color: #979d23; font-size: 14px;">Informação do Trajeto</strong><br>
                        🛣️ <b>Distância Total:</b> ${currentRouteDistance > 0 ? currentRouteDistance.toFixed(1) + ' km' : 'N/A'}<br>
                        ${currentTransportMode === 'foot' ? '🚶 <b>Tempo a Pé:</b>' : '🚗 <b>Tempo de Carro:</b>'} ${currentRouteDuration > 0 ? Math.round(currentRouteDuration) + ' min' : 'N/A'}
                `;
                
                routeMap.currentRouteLayer.setPopupContent(popupConteudo + "<br>⏳ A procurar paragens da Carris Metropolitana...</div>");
                
                const dadosCarris = await getCarrisMetropolitanaData(cliqueLat, cliqueLng);
                popupConteudo += dadosCarris + "</div>";
                routeMap.currentRouteLayer.setPopupContent(popupConteudo);
            });
            
            routeMap.currentRouteLayer.on('mouseover', function(e) {
                this.setStyle({ weight: 9, opacity: 1.0 });
            });
            
            routeMap.currentRouteLayer.on('mouseout', function(e) {
                this.setStyle({ weight: 6, opacity: 0.8 });
            });
        }
    } catch (error) {
        console.error('Erro ao desenhar rota:', error);
        const rotaCor = document.getElementById('rotaCor')?.value || '#979d23';
        const coordinates = selectedPontosRota.map(p => [p.latitude, p.longitude]);
        if (routeMap) {
            routeMap.currentRouteLayer = L.polyline(coordinates, { color: rotaCor, weight: 4, opacity: 0.8, dashArray: '10, 10' }).addTo(routeMap);
        }
        window.updateRouteStats(true);
    }
};

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
    currentEditId = null;
    currentEditType = null;
    selectedPontosRota = [];
    
    if (routeMap) {
        if (routeMap.currentRouteLayer) {
            routeMap.removeLayer(routeMap.currentRouteLayer);
        }
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
            <div class="modal-form-group"><label class="modal-label">Cor do marcador no mapa</label><input type="color" class="modal-input" id="localCor" style="height:42px; width:100%" value="#979d23"></div>
            <div class="modal-form-group"><label class="modal-label">Categorias</label><div id="localCategoriasList" style="display:flex;flex-wrap:wrap;gap:8px"></div></div>
            <div class="modal-form-group"><label class="modal-label">Adicionar imagens</label>
                <input type="file" id="novasImagens" accept="image/*" multiple style="display:block; margin-top:5px; padding:8px; border:1px dashed #d1d5db; border-radius:8px; width:100%;">
                <div style="font-size:12px; color:#6b7280; margin-top:4px;">Serão comprimidas automaticamente para menos de 500 KB.</div>
                <div id="previewNovasImagens" style="display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; min-height:40px;"></div>
            </div>
            <div class="modal-form-group"><label class="modal-label">Buscar localização</label><div class="search-bar-container" style="margin-bottom: 12px;"><div class="search-bar-wrapper"><div class="search-input-group"><i class="fas fa-search search-icon"></i><input type="text" id="admin-point-search-input" placeholder="Pesquisar lugar em Sesimbra..." class="search-input"><button id="admin-point-search-btn" class="search-btn-action"><i class="fas fa-arrow-right"></i></button></div><div id="admin-point-search-results-dropdown" class="search-results-dropdown" style="display: none;"><div class="search-results-list"></div></div></div></div></div>
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
            configurarPesquisaPonto(locationMap);
            
            const inputImagens = document.getElementById('novasImagens');
            if (inputImagens) {
                inputImagens.addEventListener('change', function(e) {
                    const previewContainer = document.getElementById('previewNovasImagens');
                    if (!previewContainer) return;
                    previewContainer.innerHTML = '';
                    const files = Array.from(e.target.files);
                    files.forEach(file => {
                        const reader = new FileReader();
                        reader.onload = function(event) {
                            const div = document.createElement('div');
                            div.style.cssText = 'position:relative; display:inline-block; margin:3px;';
                            div.innerHTML = `
                                <img src="${event.target.result}" style="width:80px; height:80px; object-fit:cover; border-radius:4px; border:2px solid #979d23;">
                                <span style="position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,0.7); color:white; font-size:10px; padding:1px 4px; border-radius:4px;">${(file.size / 1024).toFixed(0)} KB</span>
                            `;
                            previewContainer.appendChild(div);
                        };
                        reader.readAsDataURL(file);
                    });
                });
            }
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