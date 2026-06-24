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
//  VARIÁVEIS GLOBAIS
// ============================================================
let todasCategorias = [];
let todosLocais = [];
let todasRotas = [];
let todosMarcadores = [];
let mapaAtual = null;
let marcadoresPorId = {};
let rotasPorLocalId = {};
let rotaLayerGroup = null;
let currentRouteDistance = 0;
let currentRouteDuration = 0;
let currentTransportMode = 'driving';
let cacheLinhasCarris = null;
const ROUTING_API_BASE = 'https://router.project-osrm.org/route/v1/';

async function buscarDadosSupabase() {
  try {
    // Buscar locais com fotos e categorias
    const { data: locais, error: locaisError } = await supabase
      .from('locais')
      .select(`
        *,
        fotos ( url, descricao ),
        categorias_locais (
          categorias ( id, nome, cor, simbolo )
        )
      `);

    if (locaisError) {
      console.error('Erro ao buscar locais:', locaisError);
      throw locaisError;
    }

    // Buscar todas as categorias da tabela categorias
    const { data: categorias, error: categoriasError } = await supabase
      .from('categorias')
      .select('*')
      .order('nome');

    if (categoriasError) {
      console.error('Erro ao buscar categorias:', categoriasError);
      throw categoriasError;
    }

    // Buscar rotas com suas categorias
    const { data: rotas, error: rotasError } = await supabase
      .from('rotas')
      .select(`
        *,
        categorias_rotas (
          categorias ( id, nome, cor, simbolo )
        )
      `)
      .order('nome');

    if (rotasError) {
      console.error('Erro ao buscar rotas:', rotasError);
      throw rotasError;
    }

    // Buscar segmentos para cada rota
    for (const rota of rotas || []) {
      const { data: segmentos, error: segmentosError } = await supabase
        .from('segmentos_rota')
        .select('*')
        .eq('rota_id', rota.id)
        .order('ordem_segmento');
      if (segmentosError) {
        console.error('Erro ao buscar segmentos da rota:', segmentosError);
        throw segmentosError;
      }
      rota.segmentos = segmentos || [];
    }

    console.log('📊 Locais carregados:', locais?.length || 0);
    console.log('🏷️ Categorias carregadas:', categorias?.length || 0);
    console.log('🧭 Rotas carregadas:', rotas?.length || 0);
    console.log('📋 Categorias:', categorias);

    todosLocais = locais || [];
    todasCategorias = categorias || [];
    todasRotas = rotas || [];
    construirRotasPorLocal(todasRotas);

    return { locais: todosLocais, categorias: todasCategorias, rotas: todasRotas };
  } catch (error) {
    console.error('Erro ao buscar dados do Supabase:', error.message);
  }
}

function construirRotasPorLocal(rotas) {
  rotasPorLocalId = {};
  (rotas || []).forEach(rota => {
    const localIds = new Set();
    (rota.segmentos || []).forEach(seg => {
      if (seg.local_origem_id) localIds.add(seg.local_origem_id);
      if (seg.local_destino_id) localIds.add(seg.local_destino_id);
    });
    localIds.forEach(id => {
      rotasPorLocalId[id] = rotasPorLocalId[id] || [];
      rotasPorLocalId[id].push(rota);
    });
  });
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
    } catch (e) {
      // Sem horários em tempo real disponíveis
    }

    return `
      <hr style="margin: 8px 0; border: 0; border-top: 1px dashed #ccc;">
      <div style="font-size:12px;">
        <b>Paragem mais próxima:</b> ${escapeHtml(paragem.name || paragem.id)} (${Math.round(paragem.distancia)}m a pé)<br>
        🚌 <b>Linhas:</b> ${escapeHtml(linhasStr)}
        ${horariosHtml}
      </div>
    `;
  } catch (error) {
    console.error('Erro ao buscar dados da Carris Metropolitana:', error);
    return "<br>🚌 <b>Autocarros:</b> Erro ao carregar dados da Carris Metropolitana.";
  }
}

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

