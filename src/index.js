import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// CORREÇÃO AQUI: Removemos o "supabase." antes do createClient
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', function () {
    if (typeof L === 'undefined') {
        console.error('Leaflet não carregou! Tentando novamente...');
        setTimeout(function () {
            if (typeof L !== 'undefined') {
                initMap();
            } else {
                console.error('Leaflet ainda não disponível. Verifique a conexão com a internet.');
            }
        }, 1000);
        return;
    }

    initMap();
});

// Função assíncrona para buscar os dados diretamente do banco Supabase
async function buscarDadosSupabase() {
    try {
        // Altere 'locais' para o nome exato da sua tabela no Supabase
        // O .select('*') traz todas as colunas. Se tiver relações (como fotos), ajuste o select.
        const { data, error } = await supabase
            .from('locais')
            .select('*'); 

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erro ao buscar dados do Supabase:', error.message);
        return null;
    }
}

async function initMap() {
    console.log('Buscando dados no Supabase...');
    let locaisData = await buscarDadosSupabase();

    if (locaisData && locaisData.length > 0) {
        console.log('Dados carregados com sucesso do Supabase:', locaisData);
    } else {
        console.log('Falha ou dados vazios no Supabase. Usando dados de exemplo locais.');
        locaisData = [
            {
                id: 1,
                nome: "Castelo de Sesimbra",
                categoria: "historico",
                lat: 38.4550,
                lng: -9.1025,
                descricao: "Fortificação medieval com vista deslumbrante sobre a vila",
                categorias: [{ nome: "historico", cor: "#8B0000", simbolo: "landmark" }],
                fotos: [{ url: "https://images.unsplash.com/photo-1584555616040-1f3f5e2c2d3c" }]
            },
            {
                id: 2,
                nome: "Farol do Cabo Espichel",
                categoria: "historico",
                lat: 38.4186,
                lng: -9.2187,
                descricao: "Farol histórico do século XVIII",
                categorias: [{ nome: "historico", cor: "#8B0000", simbolo: "lightbulb" }],
                fotos: [{ url: "https://images.unsplash.com/photo-1554475900-0a0350e3fc7b" }]
            },
            {
                id: 3,
                nome: "Miradouro do Facho",
                categoria: "miradouro",
                lat: 38.4420,
                lng: -9.1020,
                descricao: "Vista panorâmica da costa",
                categorias: [{ nome: "miradouro", cor: "#FFA500", simbolo: "mountain" }],
                fotos: []
            },
            {
                id: 4,
                nome: "Praia do Ouro",
                categoria: "praia",
                lat: 38.4385,
                lng: -9.0805,
                descricao: "Praia urbana muito procurada",
                categorias: [{ nome: "praia", cor: "#20B2AA", simbolo: "umbrella-beach" }],
                fotos: []
            },
            {
                id: 5,
                nome: "Trilho da Lagoa de Albufeira",
                categoria: "rota",
                lat: 38.4470,
                lng: -9.0950,
                descricao: "Percurso pedestre com vista para a lagoa",
                categorias: [{ nome: "rota", cor: "#228B22", simbolo: "route" }],
                fotos: []
            },
            {
                id: 6,
                nome: "Restaurante Forte do Cavalo",
                categoria: "restaurante",
                lat: 38.4520,
                lng: -9.1000,
                descricao: "Gastronomia local com vista para o mar",
                categorias: [{ nome: "restaurante", cor: "#800080", simbolo: "utensils" }],
                fotos: []
            }
        ];
    }

    const sesimbraBounds = L.latLngBounds(
        L.latLng(38.40, -9.28),
        L.latLng(38.56, -9.03)
    );

    var map = L.map('map', {
        maxBounds: sesimbraBounds,
        maxBoundsViscosity: 1.0,
        minZoom: 11,
        maxZoom: 18
    }).setView([38.4545, -9.1043], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    map.on('drag', function () {
        map.panInsideBounds(sesimbraBounds, { animate: false });
    });

    const iconColors = {
        'historico': '#8B0000',
        'rota': '#228B22',
        'miradouro': '#FFA500',
        'praia': '#20B2AA',
        'restaurante': '#800080',
        'natureza': '#2E8B57',
        'cultura': '#4A90E2',
        'default': '#007bff'
    };

    const iconClasses = {
        'historico': 'fa-landmark',
        'rota': 'fa-route',
        'miradouro': 'fa-mountain',
        'praia': 'fa-umbrella-beach',
        'restaurante': 'fa-utensils',
        'natureza': 'fa-tree',
        'cultura': 'fa-museum',
        'default': 'fa-map-marker-alt'
    };

    const markersList = [];
    const markerObjects = {};

    locaisData.forEach(local => {
        let categoriaPrincipal = local.categoria || 'default';
        let cor = iconColors[categoriaPrincipal] || iconColors.default;
        let icone = iconClasses[categoriaPrincipal] || iconClasses.default;

        if (local.categorias && local.categorias.length > 0) {
            const cat = local.categorias[0];
            if (cat.cor) cor = cat.cor;
            if (cat.simbolo && iconClasses[cat.simbolo]) icone = iconClasses[cat.simbolo];
        }

        let markerIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color:${cor}; width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;box-shadow:0 2px 5px rgba(0,0,0,0.3);border:2px solid white;"><i class="fas ${icone}"></i></div>`,
            iconSize: [32, 32],
            popupAnchor: [0, -16]
        });

        let popupContent = `
            <div style="min-width: 200px;">
                <b style="font-size: 16px;">${local.nome}</b>
                <hr style="margin: 5px 0;">
                <p style="margin: 5px 0; font-size: 12px;">${local.descricao || 'Sem descrição'}</p>
                <p style="margin: 5px 0; font-size: 12px; color: #666;">
                    <i class="fas ${icone}"></i> Categoria: ${categoriaPrincipal}
                </p>
        `;

        if (local.fotos && local.fotos.length > 0 && local.fotos[0].url) {
            popupContent += `
                <div style="margin-top: 8px;">
                    <img src="${local.fotos[0].url}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 5px;" 
                         onerror="this.src='https://via.placeholder.com/200x120?text=Sem+Imagem'">
                </div>
            `;
        }

        popupContent += `<hr style="margin: 5px 0;"><small>ID: ${local.id}</small></div>`;

        let marker = L.marker([local.lat, local.lng], { icon: markerIcon });
        marker.options.categoria = categoriaPrincipal;
        marker.options.localId = local.id;
        marker.bindPopup(popupContent);
        marker.addTo(map);

        markersList.push(marker);
        markerObjects[local.id] = marker;
    });

    window.marcadores = markersList;
    window.currentMap = map;
    window.markerObjects = markerObjects;
    window.locaisDataCompleto = locaisData;

    const markerClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50
    });

    markersList.forEach(marker => {
        markerClusterGroup.addLayer(marker);
    });

    window.filtrarMarcadores = function(categoria) {
        window.marcadores.forEach(m => {
            const cat = m.options.categoria;
            if (categoria === 'todos' || cat === categoria) {
                if (!map.hasLayer(m)) m.addTo(map);
            } else {
                if (map.hasLayer(m)) map.removeLayer(m);
            }
        });
    }

    window.centralizarNoMapa = function (localId) {
        const marker = window.markerObjects[localId];
        if (marker) {
            const latLng = marker.getLatLng();
            map.flyTo(latLng, 16);
            marker.openPopup();
        } else if (window.locaisDataCompleto) {
            const local = window.locaisDataCompleto.find(l => l.id == localId);
            if (local) {
                map.flyTo([local.lat, local.lng], 16);
            }
        }
    };

    atualizarBotoesFiltroComCategorias(locaisData);
    preencherCardsDinamicamente(locaisData);

    // --- LÓGICA DE PESQUISA (NOMINATIM) ---
    async function searchPlaces(query) {
        const resultsDiv = document.getElementById('search-results-dropdown');
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
                    item.innerHTML = `<div class="search-result-name">${r.display_name.split(',')[0]}</div><div class="search-result-address">${r.display_name.split(',').slice(1, 4).join(',')}</div>`;
                    item.addEventListener('click', () => {
                        const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
                        if (!isNaN(lat) && !isNaN(lng)) {
                            map.flyTo([lat, lng], 15);
                            if (window.tempSearchMarker) map.removeLayer(window.tempSearchMarker);
                            window.tempSearchMarker = L.marker([lat, lng]).addTo(map);
                            window.tempSearchMarker.bindPopup(r.display_name.split(',')[0]).openPopup();
                            setTimeout(() => {
                                if (window.tempSearchMarker) map.removeLayer(window.tempSearchMarker);
                                window.tempSearchMarker = null;
                            }, 5000);
                        }
                        resultsDiv.style.display = 'none';
                        document.getElementById('search-location-input').value = r.display_name.split(',')[0];
                    });
                    resultsList.appendChild(item);
                });
                resultsDiv.style.display = 'block';
            } else {
                resultsList.innerHTML = '<div class="search-result-item" style="color:#888;">Nenhum resultado encontrado</div>';
                resultsDiv.style.display = 'block';
            }
        } catch (e) {
            console.error(e);
            if (resultsList) {
                resultsList.innerHTML = '<div class="search-result-item" style="color:#888;">Erro na pesquisa</div>';
                if (resultsDiv) resultsDiv.style.display = 'block';
            }
        }
    }

    const searchInput = document.getElementById('search-location-input');
    const searchBtn = document.getElementById('search-location-btn');
    let timeout;

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => searchPlaces(searchInput.value), 500);
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => searchPlaces(searchInput ? searchInput.value : ''));
    }

    document.addEventListener('click', (e) => {
        const container = document.querySelector('.search-bar-container');
        const resultsDiv = document.getElementById('search-results-dropdown');
        if (container && resultsDiv && !container.contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });

    // --- CONFIGURAÇÃO E AUTENTICAÇÃO DO USUÁRIO (SUPABASE) ---

    // Elementos do DOM
    const userBtn = document.getElementById('userHeaderBtn');
    const userDropdown = document.getElementById('userHeaderDropdown');
    const userHeaderName = document.querySelector('.user-header-name');
    const profileBtn = document.getElementById('profileBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Função global para verificar o status do login e atualizar o botão
    async function gerenciarEstadoUsuario() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();

            if (error || !user) {
                // Se NÃO está logado: Garante que o texto seja Visitante
                if (userHeaderName) userHeaderName.textContent = 'Visitante';
                return null;
            }

            // Se ESTÁ logado: Muda o texto do botão "Visitante" para o nome do usuário
            const nomeUsuario = user.user_metadata?.full_name || user.email.split('@')[0];
            if (userHeaderName) userHeaderName.textContent = nomeUsuario;
            
            return user;
        } catch (err) {
            console.error("Erro ao verificar autenticação:", err);
            if (userHeaderName) userHeaderName.textContent = 'Visitante';
            return null;
        }
    }

    // Executa assim que o script carrega para definir o nome correto no botão
    await gerenciarEstadoUsuario();

    // Configuração do clique no botão principal (Visitante / Nome do Usuário)
    if (userBtn) {
        userBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Verifica o estado atual do Supabase no exato momento do clique
            const usuarioLogado = await gerenciarEstadoUsuario();

            if (!usuarioLogado) {
                // SE NÃO ESTIVER LOGADO: Manda direto para a página de login
                window.location.href = 'login.html'; 
            } else {
                // SE ESTIVER LOGADO: Mostra/oculta as opções "Meu Perfil" e "Sair"
                userBtn.classList.toggle('active');
                userDropdown.classList.toggle('show');
            }
        });
    }

    // Fecha o menu de opções se o usuário clicar em qualquer outro lugar da tela
    document.addEventListener('click', (e) => {
        if (userBtn && userDropdown && !userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            userBtn.classList.remove('active');
            userDropdown.classList.remove('show');
        }
    });

    // Ação do botão "Meu Perfil"
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = 'perfil.html';
        });
    }

    // Ação do botão "Sair" (Logout Real no Supabase)
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                alert('Erro ao sair: ' + error.message);
            } else {
                alert('Sessão encerrada com sucesso!');
                window.location.reload(); // Recarrega a página para voltar a ser "Visitante"
            }
        });
    }

    console.log(`Sistema de login e mapa inicializados com sucesso.`);
}

