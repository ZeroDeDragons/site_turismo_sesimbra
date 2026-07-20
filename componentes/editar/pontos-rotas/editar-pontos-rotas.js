import dataManager from '../../../serviços/GerenciadorDados.js';
import { MapEvents, dispararEvento } from '../../mapa/mapa-eventos.js';
import './pontos-rotas.css';

// --- ESTADO INTERNO DO MÓDULO ---
let modoAtivo = 'ponto'; // 'ponto' ou 'rota'
let entidadeSelecionada = null; // null = Criando novo | Object = Editando existente
let pontosDaNovaRota = []; // Array de objetos {id, nome, ...} que formam a rota

// --- ELEMENTOS DO DOM (Referências do Painel) ---
let painelPrincipal; // Elemento da <section class="admin-panel">
let containerAlvo;   // Elemento interno #container-editar-pontos-rotas
let btnPonto, btnRota, btnDeletar, btnCancelar, btnConfirmar, contentArea;

/**
 * FUNÇÃO DE INICIALIZAÇÃO CENTRAL
 */
export function inicializarEditor(elementoAlvo) {
    if (!elementoAlvo) {
        console.error("Não foi possível inicializar o editor: o elemento alvo é nulo ou inválido.");
        return;
    }

    // O elemento alvo agora é a própria secção (#gestao-pontos)
    painelPrincipal = elementoAlvo;

    // Encontra o container interno onde o formulário HTML deve ser renderizado
    containerAlvo = painelPrincipal.querySelector('#container-editar-pontos-rotas');
    if (!containerAlvo) {
        console.error("Não foi encontrado o #container-editar-pontos-rotas dentro do painel admin.");
        return;
    }

    // 1. Injeta apenas a estrutura do formulário e ações inferiores no corpo (preservando o header do HTML)
    containerAlvo.innerHTML = `
        <div id=\"editor-dinamico-content\"></div>

        <div class=\"form-acoes\" id=\"editor-acoes-inferiores\" style=\"margin-top: 15px; display: flex; gap: 10px; align-items: center;\">
            <button id=\"btn-deletar\" class=\"btn-danger\" style=\"display: none; background-color: #d32f2f; color: white;\">🗑️ Eliminar</button>
            <div style=\"display: flex; gap: 10px; margin-left: auto;\">
                <button id=\"btn-cancelar\" class=\"btn-secondary\">❌ Cancelar</button>
                <button id=\"btn-confirmar\" class=\"btn-success\">💾 Confirmar</button>
            </div>
        </div>
    `;

    // 2. Mapeia os botões superiores localizados no cabeçalho da section
    btnPonto = painelPrincipal.querySelector('#btn-modo-ponto');
    btnRota = painelPrincipal.querySelector('#btn-modo-rota');

    // 3. Mapeia as ações inferiores e área de conteúdo a partir do container interno
    btnDeletar = containerAlvo.querySelector('#btn-deletar');
    btnCancelar = containerAlvo.querySelector('#btn-cancelar');
    btnConfirmar = containerAlvo.querySelector('#btn-confirmar');
    contentArea = containerAlvo.querySelector('#editor-dinamico-content');

    // 4. Ativa os ouvintes de eventos e renderiza o estado inicial
    configurarOuvintesDeEventos();
    renderizarFormulario();
}

// --- CONFIGURAÇÃO DE EVENTOS ---
function configurarOuvintesDeEventos() {
    if (btnPonto) btnPonto.addEventListener('click', () => mudarModo('ponto'));
    if (btnRota) btnRota.addEventListener('click', () => mudarModo('rota'));

    btnCancelar.addEventListener('click', cancelarOuLimpar);
    btnConfirmar.addEventListener('click', confirmarSalvar);
    btnDeletar.addEventListener('click', deletarEntidade);

    window.addEventListener(MapEvents.PONTO_SELECIONADO, async (e) => {
        const idLocal = Number(e.detail.id);
        const local = await dataManager.getLocal(idLocal);
        if (!local) return;

        if (modoAtivo === 'ponto') {
            entidadeSelecionada = local;
            renderizarFormulario();
        } else if (modoAtivo === 'rota') {
            alternarPontoEmNovaRota(local);
        }
    });

    window.addEventListener(MapEvents.ROTA_SELECIONADA, async (e) => {
        const idRota = Number(e.detail.id);
        carregarRotaParaEdicao(idRota);
    });
}

