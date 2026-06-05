// ============================================================
//  index.js
//  Página principal — Mapa Leaflet + dados do Supabase
//  Castelo Sesimbra
// ============================================================

import { supabase } from './supabaseClient.js';

// Aguardar até o HTML estar totalmente carregado antes de correr o código
document.addEventListener('DOMContentLoaded', function () {
  // Verificar se a biblioteca Leaflet (mapa) foi carregada
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
//  Vai à tabela 'locais' buscar todos os pontos com as fotos
//  e categorias relacionadas (JOIN automático do Supabase)
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
//  Função principal — corre depois de tudo estar preparado
// ============================================================
async function initMap() {
  console.log('A carregar dados do Supabase...');
  let locaisData = await buscarDadosSupabase();

  // Se o Supabase não devolveu dados, usar dados de exemplo locais
  // para a página não ficar vazia durante o desenvolvimento
  if (!locaisData || locaisData.length === 0) {
    console.log('Usando dados de exemplo (Supabase vazio ou erro).');
    locaisData = dadosExemplo();
  }

  // Definir os limites do mapa (apenas a região de Sesimbra)
  // O utilizador não consegue arrastar o mapa para fora desta área
  const sesimbraBounds = L.latLngBounds(
    L.latLng(38.40, -9.28),
    L.latLng(38.56, -9.03)
  );

  // Criar o mapa dentro do elemento <div id="map">
  const map = L.map('map', {
    maxBounds: sesimbraBounds,
    maxBoundsViscosity: 1.0,  // 1.0 = limite rígido, não deixa sair
    minZoom: 11,
    maxZoom: 18
  }).setView([38.4545, -9.1043], 13);  // Centro: Sesimbra, zoom 13

  // Adicionar a camada de mapa (CartoDB — visual limpo e em português)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Garantir que o mapa não sai dos limites ao arrastar
  map.on('drag', function () {
    map.panInsideBounds(sesimbraBounds, { animate: false });
  });

  // Mapeamentos de cores e ícones por categoria
  // Estes objetos funcionam como dicionários: chave → valor
  const iconColors = {
    'historico':  '#8B0000',
    'rota':       '#228B22',
    'miradouro':  '#FFA500',
    'praia':      '#20B2AA',
    'restaurante':'#800080',
    'natureza':   '#2E8B57',
    'cultura':    '#4A90E2',
    'default':    '#007bff'
  };

  const iconClasses = {
    'historico':  'fa-landmark',
    'rota':       'fa-route',
    'miradouro':  'fa-mountain',
    'praia':      'fa-umbrella-beach',
    'restaurante':'fa-utensils',
    'natureza':   'fa-tree',
    'cultura':    'fa-museum',
    'landmark':   'fa-landmark',
    'mountain':   'fa-mountain',
    'route':      'fa-route',
    'default':    'fa-map-marker-alt'
  };

  const markersList   = [];   // Lista de todos os marcadores
  const markerObjects = {};   // Dicionário id → marcador (para centralizar no mapa)

  // Criar um marcador no mapa para cada local
  locaisData.forEach(local => {
    // ATENÇÃO: a base de dados usa 'latitude'/'longitude'
    // (não 'lat'/'lng' como estava antes — esta foi uma correção importante)
    const lat = parseFloat(local.latitude);
    const lng = parseFloat(local.longitude);

    // Se as coordenadas não são números válidos, ignorar este local
    if (isNaN(lat) || isNaN(lng)) return;

    // Determinar a categoria principal do local
    // Primeiro tenta pela relação categorias_locais, depois pelo campo 'categoria'
    const catObj = local.categorias_locais?.[0]?.categorias;
    let categoriaPrincipal = catObj?.nome?.toLowerCase() || local.categoria || 'default';
    let cor   = catObj?.cor   || iconColors[categoriaPrincipal] || iconColors.default;
    let icone = catObj?.simbolo
      ? (iconClasses[catObj.simbolo] || 'fa-' + catObj.simbolo)
      : (iconClasses[categoriaPrincipal] || iconClasses.default);

    // Criar o ícone personalizado (um círculo colorido com ícone FontAwesome)
    const markerIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color:${cor};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;box-shadow:0 2px 5px rgba(0,0,0,0.3);border:2px solid white;"><i class="fas ${icone}"></i></div>`,
      iconSize: [32, 32],
      popupAnchor: [0, -16]
    });

    // Construir o conteúdo do popup (balão que aparece ao clicar no marcador)
    let popupContent = `
      <div style="min-width:200px">
        <b style="font-size:16px">${local.nome}</b>
        <hr style="margin:5px 0">
        <p style="margin:5px 0;font-size:12px">${local.descricao || 'Sem descrição'}</p>
        <p style="margin:5px 0;font-size:12px;color:#666">
          <i class="fas ${icone}"></i> ${categoriaPrincipal}
        </p>
    `;

    // Adicionar a primeira foto se existir
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

    // Criar e adicionar o marcador ao mapa
    const marker = L.marker([lat, lng], { icon: markerIcon });
    marker.options.categoria = categoriaPrincipal;
    marker.options.localId   = local.id;
    marker.bindPopup(popupContent);
    marker.addTo(map);

    markersList.push(marker);
    markerObjects[local.id] = marker;
  });

  // Guardar referências globais para serem usadas nas funções de filtro e scroll
  window.marcadores    = markersList;
  window.currentMap    = map;
  window.markerObjects = markerObjects;
  window.locaisDataCompleto = locaisData;

  // Função global para filtrar marcadores por categoria
  // Chamada pelos botões de filtro no HTML
  window.filtrarMarcadores = function(categoria) {
    window.marcadores.forEach(m => {
      const cat = m.options.categoria;
      if (categoria === 'todos' || cat === categoria) {
        if (!map.hasLayer(m)) m.addTo(map);
      } else {
        if (map.hasLayer(m)) map.removeLayer(m);
      }
    });
  };

  // Função global para centrar o mapa num local específico
  // Usada pelos cards de rotas/históricos ("Ver no mapa")
  window.centralizarNoMapa = function(localId) {
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

  // Gerar os botões de filtro e os cards das secções
  atualizarBotoesFiltro(locaisData);
  preencherCards(locaisData);

  // Configurar a barra de pesquisa de locais (Nominatim = API gratuita do OpenStreetMap)
  configurarPesquisa(map);

  // Configurar o menu de utilizador (login/logout no header)
  await configurarMenuUtilizador();

  console.log('Mapa e sistema de utilizador inicializados.');
}


// ============================================================
//  PESQUISA DE LOCAIS (NOMINATIM)
//  Permite pesquisar por nome de rua, local, etc. na área de Sesimbra
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
      // viewbox limita os resultados à área de Sesimbra
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
      // Esperar 500ms depois de o utilizador parar de escrever antes de pesquisar
      // (evita fazer um pedido por cada tecla)
      timeout = setTimeout(() => searchPlaces(searchInput.value), 500);
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => searchPlaces(searchInput?.value || ''));
  }

  // Fechar dropdown ao clicar fora
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
//  Mostra o nome do utilizador e permite logout
// ============================================================
async function configurarMenuUtilizador() {
  const userBtn      = document.getElementById('userHeaderBtn');
  const userDropdown = document.getElementById('userHeaderDropdown');
  const userHeaderName = document.querySelector('.user-header-name');
  const profileBtn   = document.getElementById('fakeProfileBtn');
  const logoutBtn    = document.getElementById('fakeLogoutBtn');

  // Verificar se há sessão ativa
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Utilizador está logado — mostrar o nome
    const nome = user.user_metadata?.full_name || user.email.split('@')[0];
    if (userHeaderName) userHeaderName.textContent = nome;

    // Atualizar também o rodapé
    const rodapeNome = document.querySelector('.footer-bottom-right strong');
    if (rodapeNome) rodapeNome.textContent = nome;
  } else {
    // Não está logado — mostrar "Visitante"
    if (userHeaderName) userHeaderName.textContent = 'Visitante';
  }

  // Abrir/fechar dropdown ou ir para o login se não estiver logado
  if (userBtn) {
    userBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        window.location.href = '/login.html';
      } else {
        userBtn.classList.toggle('active');
        userDropdown.classList.toggle('show');
      }
    });
  }

  // Fechar dropdown ao clicar fora
  document.addEventListener('click', (e) => {
    if (userBtn && userDropdown && !userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
      userBtn.classList.remove('active');
      userDropdown.classList.remove('show');
    }
  });

  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      // Página de perfil (podes criar depois)
      alert('Página de perfil em desenvolvimento!');
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
//  Gerados dinamicamente com base nas categorias dos locais
// ============================================================
function atualizarBotoesFiltro(locaisData) {
  const container = document.getElementById('filtro-botoes-container');
  if (!container) return;

  // Recolher todas as categorias únicas dos locais
  const categoriasUnicas = new Set(['todos']);

  locaisData.forEach(local => {
    // Tentar pelas categorias da base de dados primeiro
    if (local.categorias_locais?.length > 0) {
      local.categorias_locais.forEach(cl => {
        if (cl.categorias?.nome) categoriasUnicas.add(cl.categorias.nome.toLowerCase());
      });
    } else if (local.categoria) {
      categoriasUnicas.add(local.categoria.toLowerCase());
    }
  });

  const iconesMap = {
    'todos':      'fa-globe',
    'historico':  'fa-landmark',
    'rota':       'fa-route',
    'miradouro':  'fa-mountain',
    'praia':      'fa-umbrella-beach',
    'restaurante':'fa-utensils',
    'natureza':   'fa-tree',
    'cultura':    'fa-museum'
  };

  let html = '';
  categoriasUnicas.forEach(cat => {
    const icone    = iconesMap[cat] || 'fa-map-marker-alt';
    const ativo    = cat === 'todos' ? 'active' : '';
    const texto    = cat === 'todos' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1);
    html += `<button class="filtro-btn ${ativo}" data-categoria="${cat}"><i class="fas ${icone}"></i> ${texto}</button>`;
  });

  container.innerHTML = html;

  // Adicionar evento de clique a cada botão de filtro
  document.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      if (window.filtrarMarcadores) window.filtrarMarcadores(this.getAttribute('data-categoria'));
    });
  });
}


