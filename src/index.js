// ============================================================
//  index.js
//  Página principal — Mapa Leaflet + dados do Supabase
//  Castelo Sesimbra
// ============================================================

import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', function () {

    // ── HAMBURGER ──
    const hamburger = document.getElementById('hamburger');
    const navLinks  = document.getElementById('navLinks');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            hamburger.classList.toggle('open');
            navLinks.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
                hamburger.classList.remove('open');
                navLinks.classList.remove('open');
            }
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('open');
                navLinks.classList.remove('open');
            });
        });
    }

    // ── MAPA ──
    if (typeof L === 'undefined') {
        console.error('Leaflet não carregou! A tentar novamente...');
        setTimeout(function () {
            if (typeof L !== 'undefined') initMap();
        }, 1000);
        return;
    }

    initMap();
});


// ============================================================
//  BUSCAR DADOS DA BASE DE DADOS
// ============================================================
async function buscarDadosSupabase() {
    try {
        const { data, error } = await supabase
            .from('locais')
            .select(`
                *,
                fotos ( url, descricao ),
                categorias_locais (
                    categorias ( nome, cor, simbolo )
                )
            `);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erro ao buscar dados do Supabase:', error.message);
        return null;
    }
}


// ============================================================
//  INICIALIZAR O MAPA
// ============================================================
async function initMap() {
    console.log('A carregar dados do Supabase...');
    let locaisData = await buscarDadosSupabase();

    if (!locaisData || locaisData.length === 0) {
        console.log('Usando dados de exemplo (Supabase vazio ou erro).');
        locaisData = dadosExemplo();
    }

    const sesimbraBounds = L.latLngBounds(
        L.latLng(38.40, -9.28),
        L.latLng(38.56, -9.03)
    );

    const map = L.map('map', {
        maxBounds: sesimbraBounds,
        maxBoundsViscosity: 1.0,
        minZoom: 11,
        maxZoom: 18
    }).setView([38.4545, -9.1043], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    map.on('drag', function () {
        map.panInsideBounds(sesimbraBounds, { animate: false });
    });

    const iconColors = {
        'historico':   '#8B0000',
        'rota':        '#228B22',
        'miradouro':   '#FFA500',
        'praia':       '#20B2AA',
        'restaurante': '#800080',
        'natureza':    '#2E8B57',
        'cultura':     '#4A90E2',
        'default':     '#007bff'
    };

    const iconClasses = {
        'historico':   'fa-landmark',
        'rota':        'fa-route',
        'miradouro':   'fa-mountain',
        'praia':       'fa-umbrella-beach',
        'restaurante': 'fa-utensils',
        'natureza':    'fa-tree',
        'cultura':     'fa-museum',
        'landmark':    'fa-landmark',
        'mountain':    'fa-mountain',
        'route':       'fa-route',
        'default':     'fa-map-marker-alt'
    };

    const markersList   = [];
    const markerObjects = {};

    locaisData.forEach(local => {
        const lat = parseFloat(local.latitude);
        const lng = parseFloat(local.longitude);

        if (isNaN(lat) || isNaN(lng)) return;

        const catObj = local.categorias_locais?.[0]?.categorias;
        let categoriaPrincipal = catObj?.nome?.toLowerCase() || local.categoria || 'default';
        let cor   = catObj?.cor   || iconColors[categoriaPrincipal] || iconColors.default;
        let icone = catObj?.simbolo
            ? (iconClasses[catObj.simbolo] || 'fa-' + catObj.simbolo)
            : (iconClasses[categoriaPrincipal] || iconClasses.default);

        const markerIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color:${cor};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;box-shadow:0 2px 5px rgba(0,0,0,0.3);border:2px solid white;"><i class="fas ${icone}"></i></div>`,
            iconSize: [32, 32],
            popupAnchor: [0, -16]
        });

        let popupContent = `
            <div style="min-width:200px">
                <b style="font-size:16px">${local.nome}</b>
                <hr style="margin:5px 0">
                <p style="margin:5px 0;font-size:12px">${local.descricao || 'Sem descrição'}</p>
                <p style="margin:5px 0;font-size:12px;color:#666">
                    <i class="fas ${icone}"></i> ${categoriaPrincipal}
                </p>
        `;

        const fotoUrl = local.fotos?.[0]?.url;
        if (fotoUrl) {
            popupContent += `
                <div style="margin-top:8px">
                    <img src="${fotoUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:5px"
                         onerror="this.src='https://via.placeholder.com/200x120?text=Sem+Imagem'">
                </div>
            `;
        }

        popupContent += `<hr style="margin:5px 0"><small>ID: ${local.id}</small></div>`;

        const marker = L.marker([lat, lng], { icon: markerIcon });
        marker.options.categoria = categoriaPrincipal;
        marker.options.localId   = local.id;
        marker.bindPopup(popupContent);
        marker.addTo(map);

        markersList.push(marker);
        markerObjects[local.id] = marker;
    });

    window.marcadores         = markersList;
    window.currentMap         = map;
    window.markerObjects      = markerObjects;
    window.locaisDataCompleto = locaisData;

    window.filtrarMarcadores = function (categoria) {
        window.marcadores.forEach(m => {
            const cat = m.options.categoria;
            if (categoria === 'todos' || cat === categoria) {
                if (!map.hasLayer(m)) m.addTo(map);
            } else {
                if (map.hasLayer(m)) map.removeLayer(m);
            }
        });
    };

    window.centralizarNoMapa = function (localId) {
        const marker = window.markerObjects[localId];
        if (marker) {
            map.flyTo(marker.getLatLng(), 16);
            marker.openPopup();
        } else {
            const local = window.locaisDataCompleto?.find(l => l.id == localId);
            if (local) {
                const lat = parseFloat(local.latitude);
                const lng = parseFloat(local.longitude);
                if (!isNaN(lat) && !isNaN(lng)) map.flyTo([lat, lng], 16);
            }
        }
    };

    atualizarBotoesFiltro(locaisData);
    preencherCards(locaisData);
    configurarPesquisa(map);
    await configurarMenuUtilizador();

    console.log('Mapa e sistema de utilizador inicializados.');
}