// Função auxiliar para carregar e mudar o formulário para edição de rota
async function carregarRotaParaEdicao(idRota) {
    const rota = await dataManager.getRota(idRota);
    if (rota) {
        mudarModo('rota');
        entidadeSelecionada = rota;
        
        try {
            const statusSegmentos = await dataManager.getSegmentosPorRota(idRota);
            statusSegmentos.sort((a, b) => a.ordem - b.ordem);
            
            pontosDaNovaRota = [];
            for (const seg of statusSegmentos) {
                const loc = await dataManager.getLocal(seg.id_local2 || seg.id_local1);
                if (loc) pontosDaNovaRota.push(loc);
            }
        } catch (err) {
            console.error("Erro ao carregar a sequência de pontos da rota:", err);
        }
        renderizarFormulario();
    }
}

// --- FLUXOS DE CONTROLO DE ESTADO ---
function mudarModo(modo) {
    modoAtivo = modo;
    entidadeSelecionada = null;
    pontosDaNovaRota = [];

    if (btnPonto && btnRota) {
        if (modo === 'ponto') {
            btnPonto.className = 'btn-primary';
            btnRota.className = 'btn-secondary';
        } else {
            btnPonto.className = 'btn-secondary';
            btnRota.className = 'btn-primary';
        }
    }

    renderizarFormulario();
}

async function renderizarFormulario() {
    if (!contentArea) return;
    contentArea.innerHTML = '';

    if (entidadeSelecionada && entidadeSelecionada.id) {
        btnDeletar.style.display = 'inline-flex';
    } else {
        btnDeletar.style.display = 'none';
    }

    if (modoAtivo === 'ponto') {
        await renderizarFormPonto();
    } else {
        await renderizarFormRota();
    }
}