window.getRouteFromOSRM = async function (pontos) {
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

function formatRoutePopup(route) {
  const distancia = route.distance > 0 ? `${route.distance.toFixed(1)} km` : 'N/A';
  const tempo = route.duration > 0 ? `${Math.round(route.duration)} min` : 'N/A';
  const modo = currentTransportMode === 'foot' ? '🚶 A pé' : '🚗 De carro';
  return `
    <div style="font-family: sans-serif; min-width: 220px;">
      <strong style="color: #979d23; font-size: 14px;">Informação do Trajeto</strong><br>
      🛣️ <b>Distância Total:</b> ${distancia}<br>
      ⏱️ <b>Tempo estimado:</b> ${tempo}<br>
      🚦 <b>Modo:</b> ${modo}
    </div>
  `;
}

// ============================================================
//  INICIALIZAR O MAPA
// ============================================================
async function initMap() {
  console.log('🚀 A inicializar mapa...');

  // Buscar dados
  const dados = await buscarDadosSupabase();
  todosLocais = dados.locais;
  todasCategorias = dados.categorias;
  todasRotas = dados.rotas || [];
  construirRotasPorLocal(todasRotas);

  // Se não houver dados, mostrar mensagem
  if (!todosLocais || todosLocais.length === 0) {
    console.warn('⚠️ Nenhum local encontrado');
    return;
  }

  // Definir os limites do mapa (apenas a região de Sesimbra)
  const sesimbraBounds = L.latLngBounds(
    L.latLng(38.40, -9.28),
    L.latLng(38.56, -9.03)
  );

  // Criar o mapa dentro do elemento <div id="map">
  const map = L.map('map', {
    maxBounds: sesimbraBounds,
    maxBoundsViscosity: 1.0,
    minZoom: 11,
    maxZoom: 18
  }).setView([38.4545, -9.1043], 13);

  // Adicionar a camada de mapa
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Garantir que o mapa não sai dos limites ao arrastar
  map.on('drag', function () {
    map.panInsideBounds(sesimbraBounds, { animate: false });
  });

  mapaAtual = map;

  // Criar marcadores
  criarMarcadores(todosLocais, map);

  // Atualizar os botões de filtro
  await atualizarBotoesFiltro(todasCategorias);

  // Preencher os cards
  preencherCards(todosLocais);

  // Configurar a barra de pesquisa
  configurarPesquisa(map);

  // Configurar o menu de utilizador
  await configurarMenuUtilizador();

  console.log('✅ Mapa inicializado com sucesso!');
}

// ============================================================
//  CRIAR MARCADORES NO MAPA
// ============================================================
// ============================================================
//  CRIAR MARCADORES NO MAPA
// ============================================================
function criarMarcadores(locais, map) {
  // Limpar marcadores anteriores
  todosMarcadores.forEach(m => {
    if (map.hasLayer(m)) map.removeLayer(m);
  });
  todosMarcadores = [];
  marcadoresPorId = {};

  // Mapeamento de ícones por categoria
  const iconesMap = {
    'historico': 'fa-landmark',
    'rota': 'fa-route',
    'miradouro': 'fa-mountain',
    'praia': 'fa-umbrella-beach',
    'restaurante': 'fa-utensils',
    'natureza': 'fa-tree',
    'cultura': 'fa-museum',
    'patrimonio': 'fa-monument',
    'historia': 'fa-book-open',
    'gastronomia': 'fa-utensil-spoon',
    'desporto': 'fa-running',
    'religioso': 'fa-church',
    'militar': 'fa-shield-alt'
  };

  locais.forEach(local => {
    const lat = parseFloat(local.latitude);
    const lng = parseFloat(local.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    // Obter categoria do local
    let categoriaInfo = null;
    let categoriaNome = 'default';

    if (local.categorias_locais && local.categorias_locais.length > 0) {
      const cat = local.categorias_locais[0].categorias;
      if (cat) {
        categoriaInfo = cat;
        // Guardar o nome exato da categoria (como está na base de dados)
        categoriaNome = cat.nome || 'default';
      }
    } else if (local.categoria) {
      categoriaNome = local.categoria;
    }

    // Guardar TANTO o nome original como o nome em minúsculas para comparação
    const categoriaNomeLower = categoriaNome.toLowerCase();

    // Obter cor e ícone
    const cor = categoriaInfo?.cor || '#007bff';
    const simbolo = categoriaInfo?.simbolo || categoriaNomeLower;
    const icone = iconesMap[simbolo] || iconesMap[categoriaNomeLower] || 'fa-map-marker-alt';

    // Criar ícone personalizado
    const markerIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color:${cor};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;box-shadow:0 2px 5px rgba(0,0,0,0.3);border:2px solid white;"><i class="fas ${icone}"></i></div>`,
      iconSize: [32, 32],
      popupAnchor: [0, -16]
    });

    // Construir popup
    let popupContent = `
      <div style="min-width:200px">
        <b style="font-size:16px">${local.nome}</b>
        <hr style="margin:5px 0">
        <p style="margin:5px 0;font-size:12px">${local.descricao || 'Sem descrição'}</p>
        <p style="margin:5px 0;font-size:12px;color:#666">
          <i class="fas ${icone}"></i> ${categoriaNome}
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

    const rotasAssociadas = rotasPorLocalId[local.id] || [];
    if (rotasAssociadas.length > 0) {
      popupContent += `<hr style="margin:5px 0"><div style="margin-top:8px"><strong style="font-size:13px">Rotas relacionadas</strong><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">`;
      rotasAssociadas.forEach(rota => {
        const corRota = rota.cor || '#228B22';
        popupContent += `
          <button onclick="window.mostrarRota(${rota.id})" style="cursor:pointer;border:none;border-radius:8px;padding:6px 10px;background:${corRota};color:white;font-size:12px;white-space:nowrap">
            ${escapeHtml(rota.nome)}
          </button>
        `;
      });
      popupContent += `</div></div>`;
    } else {
      popupContent += `<hr style="margin:5px 0"><small>ID: ${local.id}</small>`;
    }
    popupContent += `</div>`;

    // Criar marcador - GUARDAR A CATEGORIA EM MINÚSCULAS para comparação
    const marker = L.marker([lat, lng], { icon: markerIcon });
    marker.options.categoria = categoriaNomeLower; // Guardar em minúsculas
    marker.options.categoriaOriginal = categoriaNome; // Guardar o original também
    marker.options.localId = local.id;
    marker.bindPopup(popupContent);
    marker.addTo(map);

    todosMarcadores.push(marker);
    marcadoresPorId[local.id] = marker;
  });

  // Função global para filtrar marcadores
  window.filtrarMarcadores = function (categoria) {
    console.log(`🔍 Filtrando por categoria: "${categoria}"`);
    console.log(`📊 Total de marcadores: ${todosMarcadores.length}`);

    let marcadoresVisiveis = 0;

    todosMarcadores.forEach(m => {
      const catDoMarcador = m.options.categoria; // Está em minúsculas
      const categoriaFiltro = categoria.toLowerCase(); // Garantir minúsculas

      // Verificar se o marcador deve ser mostrado
      const deveMostrar = categoria === 'todos' || catDoMarcador === categoriaFiltro;

      if (deveMostrar) {
        if (!map.hasLayer(m)) {
          m.addTo(map);
          marcadoresVisiveis++;
        }
      } else {
        if (map.hasLayer(m)) {
          map.removeLayer(m);
        }
      }
    });

    console.log(`👁️ Marcadores visíveis: ${marcadoresVisiveis}`);
  };

  // Função global para centralizar no mapa
  window.centralizarNoMapa = function (localId) {
    const marker = marcadoresPorId[localId];
    if (marker) {
      map.flyTo(marker.getLatLng(), 16);
      marker.openPopup();
    } else {
      const local = todosLocais.find(l => l.id == localId);
      if (local) {
        const lat = parseFloat(local.latitude);
        const lng = parseFloat(local.longitude);
        if (!isNaN(lat) && !isNaN(lng)) map.flyTo([lat, lng], 16);
      }
    }
  };

  window.mostrarRota = function (rotaId) {
    const rota = todasRotas.find(r => r.id === rotaId);
    if (!rota) {
      alert('Rota não encontrada.');
      return;
    }

    const pontosRota = [];
    if (rota.segmentos && rota.segmentos.length > 0) {
      const primeiroLocal = todosLocais.find(l => l.id === rota.segmentos[0].local_origem_id);
      if (primeiroLocal) pontosRota.push(primeiroLocal);
      rota.segmentos.forEach(seg => {
        const destino = todosLocais.find(l => l.id === seg.local_destino_id);
        if (destino) pontosRota.push(destino);
      });
    }

    if (pontosRota.length < 2) {
      alert('Esta rota não tem pontos suficientes para ser exibida.');
      return;
    }

    if (!rotaLayerGroup) rotaLayerGroup = L.layerGroup().addTo(mapaAtual);
    rotaLayerGroup.clearLayers();

    const coordinates = pontosRota
      .map(p => [parseFloat(p.latitude), parseFloat(p.longitude)])
      .filter(coord => !coord.some(v => Number.isNaN(v)));

    pontosRota.forEach((p, index) => {
      const marker = L.circleMarker([p.latitude, p.longitude], {
        radius: 7,
        fillColor: rota.cor || '#228B22',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
      }).addTo(rotaLayerGroup);
      marker.bindPopup(`<strong>${escapeHtml(p.nome)}</strong><br>${escapeHtml(p.descricao || '')}`);
      marker.bindTooltip(`${index + 1}`, { permanent: true, direction: 'top', className: 'route-point-label' }).openTooltip();
    });

    const routeLine = L.polyline(coordinates, {
      color: rota.cor || '#228B22',
      weight: 6,
      opacity: 0.85,
      lineJoin: 'round',
      dashArray: '8,6'
    }).addTo(rotaLayerGroup);

    const bounds = routeLine.getBounds();
    if (bounds.isValid()) {
      mapaAtual.flyToBounds(bounds.pad(0.15));
    }

    routeLine.bindPopup('A carregar dados do trajeto...');
    routeLine.on('click', async function (e) {
      const popupConteudoBase = formatRoutePopup({ distance: currentRouteDistance, duration: currentRouteDuration });
      routeLine.setPopupContent(popupConteudoBase + '<br>⏳ A procurar paragens da Carris Metropolitana...');
      const dadosCarris = await getCarrisMetropolitanaData(e.latlng.lat, e.latlng.lng);
      routeLine.setPopupContent(popupConteudoBase + dadosCarris);
    });
    routeLine.on('mouseover', function () {
      this.setStyle({ weight: 8, opacity: 1 });
    });
    routeLine.on('mouseout', function () {
      this.setStyle({ weight: 6, opacity: 0.85 });
    });

    window.getRouteFromOSRM(pontosRota).then(route => {
      if (route && route.geometry) {
        currentRouteDistance = route.distance;
        currentRouteDuration = route.duration;
        rotaLayerGroup.clearLayers();
        const osrmLayer = L.geoJSON(route.geometry, {
          style: { color: rota.cor || '#228B22', weight: 6, opacity: 0.85, lineJoin: 'round', dashArray: '8,6' }
        }).addTo(rotaLayerGroup);
        pontosRota.forEach((p, index) => {
          const marker = L.circleMarker([p.latitude, p.longitude], {
            radius: 7,
            fillColor: rota.cor || '#228B22',
            color: '#ffffff',
            weight: 2,
            fillOpacity: 1
          }).addTo(rotaLayerGroup);
          marker.bindPopup(`<strong>${escapeHtml(p.nome)}</strong><br>${escapeHtml(p.descricao || '')}`);
          marker.bindTooltip(`${index + 1}`, { permanent: true, direction: 'top', className: 'route-point-label' }).openTooltip();
        });
        osrmLayer.bindPopup(formatRoutePopup(route));
        osrmLayer.on('click', async function (e) {
          const popupConteudoBase = formatRoutePopup(route);
          osrmLayer.setPopupContent(popupConteudoBase + '<br>⏳ A procurar paragens da Carris Metropolitana...');
          const dadosCarris = await getCarrisMetropolitanaData(e.latlng.lat, e.latlng.lng);
          osrmLayer.setPopupContent(popupConteudoBase + dadosCarris);
        });
        osrmLayer.on('mouseover', function () { this.setStyle({ weight: 8, opacity: 1 }); });
        osrmLayer.on('mouseout', function () { this.setStyle({ weight: 6, opacity: 0.85 }); });
        if (bounds.isValid()) mapaAtual.flyToBounds(bounds.pad(0.15));
      }
    });

    L.popup({ closeOnClick: false, autoClose: false })
      .setLatLng(coordinates[0])
      .setContent(`<strong>${escapeHtml(rota.nome)}</strong><br>${escapeHtml(rota.descricao || '')}`)
      .openOn(mapaAtual);
  };

  window.marcadores = todosMarcadores;
  window.currentMap = map;
  window.markerObjects = marcadoresPorId;
  window.locaisDataCompleto = todosLocais;

  console.log(`📍 ${todosMarcadores.length} marcadores criados`);
  // Log das categorias dos marcadores para debug
  const categoriasDosMarcadores = new Set();
  todosMarcadores.forEach(m => categoriasDosMarcadores.add(m.options.categoria));
  console.log('🏷️ Categorias dos marcadores:', Array.from(categoriasDosMarcadores));
}