// ============================================================
//  PESQUISA DE LOCAIS (NOMINATIM)
// ============================================================
function configurarPesquisa(map) {
    async function searchPlaces(query) {
        const resultsDiv  = document.getElementById('search-results-dropdown');
        const resultsList = document.querySelector('#search-results-dropdown .search-results-list');
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
                        const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
                        if (!isNaN(lat) && !isNaN(lng)) {
                            map.flyTo([lat, lng], 15);
                            if (window.tempSearchMarker) map.removeLayer(window.tempSearchMarker);
                            window.tempSearchMarker = L.marker([lat, lng]).addTo(map);
                            window.tempSearchMarker.bindPopup(r.display_name.split(',')[0]).openPopup();
                            setTimeout(() => {
                                if (window.tempSearchMarker) {
                                    map.removeLayer(window.tempSearchMarker);
                                    window.tempSearchMarker = null;
                                }
                            }, 5000);
                        }
                        resultsDiv.style.display = 'none';
                        document.getElementById('search-location-input').value = r.display_name.split(',')[0];
                    });
                    resultsList.appendChild(item);
                });
                resultsDiv.style.display = 'block';
            } else {
                resultsList.innerHTML = '<div class="search-result-item" style="color:#888">Nenhum resultado encontrado</div>';
                resultsDiv.style.display = 'block';
            }
        } catch (e) {
            console.error('Erro na pesquisa:', e);
        }
    }

    const searchInput = document.getElementById('search-location-input');
    const searchBtn   = document.getElementById('search-location-btn');
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
        const container  = document.querySelector('.search-bar-container');
        const resultsDiv = document.getElementById('search-results-dropdown');
        if (container && resultsDiv && !container.contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });
}