// --- FORMULÁRIO DO PONTO (CRIAÇÃO / EDIÇÃO) ---
async function renderizarFormPonto() {
    const dados = entidadeSelecionada || { nome: '', descricao: '', posicao: 'POINT(-8.6291 41.1579)' };

    let lng = -8.6291;
    let lat = 41.1579;

    if (dados.posicao) {
        if (typeof dados.posicao === 'string' && dados.posicao.includes('POINT')) {
            const coords = dados.posicao.replace('POINT(', '').replace(')', '').split(' ');
            lng = parseFloat(coords[0]) || lng;
            lat = parseFloat(coords[1]) || lat;
        } else if (typeof dados.posicao === 'object') {
            if (Array.isArray(dados.posicao.coordinates)) {
                lng = parseFloat(dados.posicao.coordinates[0]) || lng;
                lat = parseFloat(dados.posicao.coordinates[1]) || lat;
            } else if (dados.posicao.x !== undefined && dados.posicao.y !== undefined) {
                lng = parseFloat(dados.posicao.x) || lng;
                lat = parseFloat(dados.posicao.y) || lat;
            }
        }
    }

    const categorias = await dataManager.getTodasCategorias();
    
    let categoriasAtivas = [];
    if (entidadeSelecionada && entidadeSelecionada.id) {
        try {
            for (const cat of categorias) {
                const locaisDaCategoria = await dataManager.getLocaisPorCategoria(cat.id) || [];
                if (locaisDaCategoria.some(l => l.id === entidadeSelecionada.id)) {
                    categoriasAtivas.push(cat.id);
                }
            }
        } catch(e) {
            console.warn("Erro ao carregar categorias ativas para este local:", e);
        }
    }

    contentArea.innerHTML = `
        <form id="form-ponto" class="form-admin-ponto" onsubmit="event.preventDefault();">
            <div class="form-group">
                <label>Nome do Ponto Turístico</label>
                <input type="text" id="ponto-nome" value="${dados.nome}" placeholder="Introduza o nome do ponto..." required>
            </div>
            <div class="form-group">
                <label>Descrição</label>
                <textarea id="ponto-descricao" rows="3" placeholder="Escreva a descrição histórica ou curiosidades...">${dados.descricao || ''}</textarea>
            </div>
            <div class="form-group-row" style="display: flex; gap: 10px;">
                <div class="form-group" style="flex: 1;">
                    <label>Latitude</label>
                    <input type="number" step="any" id="ponto-lat" value="${lat}" required>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Longitude</label>
                    <input type="number" step="any" id="ponto-lng" value="${lng}" required>
                </div>
            </div>
            
            <div class="form-group" style="margin-top: 10px;">
                <label>Categorias Relacionadas</label>
                <div class="checkbox-categorias-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 5px;">
                    ${categorias.map(cat => {
                        const marcado = categoriasAtivas.includes(cat.id) ? 'checked' : '';
                        return `
                            <label class="checkbox-item">
                                <input type="checkbox" name="categorias" value="${cat.id}" ${marcado}>
                                <span>${cat.simbolo || '📍'} ${cat.nome}</span>
                            </label>
                        `;
                    }).join('')}
                </div>
            </div>

            ${entidadeSelecionada && entidadeSelecionada.id ? `
                <hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0;">
                <div class="ponto-relacoes-container" style="display: flex; flex-direction: column; gap: 10px;">
                    <button type="button" id="btn-ver-rotas-associadas" class="btn-secondary" style="width: 100%; text-align: left; justify-content: space-between; display: flex; align-items: center;">
                        <span> Ver Rotas Associadas</span>
                        <span id="contador-rotas">▾</span>
                    </button>
                    <div id="lista-rotas-associadas" style="display: none; background: #f9f9f9; padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
                        <small style="color: #666;">A carregar rotas...</small>
                    </div>

                    <button type="button" id="btn-ver-fotos-associadas" class="btn-secondary" style="width: 100%; text-align: left; justify-content: space-between; display: flex; align-items: center;">
                        <span> Ver Fotos Associadas</span>
                        <span id="contador-fotos">▾</span>
                    </button>
                    <div id="lista-fotos-associadas" style="display: none; background: #f9f9f9; padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
                        <small style="color: #666;">A carregar fotos...</small>
                    </div>
                </div>
            ` : ''}
        </form>
    `;

    if (entidadeSelecionada && entidadeSelecionada.id) {
        configurarPainelRelacoes(entidadeSelecionada.id);
    }

    const inputLat = containerAlvo.querySelector('#ponto-lat');
    const inputLng = containerAlvo.querySelector('#ponto-lng');
    const inputNome = containerAlvo.querySelector('#ponto-nome');

    const notificarMudancaNoMapa = () => {
        const nLat = parseFloat(inputLat.value);
        const nLng = parseFloat(inputLng.value);
        const nNome = inputNome.value || "Novo Ponto";

        if (!isNaN(nLat) && !isNaN(nLng)) {
            dispararEvento(MapEvents.ATUALIZAR_PONTO, {
                id: entidadeSelecionada?.id || 'temp', 
                tipo: 'local',
                dados: {
                    ...(entidadeSelecionada || {}),
                    nome: nNome,
                    posicao: `POINT(${nLng} ${nLat})`
                }
            });
        }
    };

    inputLat.addEventListener('blur', notificarMudancaNoMapa);
    inputLng.addEventListener('blur', notificarMudancaNoMapa);
    inputNome.addEventListener('blur', notificarMudancaNoMapa);
}