// ============================================================
//  BOTÕES DE FILTRO - VERSÃO CORRIGIDA
// ============================================================
async function atualizarBotoesFiltro(categorias) {
  const container = document.getElementById('filtro-botoes-container');
  if (!container) {
    console.error('Container de filtros não encontrado');
    return;
  }

  console.log('🏷️ Dados recebidos para filtros:', categorias);

  // Se não houver categorias, usar as que existem nos locais
  let categoriasParaUsar = categorias;

  if (!categoriasParaUsar || categoriasParaUsar.length === 0) {
    // Extrair categorias dos locais
    const categoriasSet = new Set();
    todosLocais.forEach(local => {
      if (local.categorias_locais && local.categorias_locais.length > 0) {
        local.categorias_locais.forEach(cl => {
          if (cl.categorias?.nome) {
            categoriasSet.add(cl.categorias.nome);
          }
        });
      } else if (local.categoria) {
        categoriasSet.add(local.categoria);
      }
    });

    categoriasParaUsar = Array.from(categoriasSet).map(nome => ({
      nome: nome,
      cor: '#007bff',
      simbolo: 'map-marker-alt'
    }));
  }

  console.log('🏷️ Categorias para os filtros:', categoriasParaUsar);

  // Mapeamento de ícones
  const iconesMap = {
    'todos': 'fa-globe',
    'historico': 'fa-landmark',
    'rota': 'fa-route',
    'miradouro': 'fa-mountain',
    'praia': 'fa-umbrella-beach',
    'restaurante': 'fa-utensils',
    'natureza': 'fa-tree',
    'cultura': 'fa-museum',
    'patrimonio': 'fa-monument',
    'historia': 'fa-book-open',
    'gastronomia': 'fa-utensil-spoon',
    'desporto': 'fa-running',
    'religioso': 'fa-church',
    'militar': 'fa-shield-alt'
  };

  // Gerar HTML dos botões
  let html = '';

  // Botão "Todos" sempre primeiro
  html += `<button class="filtro-btn active" data-categoria="todos">
    <i class="fas fa-globe"></i> Todos
  </button>`;

  // Ordenar categorias alfabeticamente
  const categoriasOrdenadas = [...categoriasParaUsar].sort((a, b) => {
    const nomeA = typeof a === 'string' ? a : a.nome;
    const nomeB = typeof b === 'string' ? b : b.nome;
    return nomeA.localeCompare(nomeB);
  });

  categoriasOrdenadas.forEach(cat => {
    const nome = typeof cat === 'string' ? cat : cat.nome;
    const cor = typeof cat === 'string' ? '#007bff' : cat.cor || '#007bff';
    const simbolo = typeof cat === 'string' ? nome : cat.simbolo || nome;

    // Usar o nome em minúsculas para o data-categoria
    const categoriaKey = nome.toLowerCase();
    const icone = iconesMap[categoriaKey] || iconesMap[simbolo] || 'fa-map-marker-alt';
    const texto = nome; // Manter o nome original para exibição

    html += `
      <button class="filtro-btn" data-categoria="${categoriaKey}" style="border-color: ${cor}">
        <i class="fas ${icone}" style="color: ${cor}"></i> ${texto}
      </button>
    `;
  });

  container.innerHTML = html;

  // Adicionar eventos de clique
  document.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      // Remover classe active de todos
      document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
      // Adicionar ao clicado
      this.classList.add('active');

      const categoria = this.getAttribute('data-categoria');
      console.log(`🖱️ Botão clicado: "${categoria}"`);

      if (window.filtrarMarcadores) {
        window.filtrarMarcadores(categoria);
      } else {
        console.error('❌ função filtrarMarcadores não encontrada');
      }
    });
  });

  console.log(`✅ ${categoriasOrdenadas.length + 1} botões de filtro criados`);
}