// ============================================================
//  CARDS DE ROTAS E PONTOS HISTÓRICOS
//  Preenche as secções do HTML com cards dinâmicos
// ============================================================
function preencherCards(locaisData) {
  // Separar locais por tipo de categoria
  const rotas = locaisData.filter(l => {
    const cat = l.categorias_locais?.[0]?.categorias?.nome?.toLowerCase() || l.categoria || '';
    return cat === 'rota';
  });

  const historicos = locaisData.filter(l => {
    const cat = l.categorias_locais?.[0]?.categorias?.nome?.toLowerCase() || l.categoria || '';
    return cat === 'historico' || cat === 'patrimonio' || cat === 'historia';
  });

  const rotasContainer     = document.getElementById('rotas-container');
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

    const catObj     = local.categorias_locais?.[0]?.categorias;
    const catNome    = catObj?.nome || local.categoria || 'Geral';
    const catCor     = catObj?.cor  || '#007bff';

    const iconesCard = {
      'historico':  'fa-landmark',
      'rota':       'fa-route',
      'miradouro':  'fa-mountain',
      'praia':      'fa-umbrella-beach',
      'restaurante':'fa-utensils'
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
//  Usa o formato correto: latitude/longitude (não lat/lng)
// ============================================================
function dadosExemplo() {
  return [
    {
      id: 1, nome: 'Castelo de Sesimbra',
      latitude: 38.4550, longitude: -9.1025,
      descricao: 'Fortificação medieval com vista deslumbrante sobre a vila',
      categoria: 'historico',
      categorias_locais: [{ categorias: { nome: 'historico', cor: '#8B0000', simbolo: 'landmark' } }],
      fotos: []
    },
    {
      id: 2, nome: 'Farol do Cabo Espichel',
      latitude: 38.4186, longitude: -9.2187,
      descricao: 'Farol histórico do século XVIII',
      categoria: 'historico',
      categorias_locais: [{ categorias: { nome: 'historico', cor: '#8B0000', simbolo: 'landmark' } }],
      fotos: []
    },
    {
      id: 3, nome: 'Miradouro do Facho',
      latitude: 38.4420, longitude: -9.1020,
      descricao: 'Vista panorâmica sobre a costa e a vila',
      categoria: 'miradouro',
      categorias_locais: [{ categorias: { nome: 'miradouro', cor: '#FFA500', simbolo: 'mountain' } }],
      fotos: []
    },
    {
      id: 4, nome: 'Praia do Ouro',
      latitude: 38.4385, longitude: -9.0805,
      descricao: 'Praia urbana muito procurada na época balnear',
      categoria: 'praia',
      categorias_locais: [{ categorias: { nome: 'praia', cor: '#20B2AA', simbolo: 'umbrella-beach' } }],
      fotos: []
    },
    {
      id: 5, nome: 'Trilho da Lagoa de Albufeira',
      latitude: 38.4470, longitude: -9.0950,
      descricao: 'Percurso pedestre com vista para a lagoa',
      categoria: 'rota',
      categorias_locais: [{ categorias: { nome: 'rota', cor: '#228B22', simbolo: 'route' } }],
      fotos: [{url: "https://sandee.com/_next/image?url=https%3A%2F%2Flh5.googleusercontent.com%2Fp%2FAF1QipOtAAlbE-YnNp8GjLREX25ZPn5y26JTsrdE9HJ9%3Ds1600-k-no&w=3840&q=75"}]
    }
  ];
}
