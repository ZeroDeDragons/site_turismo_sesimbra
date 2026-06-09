// ============================================================
//  paginaAdmin.js - Versão com mapa funcionando
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado Global
let todosUtilizadores = [];
let todasRotas = [];
let todosPostos = [];
let todasCategorias = [];
let modalTipo = null;
let editandoId = null;
let locationMap = null;
let routeMap = null;
let routePolyline = null;
let routeMarkers = [];
let selectedRoutePointIds = [];
let currentLat = null;
let currentLng = null;

const DEFAULT_LAT = 38.4455;
const DEFAULT_LNG = -9.1011;

// Aguardar o Leaflet carregar
function waitForLeaflet(callback, attempts = 0) {
    if (typeof L !== 'undefined') {
        callback();
    } else if (attempts < 20) {
        setTimeout(() => waitForLeaflet(callback, attempts + 1), 200);
    } else {
        console.error('Leaflet não carregou');
        mostrarToast('Erro ao carregar o mapa. Recarregue a página.', true);
    }
}

// ============================================================
//  INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const sessaoValida = await verificarSessaoAdmin();
    if (!sessaoValida) return;

    await carregarCategorias();
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
//  CATEGORIAS
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

window.editarCategoria = function(id) {
    const categoria = todasCategorias.find(c => c.id === id);
    if (!categoria) return;
    editandoId = id;
    openModal('categoria', categoria);
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
                        <button class="action-btn edit" onclick="editarUtilizador('${u.id}')">✏️</button>
                        <button class="action-btn del" onclick="eliminarUtilizador('${u.id}', '${nome.replace(/'/g, "\\'")}')">🗑️</button>
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
                    <div class="route-img-icon" style="color:${cor}">🗺️</div>
                </div>
                <div class="route-body">
                    <div class="route-name">${r.nome}</div>
                    <div class="route-meta"><span>${catNome}</span></div>
                    <div class="route-footer">
                        <span style="font-size:12px; color:#9ca3af">${r.descricao ? r.descricao.substring(0, 30) + '...' : ''}</span>
                        <div class="td-actions">
                            <button class="action-btn edit" onclick="editarRota(${r.id})">✏️</button>
                            <button class="action-btn del" onclick="eliminarRota(${r.id}, '${r.nome.replace(/'/g, "\\'")}')">🗑️</button>
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
    if (lista.length === 0) { grid.innerHTML = `<div class="empty"><p>Nenhum ponto encontrado.</p></div>`; return; }

    grid.innerHTML = lista.map(p => {
        const cat = p.categorias_locais?.[0]?.categorias;
        const catNome = cat?.nome || 'Sem Categoria';
        const cor = cat?.cor || '#979d23';
        return `
            <div class="posto-card">
                <div class="posto-icon" style="background:${cor}22; color:${cor}">${cat?.simbolo || '📍'}</div>
                <div class="posto-info">
                    <div class="posto-name">${p.nome}</div>
                    <div class="posto-cat">${catNome} · 📍 ${p.latitude?.toFixed(6) || '?'}, ${p.longitude?.toFixed(6) || '?'}</div>
                    <div class="posto-actions">
                        <button class="action-btn edit" onclick="editarPosto(${p.id})">✏️</button>
                        <button class="action-btn del" onclick="eliminarPosto(${p.id}, '${p.nome.replace(/'/g, "\\'")}')">🗑️</button>
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

// Função para inicializar o mapa de seleção
function setupLocationPicker(lat, lng, onLocationChange) {
    if (typeof L === 'undefined') {
        console.error('Leaflet não disponível');
        return false;
    }

    const container = document.getElementById('location-pick-map');
    if (!container) {
        console.error('Container não encontrado');
        return false;
    }

    // Limpar container
    container.innerHTML = '';
    container.style.height = '300px';
    container.style.width = '100%';
    container.style.backgroundColor = '#f0f0f0';

    // Criar mapa
    const map = L.map(container).setView([lat, lng], 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Marcador arrastável
    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    
    marker.on('dragend', function(e) {
        const pos = marker.getLatLng();
        onLocationChange(pos.lat, pos.lng);
    });

    map.on('click', function(e) {
        marker.setLatLng(e.latlng);
        onLocationChange(e.latlng.lat, e.latlng.lng);
    });

    // Forçar redimensionamento
    setTimeout(() => map.invalidateSize(), 100);

    locationMap = map;
    return true;
}

function getPostoById(id) {
    return todosPostos.find(p => p.id === id);
}

function initRoutePreviewMap() {
    if (typeof L === 'undefined') {
        console.error('Leaflet não disponível');
        return;
    }
    const container = document.getElementById('route-preview-map');
    if (!container) return;
    container.innerHTML = '';
    routeMap = L.map(container).setView([DEFAULT_LAT, DEFAULT_LNG], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(routeMap);
    setTimeout(() => routeMap.invalidateSize(), 100);
}

function renderRoutePointsList() {
    const list = document.getElementById('route-point-list');
    if (!list) return;
    if (!todosPostos.length) {
        list.innerHTML = '<div class="empty"><p>Nenhum ponto existente.</p></div>';
        drawRoutePreview();
        return;
    }
    list.innerHTML = todosPostos.map(p => {
        const selected = selectedRoutePointIds.includes(p.id);
        const cat = p.categorias_locais?.[0]?.categorias;
        const cor = cat?.cor || '#979d23';
        return `
            <div class="route-point-item ${selected ? 'selected' : ''}" onclick="toggleRoutePoint(${p.id})" style="border-left:4px solid ${selected ? cor : '#e5e7eb'};">
                <div class="route-point-name">${p.nome}</div>
                <div class="route-point-meta">${cat?.nome ? cat.nome + ' · ' : ''}${p.latitude?.toFixed(6) || '?'} , ${p.longitude?.toFixed(6) || '?'}</div>
            </div>`;
    }).join('');
    drawRoutePreview();
}

window.toggleRoutePoint = function(id) {
    const index = selectedRoutePointIds.indexOf(id);
    if (index === -1) selectedRoutePointIds.push(id);
    else selectedRoutePointIds.splice(index, 1);
    renderRoutePointsList();
};

function drawRoutePreview() {
    if (!routeMap) return;
    routeMarkers.forEach(marker => routeMap.removeLayer(marker));
    routeMarkers = [];
    if (routePolyline) {
        routeMap.removeLayer(routePolyline);
        routePolyline = null;
    }

    const latlngs = selectedRoutePointIds.map(id => {
        const ponto = getPostoById(id);
        return ponto ? [ponto.latitude, ponto.longitude] : null;
    }).filter(Boolean);

    if (!latlngs.length) {
        if (todosPostos.length) {
            routeMap.setView([todosPostos[0].latitude, todosPostos[0].longitude], 13);
        }
        return;
    }

    latlngs.forEach((latlng, index) => {
        const marker = L.circleMarker(latlng, {
            radius: 8,
            color: '#ffffff',
            fillColor: '#374151',
            fillOpacity: 1,
            weight: 2
        }).addTo(routeMap);
        routeMarkers.push(marker);
        if (index === 0) marker.bindTooltip('Início', { permanent: true, direction: 'right' });
        else if (index === latlngs.length - 1) marker.bindTooltip('Fim', { permanent: true, direction: 'right' });
    });

    if (latlngs.length > 1) {
        routePolyline = L.polyline(latlngs, { color: document.getElementById('m-cor')?.value || '#979d23', weight: 4 }).addTo(routeMap);
    }

    const bounds = L.latLngBounds(latlngs);
    routeMap.fitBounds(bounds.pad(0.2));
}

async function loadRoutePointSequenceFromRota(rotaId) {
    selectedRoutePointIds = [];
    if (!rotaId) return;
    const { data, error } = await supabase.from('segmentos_rota')
        .select('ordem_segmento, local_origem_id, local_destino_id')
        .eq('rota_id', rotaId)
        .order('ordem_segmento', { ascending: true });
    if (error) { console.error(error); return; }
    if (!data || !data.length) return;
    selectedRoutePointIds = [data[0].local_origem_id];
    data.forEach(segmento => selectedRoutePointIds.push(segmento.local_destino_id));
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
        footer.style.display = isEditing ? 'flex' : 'none';
        overlay.classList.add('show');
    }
    else if (tipo === 'rota') {
        titulo.textContent = isEditing ? 'Editar Rota' : 'Nova Rota';
        selectedRoutePointIds = [];
        corpo.innerHTML = `
            <div class="modal-form-group"><label class="modal-label">Nome da Rota</label><input class="modal-input" id="m-nome" type="text" value="${dadosEditar?.nome || ''}"></div>
            <div class="modal-form-group"><label class="modal-label">Descrição</label><textarea class="modal-textarea" id="m-descricao">${dadosEditar?.descricao || ''}</textarea></div>
            <div class="modal-row" style="grid-template-columns:1fr 1.2fr; gap:16px;">
                <div>
                    <div class="modal-form-group"><label class="modal-label">Categoria</label><select class="modal-select" id="m-categoria"><option value="">Sem categoria</option>${catOptions}</select></div>
                    <div class="modal-form-group"><label class="modal-label">Cor</label><input class="modal-input" id="m-cor" type="color" value="${dadosEditar?.cor || '#979d23'}" style="padding:4px; height:42px;"></div>
                    <div class="modal-form-group"><label class="modal-label">Pontos da Rota</label><div id="route-point-list" class="route-point-list"></div></div>
                </div>
                <div>
                    <div class="modal-form-group"><label class="modal-label">Pré-visualizar Rota</label>
                        <div class="location-map-container">
                            <div id="route-preview-map" class="location-map" style="height:320px; width:100%; background:#ddd; border-radius:8px;"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        footer.style.display = 'flex';
        overlay.classList.add('show');

        setTimeout(async () => {
            initRoutePreviewMap();
            if (isEditing && dadosEditar?.id) await loadRoutePointSequenceFromRota(dadosEditar.id);
            renderRoutePointsList();
            document.getElementById('m-cor')?.addEventListener('input', drawRoutePreview);
            // Garantir que o mapa recalcula o tamanho após a animação do modal terminar
            setTimeout(() => routeMap?.invalidateSize(), 150);
        }, 320);
    }
    else if (tipo === 'posto') {
        titulo.textContent = isEditing ? 'Editar Ponto Turístico' : 'Novo Ponto Turístico';

        const initialLat = dadosEditar?.latitude || DEFAULT_LAT;
        const initialLng = dadosEditar?.longitude || DEFAULT_LNG;
        currentLat = initialLat;
        currentLng = initialLng;

        corpo.innerHTML = `
            <div class="modal-form-group"><label class="modal-label">Nome do Ponto</label><input class="modal-input" id="m-nome" type="text" value="${dadosEditar?.nome || ''}" placeholder="Ex: Castelo de Sesimbra"></div>
            <div class="modal-form-group"><label class="modal-label">Descrição</label><textarea class="modal-textarea" id="m-descricao">${dadosEditar?.descricao || ''}</textarea></div>
            <div class="modal-form-group"><label class="modal-label">Categoria</label><select class="modal-select" id="m-categoria"><option value="">Sem categoria</option>${catOptions}</select></div>
            
            <div class="map-instruction" style="background:#e8f4f8; padding:10px; border-radius:8px; margin:10px 0">
                <span>📍 Clique no mapa ou arraste o marcador para selecionar a localização</span>
            </div>
            
            <div class="location-map-container">
                <div id="location-pick-map" class="location-map" style="height:300px; width:100%; background:#ddd; border-radius:8px;"></div>
            </div>
            
            <div class="location-coords-display" style="display:flex; gap:10px; margin-top:10px; padding:8px; background:#f5f5f5; border-radius:8px;">
                <div style="flex:1"><strong>Latitude:</strong> <span id="selected-lat">${initialLat.toFixed(6)}</span></div>
                <div style="flex:1"><strong>Longitude:</strong> <span id="selected-lng">${initialLng.toFixed(6)}</span></div>
            </div>
            
            <div class="modal-form-group"><label class="modal-label">URL da Foto (opcional)</label><input class="modal-input" id="m-foto" type="url" value="${dadosEditar?.foto_url || ''}"></div>
        `;

        footer.style.display = 'flex';
        overlay.classList.add('show');

        // Inicializar o mapa após o modal estar visível e a animação CSS terminar (250ms)
        setTimeout(() => {
            const mapContainer = document.getElementById('location-pick-map');
            if (mapContainer) {
                setupLocationPicker(initialLat, initialLng, (lat, lng) => {
                    currentLat = lat;
                    currentLng = lng;
                    document.getElementById('selected-lat').textContent = lat.toFixed(6);
                    document.getElementById('selected-lng').textContent = lng.toFixed(6);
                });
            }
        }, 320);
    }
    else if (tipo === 'categoria') {
        if (isEditing) {
            titulo.textContent = 'Editar Categoria';
            editandoId = dadosEditar.id;
            corpo.innerHTML = `
                <div class="modal-form-group"><label class="modal-label">Nome da Categoria</label><input class="modal-input" id="m-nome" type="text" value="${dadosEditar.nome || ''}"></div>
                <div class="modal-form-group"><label class="modal-label">Cor</label><input class="modal-input" id="m-cor" type="color" value="${dadosEditar.cor || '#979d23'}" style="padding:4px; height:42px;"></div>`;
            footer.style.display = 'flex';
        } else {
            titulo.textContent = 'Gerir Categorias';
            corpo.innerHTML = `
                <div style="display:flex; gap:10px; margin-bottom:20px;">
                    <input class="modal-input" id="m-nova-cat" type="text" placeholder="Nome da categoria..." style="flex:1">
                    <input class="modal-input" id="m-cor-cat" type="color" value="#979d23" style="width:60px">
                    <button class="btn-primary" onclick="salvarNovaCategoria()">+</button>
                </div>
                <div style="max-height:300px; overflow-y:auto;">
                    ${todasCategorias.map(c => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eee">
                            <div><span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${c.cor || '#ccc'}; margin-right:10px;"></span> ${c.nome}</div>
                            <div style="display:flex; gap:6px;">
                                <button class="action-btn edit" onclick="editarCategoria(${c.id})">✏️</button>
                                <button class="action-btn del" onclick="eliminarCategoria(${c.id}, '${c.nome.replace(/'/g, "\\'")}')">🗑️</button>
                            </div>
                        </div>
                    `).join('')}
                </div>`;
            footer.style.display = 'none';
        }
        overlay.classList.add('show');
    }
};

window.closeModal = function() {
    if (locationMap) {
        locationMap.remove();
        locationMap = null;
    }
    if (routeMap) {
        routeMap.remove();
        routeMap = null;
        routePolyline = null;
        routeMarkers = [];
        selectedRoutePointIds = [];
    }
    document.getElementById('modalOverlay')?.classList.remove('show');
    editandoId = null;
    modalTipo = null;
    currentLat = null;
    currentLng = null;
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
    openModal('categoria');
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
            await supabase.from('segmentos_rota').delete().eq('rota_id', editandoId);
        } else {
            const { data, error } = await supabase.from('rotas').insert([{ nome, descricao, cor }]).select().single();
            if (error) { mostrarToast('Erro: ' + error.message, true); return; }
            rotaId = data.id;
        }

        if (categoria_id && rotaId) await supabase.from('categorias_rotas').insert([{ rota_id: rotaId, categoria_id: categoria_id }]);

        const segmentoRows = selectedRoutePointIds.reduce((acc, pontoId, index) => {
            if (index === selectedRoutePointIds.length - 1) return acc;
            acc.push({
                rota_id: rotaId,
                local_origem_id: pontoId,
                local_destino_id: selectedRoutePointIds[index + 1],
                ordem_segmento: index + 1
            });
            return acc;
        }, []);

        if (segmentoRows.length) await supabase.from('segmentos_rota').insert(segmentoRows);

        mostrarToast(editandoId ? 'Rota atualizada.' : 'Rota criada.');
        closeModal();
        await carregarRotas();
    }
    else if (modalTipo === 'categoria') {
        const nome = document.getElementById('m-nome')?.value.trim();
        const cor = document.getElementById('m-cor')?.value;
        if (!nome) { mostrarToast('Nome obrigatório.', true); return; }
        if (!editandoId) { mostrarToast('Selecione uma categoria para editar.', true); return; }
        const { error } = await supabase.from('categorias').update({ nome, cor }).eq('id', editandoId);
        if (error) { mostrarToast('Erro: ' + error.message, true); return; }
        mostrarToast('Categoria atualizada.');
        closeModal();
        await carregarCategorias();
        await Promise.all([carregarRotas(), carregarPostos(), atualizarEstatisticasDashboard()]);
    }
    else if (modalTipo === 'posto') {
        const nome = document.getElementById('m-nome')?.value.trim();
        const descricao = document.getElementById('m-descricao')?.value.trim();
        const foto = document.getElementById('m-foto')?.value.trim();
        const categoria_id = document.getElementById('m-categoria')?.value;

        if (!nome) { mostrarToast('Nome obrigatório.', true); return; }
        if (currentLat === null || currentLng === null) { mostrarToast('Selecione uma localização no mapa.', true); return; }

        let localId = editandoId;
        if (editandoId) {
            await supabase.from('locais').update({ nome, descricao, latitude: currentLat, longitude: currentLng }).eq('id', editandoId);
            await supabase.from('categorias_locais').delete().eq('local_id', editandoId);
            const { data: fExist } = await supabase.from('fotos').select('id').eq('locais_id', editandoId).limit(1);
            if (fExist && fExist.length > 0) {
                if (foto) await supabase.from('fotos').update({ url: foto }).eq('id', fExist[0].id);
                else await supabase.from('fotos').delete().eq('id', fExist[0].id);
            } else if (foto) {
                await supabase.from('fotos').insert([{ locais_id: editandoId, url: foto }]);
            }
        } else {
            const { data, error } = await supabase.from('locais').insert([{ nome, descricao, latitude: currentLat, longitude: currentLng }]).select().single();
            if (error) { mostrarToast('Erro: ' + error.message, true); return; }
            localId = data.id;
            if (foto) await supabase.from('fotos').insert([{ locais_id: localId, url: foto }]);
        }
        if (categoria_id && localId) await supabase.from('categorias_locais').insert([{ local_id: localId, categoria_id: categoria_id }]);
        mostrarToast(editandoId ? 'Ponto atualizado.' : 'Ponto criado.');
        closeModal();
        await carregarPostos();
        await atualizarEstatisticasDashboard();
    }
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
            return `<tr><td style="padding:13px 22px">${nome}</td><td style="padding:13px 22px">${u.email || '—'}</td><td style="padding:13px 22px">${data}</td><td style="padding:13px 22px"><span class="badge ${statusBadges[u.status] || 'pending'}">${statusNomes[u.status] || 'Pendente'}</span></td></tr>`;
        }).join('');
    }
}

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

// Exportar funções
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
    await atualizarEstatisticasDashboard();
};