function atualizarBotoesFiltroComCategorias(locaisData) {
    const categoriasContainer = document.getElementById('filtro-botoes-container');
    if (!categoriasContainer) return;

    const categoriasUnicas = new Set();
    categoriasUnicas.add('todos');

    locaisData.forEach(local => {
        if (local.categoria) {
            categoriasUnicas.add(local.categoria);
        }
        if (local.categorias) {
            local.categorias.forEach(cat => {
                if (cat.nome) categoriasUnicas.add(cat.nome.toLowerCase());
            });
        }
    });

    const iconesMap = {
        'todos': 'fa-globe',
        'historico': 'fa-landmark',
        'rota': 'fa-route',
        'miradouro': 'fa-mountain',
        'praia': 'fa-umbrella-beach',
        'restaurante': 'fa-utensils',
        'natureza': 'fa-tree',
        'cultura': 'fa-museum'
    };

    let botoesHtml = '';
    categoriasUnicas.forEach(cat => {
        const icone = iconesMap[cat] || 'fa-map-marker-alt';
        const classeAtiva = cat === 'todos' ? 'active' : '';
        const textoExibicao = cat === 'todos' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1);

        botoesHtml += `
            <button class="filtro-btn ${classeAtiva}" data-categoria="${cat}">
                <i class="fas ${icone}"></i> ${textoExibicao}
            </button>
        `;
    });

    categoriasContainer.innerHTML = botoesHtml;

    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const cat = this.getAttribute('data-categoria');
            if (window.filtrarMarcadores) {
                window.filtrarMarcadores(cat);
            }
        });
    });
}