// --- CONFIGURAÇÃO DE ROTAS E FOTOS ASSOCIADAS ---
function configurarPainelRelacoes(idLocal) {
    const btnVerRotas = containerAlvo.querySelector('#btn-ver-rotas-associadas');
    const listaRotas = containerAlvo.querySelector('#lista-rotas-associadas');
    const btnVerFotos = containerAlvo.querySelector('#btn-ver-fotos-associadas');
    const listaFotos = containerAlvo.querySelector('#lista-fotos-associadas');

    btnVerRotas.addEventListener('click', async () => {
        if (listaRotas.style.display === 'none') {
            listaRotas.style.display = 'block';
            listaRotas.innerHTML = `<small style="color: #666;">A carregar rotas...</small>`;
            try {
                const rotas = await dataManager.getRotasPorLocal(idLocal) || [];
                if (rotas.length === 0) {
                    listaRotas.innerHTML = `<p style="font-size: 13px; margin: 0; color: #777;">Nenhuma rota associada a este ponto.</p>`;
                } else {
                    listaRotas.innerHTML = `
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${rotas.map(rota => `
                                <div class="rota-item-link" data-id="${rota.id}" style="padding: 8px; background: #fff; border: 1px solid #eee; border-radius: 4px; cursor: pointer; transition: background 0.2s; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 13px; font-weight: bold; color: #333;">🛣️ ${rota.nome}</span>
                                    <small style="color: #007bff; font-weight: bold;">Editar →</small>
                                </div>
                            `).join('')}
                        </div>
                    `;

                    listaRotas.querySelectorAll('.rota-item-link').forEach(item => {
                        item.addEventListener('click', () => {
                            const idRota = Number(item.getAttribute('data-id'));
                            carregarRotaParaEdicao(idRota);
                        });
                    });
                }
            } catch (err) {
                listaRotas.innerHTML = `<span style="color: #d32f2f; font-size: 12px;">Erro ao carregar rotas.</span>`;
            }
        } else {
            listaRotas.style.display = 'none';
        }
    });

    btnVerFotos.addEventListener('click', async () => {
        if (listaFotos.style.display === 'none') {
            listaFotos.style.display = 'block';
            listaFotos.innerHTML = `<small style="color: #666;">A carregar fotos...</small>`;
            try {
                const { ChamarServidor } = await import('../../../serviços/api.js');
                const fotos = await ChamarServidor(`obterFotosPorLocal?id_local=${idLocal}`, { method: 'GET' }) || [];

                if (fotos.length === 0) {
                    listaFotos.innerHTML = `<p style="font-size: 13px; margin: 0; color: #777;">Nenhuma foto associada a este ponto.</p>`;
                } else {
                    listaFotos.innerHTML = `
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                            ${fotos.map(foto => `
                                <div style="position: relative; aspect-ratio: 1; border-radius: 4px; overflow: hidden; border: 1px solid #ddd; background-color: #eee;">
                                    <img src="${foto.local_origem}" alt="${foto.nome || 'Foto'}" style="width: 100%; height: 100%; object-fit: cover;" title="${foto.descricao || ''}"/>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            } catch (err) {
                listaFotos.innerHTML = `<span style="color: #d32f2f; font-size: 12px;">Erro ao carregar fotos.</span>`;
            }
        } else {
            listaFotos.style.display = 'none';
        }
    });
}

// --- FORMULÁRIO DE ROTA (CRIAÇÃO / EDIÇÃO) ---
async function renderizarFormRota() {
    const dados = entidadeSelecionada || { nome: '', descricao: '' };

    contentArea.innerHTML = `
        <form id="form-rota" class="form-admin-ponto" onsubmit="event.preventDefault();">
            <div class="form-group">
                <label>Nome da Rota</label>
                <input type="text" id="rota-nome" value="${dados.nome || ''}" placeholder="Introduza o nome da rota..." required>
            </div>
            <div class="form-group">
                <label>Descrição da Rota</label>
                <textarea id="rota-descricao" rows="2" placeholder="Escreva sobre o trajeto ou temática da rota...">${dados.descricao || ''}</textarea>
            </div>
            <div class="form-group" style="margin-top: 10px;">
                <label>Sequência de Pontos da Rota</label>
                <small style="color: var(--tinta-suave); margin-bottom: 5px; display: block;">
                    💡 Pressione os pontos no mapa para os adicionar/remover ou organize-os na lista:
                </small>
                <div id="lista-pontos-rota" class="checkbox-categorias-grid" style="max-height: 180px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; padding: 5px; border: 1px dashed var(--pedra-escura);">
                </div>
            </div>
        </form>
    `;

    renderizarListaPontosRota();
}

function renderizarListaPontosRota() {
    const containerLista = containerAlvo.querySelector('#lista-pontos-rota');
    if (!containerLista) return;

    if (pontosDaNovaRota.length === 0) {
        containerLista.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--tinta-suave); font-size: 13px;">Nenhum ponto selecionado. Pressione pontos no mapa.</div>`;
        return;
    }

    containerLista.innerHTML = pontosDaNovaRota.map((ponto, index) => `
        <div class="checkbox-item" style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 6px 12px;">
            <span><strong>${index + 1}.</strong> ${ponto.nome}</span>
            <button type="button" class="btn-remover-ponto" data-index="${index}" style="background: none; border: none; color: #d32f2f; cursor: pointer; font-size: 14px; font-weight: bold;">✕</button>
        </div>
    `).join('');

    containerLista.querySelectorAll('.btn-remover-ponto').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            pontosDaNovaRota.splice(index, 1);
            renderizarListaPontosRota();
        });
    });
}