// ============================================================
//  MENU DE UTILIZADOR (HEADER)
// ============================================================
async function configurarMenuUtilizador() {
    const userBtn        = document.getElementById('userHeaderBtn');
    const userDropdown   = document.getElementById('userHeaderDropdown');
    const userHeaderName = document.querySelector('.user-header-name');
    const profileBtn     = document.getElementById('fakeProfileBtn');
    const logoutBtn      = document.getElementById('fakeLogoutBtn');

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        const nome = user.user_metadata?.full_name || user.email.split('@')[0];
        if (userHeaderName) userHeaderName.textContent = nome;

        const rodapeNome = document.querySelector('.footer-bottom-right strong');
        if (rodapeNome) rodapeNome.textContent = nome;

        // Botão admin
        const isAdmin = user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin';
        if (isAdmin && userDropdown) {
            const adminBtn = document.createElement('button');
            adminBtn.className = 'dropdown-item';
            adminBtn.innerHTML = '<i class="fas fa-shield-alt"></i> Administração';
            adminBtn.addEventListener('click', () => {
                window.location.href = 'paginaAdmin.html';
            });
            userDropdown.insertBefore(adminBtn, userDropdown.firstChild);
            const divider = document.createElement('hr');
            divider.className = 'dropdown-divider';
            adminBtn.after(divider);
        }
    } else {
        if (userHeaderName) userHeaderName.textContent = 'Visitante';
    }

    if (userBtn) {
        userBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const { data: { user: u } } = await supabase.auth.getUser();
            if (!u) {
                window.location.href = 'login.html';
            } else {
                userBtn.classList.toggle('active');
                userDropdown.classList.toggle('show');
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (userBtn && userDropdown && !userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            userBtn.classList.remove('active');
            userDropdown.classList.remove('show');
        }
    });

    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = 'perfil.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                alert('Erro ao sair: ' + error.message);
            } else {
                window.location.reload();
            }
        });
    }
}


// ============================================================
//  BOTÕES DE FILTRO
// ============================================================
function atualizarBotoesFiltro(locaisData) {
    const container = document.getElementById('filtro-botoes-container');
    if (!container) return;

    const categoriasUnicas = new Set(['todos']);

    locaisData.forEach(local => {
        if (local.categorias_locais?.length > 0) {
            local.categorias_locais.forEach(cl => {
                if (cl.categorias?.nome) categoriasUnicas.add(cl.categorias.nome.toLowerCase());
            });
        } else if (local.categoria) {
            categoriasUnicas.add(local.categoria.toLowerCase());
        }
    });

    const iconesMap = {
        'todos':       'fa-globe',
        'historico':   'fa-landmark',
        'rota':        'fa-route',
        'miradouro':   'fa-mountain',
        'praia':       'fa-umbrella-beach',
        'restaurante': 'fa-utensils',
        'natureza':    'fa-tree',
        'cultura':     'fa-museum'
    };

    let html = '';
    categoriasUnicas.forEach(cat => {
        const icone = iconesMap[cat] || 'fa-map-marker-alt';
        const ativo = cat === 'todos' ? 'active' : '';
        const texto = cat === 'todos' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1);
        html += `<button class="filtro-btn ${ativo}" data-categoria="${cat}"><i class="fas ${icone}"></i> ${texto}</button>`;
    });

    container.innerHTML = html;

    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            if (window.filtrarMarcadores) window.filtrarMarcadores(this.getAttribute('data-categoria'));
        });
    });
}


// ============================================================
//  CARDS DE ROTAS E PONTOS HISTÓRICOS
// ============================================================
function preencherCards(locaisData) {
    const rotas = locaisData.filter(l => {
        const cat = l.categorias_locais?.[0]?.categorias?.nome?.toLowerCase() || l.categoria || '';
        return cat === 'rota';
    });

    const historicos = locaisData.filter(l => {
        const cat = l.categorias_locais?.[0]?.categorias?.nome?.toLowerCase() || l.categoria || '';
        return cat === 'historico' || cat === 'patrimonio' || cat === 'historia';
    });

    const rotasContainer      = document.getElementById('rotas-container');
    const historicosContainer = document.getElementById('historicos-container');

    if (rotasContainer) {
        rotasContainer.innerHTML = rotas.length > 0
            ? gerarCardsHTML(rotas.slice(0, 3))
            : '<p class="text-center" style="color:#888">Nenhuma rota encontrada no momento.</p>';
    }

    if (historicosContainer) {
        historicosContainer.innerHTML = historicos.length > 0
            ? gerarCardsHTML(historicos.slice(0, 3))
            : '<p class="text-center" style="color:#888">Nenhum ponto histórico encontrado no momento.</p>';
    }
}