function preencherCardsDinamicamente(locaisData) {
    const rotas = locaisData.filter(local =>
        local.categoria === 'rota' ||
        (local.categorias && local.categorias.some(c => c.nome.toLowerCase() === 'rota'))
    );

    const historicos = locaisData.filter(local =>
        local.categoria === 'historico' ||
        (local.categorias && local.categorias.some(c =>
            c.nome.toLowerCase() === 'historico' ||
            c.nome.toLowerCase() === 'patrimonio'
        ))
    );

    const rotasContainer = document.getElementById('rotas-container');
    if (rotasContainer) {
        if (rotas.length > 0) {
            rotasContainer.innerHTML = gerarCardsHTML(rotas.slice(0, 3));
        } else {
            rotasContainer.innerHTML = '<p class="text-center">Nenhuma rota encontrada no momento.</p>';
        }
    }

    const historicosContainer = document.getElementById('historicos-container');
    if (historicosContainer) {
        if (historicos.length > 0) {
            historicosContainer.innerHTML = gerarCardsHTML(historicos.slice(0, 3));
        } else {
            historicosContainer.innerHTML = '<p class="text-center">Nenhum ponto histórico encontrado no momento.</p>';
        }
    }
}

function gerarCardsHTML(locais) {
    return locais.map(local => {
        const fotoUrl = local.fotos && local.fotos.length > 0 && local.fotos[0].url
            ? local.fotos[0].url
            : 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format';

        const categoriaNome = local.categoria || (local.categorias && local.categorias[0]?.nome) || 'Geral';
        const categoriaCor = (local.categorias && local.categorias[0]?.cor) || '#007bff';

        const iconesCard = {
            'historico': 'fa-landmark',
            'rota': 'fa-route',
            'miradouro': 'fa-mountain',
            'praia': 'fa-umbrella-beach',
            'restaurante': 'fa-utensils'
        };
        const icone = iconesCard[categoriaNome.toLowerCase()] || 'fa-map-marker-alt';

        return `
            <div class="card" data-local-id="${local.id}">
                <div class="card-img" style="background-image: url('${fotoUrl}'); position: relative;">
                    <span class="card-categoria-badge" style="background-color: ${categoriaCor}; position: absolute; top: 10px; right: 10px; padding: 5px 10px; border-radius: 20px; color: white; font-size: 12px;">
                        <i class="fas ${icone}"></i> ${categoriaNome}
                    </span>
                </div>
                <div class="card-content">
                    <h3>${local.nome}</h3>
                    <p>${local.descricao || 'Sem descrição disponível.'}</p>
                    <a href="#" class="card-link" onclick="window.centralizarNoMapa && window.centralizarNoMapa(${local.id}); return false;">
                        Ver no mapa <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </div>
        `;
    }).join('');
}   