function alternarPontoEmNovaRota(local) {
    const index = pontosDaNovaRota.findIndex(p => p.id === local.id);
    if (index > -1) {
        pontosDaNovaRota.splice(index, 1);
    } else {
        pontosDaNovaRota.push(local);
    }
    renderizarListaPontosRota();
}

// --- PERSISTÊNCIA E OPERAÇÕES DA BD (CONFIRMAR, CANCELAR, DELETAR) ---
async function confirmarSalvar() {
    try {
        if (modoAtivo === 'ponto') {
            const nome = containerAlvo.querySelector('#ponto-nome').value;
            const descricao = containerAlvo.querySelector('#ponto-descricao').value;
            const lat = parseFloat(containerAlvo.querySelector('#ponto-lat').value);
            const lng = parseFloat(containerAlvo.querySelector('#ponto-lng').value);

            if (!nome || isNaN(lat) || isNaN(lng)) {
                alert("Por favor, preencha todos os campos obrigatórios (Nome, Lat, Lng).");
                return;
            }

            const localDados = {
                ...(entidadeSelecionada || {}),
                nome,
                descricao,
                posicao: `POINT(${lng} ${lat})`,
                is_public: true
            };

            const localSalvo = await dataManager.salvarDado('locais', 'Local', localDados);

            const checkboxes = containerAlvo.querySelectorAll('input[name="categorias"]:checked');
            const idsCategorias = Array.from(checkboxes).map(cb => Number(cb.value));

            await dataManager.salvarRelacionamento({
                mapaEntidade: 'categoriaLocais',
                tabelaPivo: 'Local_Categoria',
                campoPai: 'id_local',
                idPai: localSalvo.id,
                campoFilho: 'id_categoria',
                idsFilhos: idsCategorias
            });

            dispararEvento(MapEvents.ATUALIZAR_PONTO, { id: localSalvo.id, tipo: 'local', dados: localSalvo });
            alert("Ponto turístico guardado com sucesso!");

        } else {
            const nome = containerAlvo.querySelector('#rota-nome').value;
            const descricao = containerAlvo.querySelector('#rota-descricao').value;

            if (!nome) {
                alert("Por favor, introduza o nome da rota!");
                return;
            }
            if (pontosDaNovaRota.length < 2) {
                alert("A rota precisa de conter pelo menos 2 pontos turísticos!");
                return;
            }

            const rotaDados = {
                ...(entidadeSelecionada || {}),
                nome,
                descricao,
                is_public: true
            };

            const rotaSalva = await dataManager.salvarDado('rotas', 'Rotas', rotaDados);

            const segmentos = pontosDaNovaRota.map((ponto, index) => ({
                id_local1: ponto.id,
                id_local2: pontosDaNovaRota[index + 1]?.id || null,
                ordem: index
            })).filter(seg => seg.id_local2 !== null);

            await dataManager.salvarRelacionamento({
                mapaEntidade: 'segmentosPorRota',
                tabelaPivo: 'Segmento',
                campoPai: 'id_rota',
                idPai: rotaSalva.id,
                campoFilho: 'id_local1',
                idsFilhos: segmentos
            });

            alert("Rota guardada com sucesso!");
        }

        cancelarOuLimpar();
    } catch (erro) {
        console.error("Erro ao salvar informações:", erro);
        alert("Ocorreu um problema ao tentar guardar os dados.");
    }
}

function cancelarOuLimpar() {
    entidadeSelecionada = null;
    pontosDaNovaRota = [];
    renderizarFormulario();
}

async function deletarEntidade() {
    if (!entidadeSelecionada || !entidadeSelecionada.id) return;

    const confirmacao = confirm("Tens a certeza que queres eliminar permanentemente este registo?");
    if (!confirmacao) return;

    try {
        if (modoAtivo === 'ponto') {
            await dataManager.deletarDado('locais', 'Local', entidadeSelecionada.id);
            dispararEvento(MapEvents.ADMIN_CANCELAR_EDICAO, { id: entidadeSelecionada.id, tipo: 'local' });
        } else {
            await dataManager.deletarDado('rotas', 'Rotas', entidadeSelecionada.id);
        }

        alert("Registo eliminado permanentemente do sistema.");
        cancelarOuLimpar();
    } catch (erro) {
        console.error("Erro ao tentar eliminar:", erro);
        alert("Erro de comunicação ao tentar apagar o registo.");
    }
}