function gerarCardsHTML(locais) {
    return locais.map(local => {
        const fotoUrl = local.fotos?.[0]?.url
            || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format';

        const catObj  = local.categorias_locais?.[0]?.categorias;
        const catNome = catObj?.nome || local.categoria || 'Geral';
        const catCor  = catObj?.cor  || '#007bff';

        const iconesCard = {
            'historico':   'fa-landmark',
            'rota':        'fa-route',
            'miradouro':   'fa-mountain',
            'praia':       'fa-umbrella-beach',
            'restaurante': 'fa-utensils'
        };
        const icone = iconesCard[catNome.toLowerCase()] || 'fa-map-marker-alt';

        return `
            <div class="card" data-local-id="${local.id}">
                <div class="card-img" style="background-image:url('${fotoUrl}');position:relative">
                    <span style="background-color:${catCor};position:absolute;top:10px;right:10px;padding:5px 10px;border-radius:20px;color:white;font-size:12px">
                        <i class="fas ${icone}"></i> ${catNome}
                    </span>
                </div>
                <div class="card-content">
                    <h3>${local.nome}</h3>
                    <p>${local.descricao || 'Sem descrição disponível.'}</p>
                    <a href="#mapa" class="card-link" onclick="window.centralizarNoMapa && window.centralizarNoMapa(${local.id}); return false;">
                        Ver no mapa <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </div>
        `;
    }).join('');
}


// ============================================================
//  DADOS DE EXEMPLO (fallback quando Supabase está vazio)
// ============================================================
function dadosExemplo() {
    return [
        {
            id: 1, nome: 'Castelo de Sesimbra',
            latitude: 38.4550, longitude: -9.1025,
            descricao: 'Fortificação medieval com vista deslumbrante sobre a vila',
            categoria: 'historico',
            categorias_locais: [{ categorias: { nome: 'historico', cor: '#8B0000', simbolo: 'landmark' } }],
            fotos: [{ url: 'https://www.castelosdeportugal.pt/castelos/assets/img/CastelosSECXIII/sesimbra/sesimbra1.jpg' }]
        },
        {
            id: 2, nome: 'Farol do Cabo Espichel',
            latitude: 38.4186, longitude: -9.2187,
            descricao: 'Farol histórico do século XVIII',
            categoria: 'historico',
            categorias_locais: [{ categorias: { nome: 'historico', cor: '#8B0000', simbolo: 'landmark' } }],
            fotos: [{ url: 'https://elements-resized.envatousercontent.com/elements-video-cover-images/fed34031-4317-40fe-a87c-2daeed6c0b2f/video_preview/video_preview_0000.jpg?w=500&cf_fit=cover&q=85&format=auto&s=9b33f8c113d6a19bd45ce0c8cd322d4c95d021c6bd47490bfb87c123299aebcf' }]
        },
        {
            id: 3, nome: 'Miradouro do Facho',
            latitude: 38.4420, longitude: -9.1020,
            descricao: 'Vista panorâmica sobre a costa e a vila',
            categoria: 'miradouro',
            categorias_locais: [{ categorias: { nome: 'miradouro', cor: '#FFA500', simbolo: 'mountain' } }],
            fotos: [{ url: '' }]
        },
        {
            id: 4, nome: 'Praia do Ouro',
            latitude: 38.4385, longitude: -9.0805,
            descricao: 'Praia urbana muito procurada na época balnear',
            categoria: 'praia',
            categorias_locais: [{ categorias: { nome: 'praia', cor: '#20B2AA', simbolo: 'umbrella-beach' } }],
            fotos: [{ url: 'https://www.guiadacidade.pt/assets/capas_poi/capa_284029.jpg' }]
        },
        {
            id: 5, nome: 'Trilho da Lagoa de Albufeira',
            latitude: 38.4470, longitude: -9.0950,
            descricao: 'Percurso pedestre com vista para a lagoa',
            categoria: 'rota',
            categorias_locais: [{ categorias: { nome: 'rota', cor: '#228B22', simbolo: 'route' } }],
            fotos: [{ url: 'https://sandee.com/_next/image?url=https%3A%2F%2Flh5.googleusercontent.com%2Fp%2FAF1QipOtAAlbE-YnNp8GjLREX25ZPn5y26JTsrdE9HJ9%3Ds1600-k-no&w=3840&q=75' }]
        }
    ];
}