function preencherCards(locais) {
  // 1. Filtrar Pontos Históricos a partir dos locais carregados
  const historicos = locais.filter(l => {
    const cat = getCategoriaLocal(l);
    return cat === 'pontos históricos' || cat === 'historico' || cat === 'patrimonio' || cat === 'historia';
  });

  // 2. FILTRAR ROTAS PELA CATEGORIA "Rotas Turísticas"
  const rotasTuristicas = todasRotas.filter(rota => {
    // Verificar se a rota tem a categoria "Rotas Turísticas"
    if (rota.categorias_rotas && Array.isArray(rota.categorias_rotas)) {
      return rota.categorias_rotas.some(cr => {
        const nomeCategoria = cr.categorias?.nome?.toLowerCase() || '';
        return nomeCategoria === 'rotas turísticas' || 
               nomeCategoria === 'rota turística' || 
               nomeCategoria === 'rotas turisticas' ||
               nomeCategoria === 'rota turistica';
      });
    }
    return false;
  });

  const rotasContainer = document.getElementById('rotas-container');
  const historicosContainer = document.getElementById('historicos-container');

  // 3. Preencher o container de Rotas Turísticas
  if (rotasContainer) {
    rotasContainer.innerHTML = rotasTuristicas.length > 0
      ? gerarCardsRotasHTML(rotasTuristicas)
      : '<p class="text-center" style="color:#888">Nenhuma rota turística encontrada no momento.</p>';
  }

  // 4. Preencher o container de Pontos Históricos
  if (historicosContainer) {
    historicosContainer.innerHTML = historicos.length > 0
      ? gerarCardsLocaisHTML(historicos)
      : '<p class="text-center" style="color:#888">Nenhum ponto histórico encontrado no momento.</p>';
  }
}

function getCategoriaLocal(local) {
  if (local.categorias_locais && local.categorias_locais.length > 0) {
    const cat = local.categorias_locais[0].categorias;
    if (cat && cat.nome) return cat.nome.toLowerCase();
  }
  return local.categoria?.toLowerCase() || 'outro';
}

// Gerar HTML para os Cards de Pontos (Locais)
function gerarCardsLocaisHTML(locais) {
  return locais.map(local => {
    const fotoUrl = local.fotos?.[0]?.url || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format';
    const catNome = getCategoriaLocal(local);
    const catInfo = todasCategorias.find(c => c.nome?.toLowerCase() === catNome);
    const catCor = catInfo?.cor || '#f2ff00';
    const simbolo = catInfo?.simbolo || '🏰';

    return `
      <div class="card" data-local-id="${local.id}">
        <div class="card-img" style="background-image:url('${fotoUrl}'); position:relative; height: 180px; background-size: cover; background-position: center; border-radius: 8px 8px 0 0;">
          <span style="background-color:${catCor}; position:absolute; top:10px; right:10px; padding:5px 10px; border-radius:20px; color:#000; font-weight:bold; font-size:12px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            ${simbolo} Ponto Histórico
          </span>
        </div>
        <div class="card-content" style="padding: 15px;">
          <h3 style="margin-top:0; font-size:18px;">${local.nome}</h3>
          <p style="color:#555; font-size:14px; line-height:1.4; height: 60px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
            ${local.descricao || 'Sem descrição disponível.'}
          </p>
          <a href="#map" class="card-link" style="display: inline-block; margin-top: 10px; color: #007bff; text-decoration: none; font-weight: bold;" 
             onclick="window.focarNoMapa('local', ${local.id}); return false;">
            Ver no mapa <i class="fas fa-arrow-right"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function gerarCardsRotasHTML(rotas) {
  return rotas.map(rota => {
    // Obter a primeira categoria da rota (se existir)
    let categoriaInfo = null;
    let catCor = '#00ff7b';
    let simbolo = '🧭';
    
    if (rota.categorias_rotas && rota.categorias_rotas.length > 0) {
      const cat = rota.categorias_rotas[0].categorias;
      if (cat) {
        categoriaInfo = cat;
        catCor = cat.cor || '#00ff7b';
        simbolo = cat.simbolo || '🧭';
      }
    }
    
    // Usar a cor da rota se definida, senão usar a cor da categoria
    const corFinal = rota.cor || catCor;
    
    // Tentar obter uma imagem do primeiro ponto da rota
    let fotoUrl = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format';
    if (rota.segmentos && rota.segmentos.length > 0) {
      const primeiroLocal = todosLocais.find(l => l.id === rota.segmentos[0].local_origem_id);
      if (primeiroLocal && primeiroLocal.fotos && primeiroLocal.fotos.length > 0) {
        fotoUrl = primeiroLocal.fotos[0].url || fotoUrl;
      }
    }

    return `
      <div class="card" data-rota-id="${rota.id}">
        <div class="card-img" style="background-image:url('${fotoUrl}'); position:relative; height: 180px; background-size: cover; background-position: center; border-radius: 8px 8px 0 0;">
          <span style="background-color:${corFinal}; position:absolute; top:10px; right:10px; padding:5px 10px; border-radius:20px; color:#000; font-weight:bold; font-size:12px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            ${simbolo} Rota Turística
          </span>
        </div>
        <div class="card-content" style="padding: 15px;">
          <h3 style="margin-top:0; font-size:18px;">${escapeHtml(rota.nome)}</h3>
          <p style="color:#555; font-size:14px; line-height:1.4; height: 60px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
            ${escapeHtml(rota.descricao || 'Sem descrição disponível.')}
          </p>
          <a href="#map" class="card-link" style="display: inline-block; margin-top: 10px; color: #007bff; text-decoration: none; font-weight: bold;" 
             onclick="window.focarNoMapa('rota', ${rota.id}); return false;">
            Ver no mapa <i class="fas fa-arrow-right"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function getCategoriaRota(rota) {
  if (rota.categorias_rotas && Array.isArray(rota.categorias_rotas)) {
    for (const cr of rota.categorias_rotas) {
      if (cr.categorias && cr.categorias.nome) {
        return cr.categorias.nome.toLowerCase();
      }
    }
  }
  return null;
}

// Função auxiliar global para fazer scroll suave e ativar o ponto/rota correspondente
window.focarNoMapa = function (tipo, id) {
  const mapaElemento = document.getElementById('map');
  if (mapaElemento) {
    // Scroll suave até ao mapa
    mapaElemento.scrollIntoView({ behavior: 'smooth' });

    // Aguarda um pequeno momento para o scroll terminar e depois foca a informação
    setTimeout(() => {
      if (tipo === 'local' && window.centralizarNoMapa) {
        window.centralizarNoMapa(id);
      } else if (tipo === 'rota' && window.mostrarRota) {
        window.mostrarRota(id);
      }
    }, 500);
  }
};


function gerarCardsHTML(locais) {
  return locais.map(local => {
    const fotoUrl = local.fotos?.[0]?.url ||
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format';

    const catNome = getCategoriaLocal(local);

    // Procurar a categoria na lista de todas as categorias
    const catInfo = todasCategorias.find(c => c.nome?.toLowerCase() === catNome);
    const catCor = catInfo?.cor || '#007bff';

    const iconesCard = {
      'historico': 'fa-landmark',
      'rota': 'fa-route',
      'miradouro': 'fa-mountain',
      'praia': 'fa-umbrella-beach',
      'restaurante': 'fa-utensils',
      'natureza': 'fa-tree',
      'cultura': 'fa-museum'
    };
    const icone = iconesCard[catNome] || 'fa-map-marker-alt';

    return `
      <div class="card" data-local-id="${local.id}">
        <div class="card-img" style="background-image:url('${fotoUrl}');position:relative">
          <span style="background-color:${catCor};position:absolute;top:10px;right:10px;padding:5px 10px;border-radius:20px;color:white;font-size:12px">
            <i class="fas ${icone}"></i> ${catNome.charAt(0).toUpperCase() + catNome.slice(1)}
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
//  PESQUISA DE LOCAIS (NOMINATIM)
// ============================================================
function configurarPesquisa(map) {
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
  const searchBtn = document.getElementById('search-location-btn');
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
    const resultsDiv = document.getElementById('search-results-dropdown');
    if (container && resultsDiv && !container.contains(e.target)) {
      resultsDiv.style.display = 'none';
    }
  });
}

// ============================================================
//  MENU DE UTILIZADOR
// ============================================================
async function configurarMenuUtilizador() {
  const userBtn = document.getElementById('userHeaderBtn');
  const userDropdown = document.getElementById('userHeaderDropdown');
  const userHeaderName = document.querySelector('.user-header-name');
  const profileBtn = document.getElementById('fakeProfileBtn');
  const logoutBtn = document.getElementById('fakeLogoutBtn');
  const adminBtn = document.getElementById('paginaadminBtn');

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single();

      let nome = profileData?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilizador';

      if (userHeaderName) userHeaderName.textContent = nome;

      const rodapeNome = document.querySelector('.footer-bottom-right strong');
      if (rodapeNome) rodapeNome.textContent = nome;

      const isAdmin = profileData?.role === 'admin';
      if (adminBtn) {
        adminBtn.style.display = isAdmin ? 'flex' : 'none';
        if (isAdmin) console.log('🔐 Botão de admin visível para:', nome);
      }
    } else {
      if (userHeaderName) userHeaderName.textContent = 'Visitante';
      if (adminBtn) adminBtn.style.display = 'none';
    }
  } catch (error) {
    console.error('Erro ao configurar menu:', error);
  }

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

  document.addEventListener('click', (e) => {
    if (userBtn && userDropdown && !userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
      userBtn.classList.remove('active');
      userDropdown.classList.remove('show');
    }
  });

  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      window.location.href = './perfil.html';
    });
  }

  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      window.location.href = './paginaadmin.html';
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

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.scrollCarrossel = function(containerId, distancia) {
  const container = document.getElementById(containerId);
  if (container) {
    container.scrollBy({
      left: distancia,
      behavior: 'smooth'
    });
  }
};
