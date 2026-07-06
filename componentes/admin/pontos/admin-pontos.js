// admin-pontos.js
import { obterDadosTurismo } from '../../../serviços/api.js';
import { dispararEventoAdmin, ouvirEventoAdmin } from '../adminEvents.js';
import { MapEvents, dispararEvento } from '../../mapa/mapa-eventos.js';

export class ComponentePontosAdmin {
    constructor(elementoAlvo) {
        this.container = elementoAlvo;
        this.pontoSelecionado = null;
        this.pontoOriginal = null; // 🔥 NOVO: Guarda o estado original
        this.todasCategorias = [];
        this.posicaoAtualForm = null;
        this.init();
    }

    async init() {
        try {
            await import('./admin-pontos.css');
        } catch (e) {
            console.warn('CSS não encontrado');
        }

        if (!this.container) {
            console.error('[AdminPontos] Container não encontrado!');
            return;
        }

        if (!this.container.querySelector('#ponto-dinamico-content')) {
            this.container.innerHTML = `
                <div class="admin-pontos-header">
                    <h3>📍 Gestão de Pontos Turísticos</h3>
                    <button id="btn-novo-ponto" class="btn-primary">➕ Novo Ponto no Centro</button>
                </div>
                <div id="ponto-dinamico-content">
                    <div class="ponto-selecionado-vazio">
                        <p>⏳ Carregando pontos turísticos...</p>
                    </div>
                </div>
            `;
        }

        this.conteudoDinamico = this.container.querySelector('#ponto-dinamico-content');
        if (!this.conteudoDinamico) {
            console.error('[AdminPontos] #ponto-dinamico-content não encontrado mesmo após criar!');
            return;
        }

        const btnNovo = this.container.querySelector('#btn-novo-ponto');
        if (btnNovo) {
            btnNovo.addEventListener('click', () => this.criarNovoPontoFlutuante());
        }

        try {
            const dados = await obterDadosTurismo();
            this.todasCategorias = dados.categorias || this.extrairCategoriasGlobais(dados);

            if (dados.locais && dados.locais.length > 0) {
                const ponto = this.enriquecerPontoComCategorias(dados.locais[0]);
                this.carregarPontoParaEdicao(ponto);
            } else {
                console.warn('[AdminPontos] Nenhum ponto encontrado');
                this.mostrarSemPontos();
            }
        } catch (err) {
            console.error('[AdminPontos] Erro ao carregar dados:', err);
            this.mostrarErro(err.message);
        }

        this.configurarListeners();
    }

    enriquecerPontoComCategorias(ponto) {
        const pontoEnriquecido = JSON.parse(JSON.stringify(ponto));

        if (pontoEnriquecido.Local_Categoria) {
            pontoEnriquecido.Local_Categoria = pontoEnriquecido.Local_Categoria.map(lc => {
                if (lc.Categorias) return lc;

                const categoria = this.todasCategorias.find(c => String(c.id) === String(lc.id_categoria));
                return {
                    ...lc,
                    Categorias: categoria || null
                };
            });
        } else {
            pontoEnriquecido.Local_Categoria = [];
        }

        return pontoEnriquecido;
    }

    configurarListeners() {
        window.addEventListener(MapEvents.PONTO_SELECIONADO, (e) => {
            if (e.detail.tipo === 'local') {
                const ponto = this.enriquecerPontoComCategorias(e.detail.dados);
                this.carregarPontoParaEdicao(ponto);
            }
        });

        window.addEventListener(MapEvents.ADMIN_PONTO_REPOSICIONADO, (e) => {
            this.atualizarCamposCoordenadas(e.detail.lat, e.detail.lng);
        });

        ouvirEventoAdmin('local', 'preparar', (detalhes) => {
            if (this.pontoSelecionado && String(this.pontoSelecionado.id) === String(detalhes.id)) {
                this.pontoSelecionado = {
                    ...detalhes.dadosAtualizados,
                    _status: 'pendente_atualizar'
                };
                this.renderizarFormulario();
            }
        });

        window.addEventListener(MapEvents.ATUALIZAR_PONTO, (e) => {
            if (e.detail.tipo === 'local' && this.pontoSelecionado?.id === e.detail.id) {
                this.pontoSelecionado = { ...e.detail.dados };
                this.renderizarFormulario();
            }
        });
    }

    carregarPontoParaEdicao(dadosPonto) {
        this.pontoSelecionado = JSON.parse(JSON.stringify(dadosPonto));
        // 🔥 GUARDA O ORIGINAL PARA REVERSÃO
        this.pontoOriginal = JSON.parse(JSON.stringify(dadosPonto));

        const coords = dadosPonto.posicao?.coordinates || dadosPonto.posicao || [38.4445, -9.1015];
        this.posicaoAtualForm = Array.isArray(coords) ?
            { lat: coords[0], lng: coords[1] } :
            { lat: coords.lat, lng: coords.lng };

        this.renderizarFormulario();

        dispararEvento(MapEvents.ADMIN_INICIAR_EDICAO, {
            id: dadosPonto.id,
            tipo: 'local'
        });

        dispararEvento(MapEvents.PONTO_SELECIONADO, {
            id: dadosPonto.id,
            tipo: 'local',
            dados: dadosPonto
        });
    }

    renderizarFormulario() {
        if (!this.conteudoDinamico) {
            console.error('[AdminPontos] conteudoDinamico não encontrado!');
            return;
        }

        const p = this.pontoSelecionado;
        if (!p) {
            this.mostrarSemPontos();
            return;
        }

        this.container.className = `admin-pontos-wrapper ${p._status || ''}`;

        const lat = this.posicaoAtualForm?.lat || 38.4445;
        const lng = this.posicaoAtualForm?.lng || -9.1015;

        const categoriasHtml = this.todasCategorias.length > 0 ?
            this.todasCategorias.map(cat => {
                const possuiLink = p.Local_Categoria?.some(lc => {
                    const catId = lc.Categorias?.id || lc.id_categoria;
                    return String(catId) === String(cat.id);
                });
                return `
                    <label class="checkbox-item" style="border-left: 4px solid ${cat.cor || '#ccc'}">
                        <input type="checkbox" class="chk-categoria" value="${cat.id}" ${possuiLink ? 'checked' : ''}>
                        <span>${cat.simbolo || '📍'} ${cat.nome}</span>
                    </label>
                `;
            }).join('') :
            '<p style="color: #999; font-size: 13px;">Nenhuma categoria disponível</p>';

        this.conteudoDinamico.innerHTML = `
            <form id="form-admin-ponto" class="form-admin-ponto">
                <div class="form-group">
                    <label>Nome do Local:</label>
                    <input type="text" id="ponto-nome" value="${p.nome || ''}" required>
                </div>

                <div class="form-group">
                    <label>Descrição:</label>
                    <textarea id="ponto-descricao" rows="3">${p.descricao || ''}</textarea>
                </div>

                <div class="form-group-row">
                    <div class="form-group">
                        <label>Latitude:</label>
                        <input type="text" id="ponto-lat" value="${Number(lat).toFixed(6)}" readonly>
                    </div>
                    <div class="form-group">
                        <label>Longitude:</label>
                        <input type="text" id="ponto-lng" value="${Number(lng).toFixed(6)}" readonly>
                    </div>
                </div>

                <div class="form-group">
                    <label>Categorias Vinculadas:</label>
                    <div class="checkbox-categorias-grid">
                        ${categoriasHtml}
                    </div>
                </div>

                <div class="form-acoes">
                    <button type="button" id="btn-cancelar-ponto" class="btn-secondary">Cancelar</button>
                    <button type="submit" class="btn-success">💾 Salvar</button>
                </div>
            </form>
        `;

        const btnCancelar = this.conteudoDinamico.querySelector('#btn-cancelar-ponto');
        const form = this.conteudoDinamico.querySelector('#form-admin-ponto');

        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => this.cancelarEdicao());
        }
        if (form) {
            form.addEventListener('submit', (e) => this.submeterFormulario(e));
        }
    }

    criarNovoPontoFlutuante() {
        const idTemp = 'temp-local-' + Date.now();
        const novoLocal = {
            id: idTemp,
            nome: 'Novo Ponto Turístico',
            descricao: '',
            posicao: [38.4445, -9.1015],
            Local_Categoria: []
        };

        if (window.InstanciaMapaGlobal?.pontosManager) {
            window.InstanciaMapaGlobal.pontosManager.adicionarPontos([novoLocal], 'local');
        }

        this.carregarPontoParaEdicao(novoLocal);
    }

    atualizarCamposCoordenadas(lat, lng) {
        this.posicaoAtualForm = { lat, lng };
        const inputLat = this.container.querySelector('#ponto-lat');
        const inputLng = this.container.querySelector('#ponto-lng');
        if (inputLat && inputLng) {
            inputLat.value = Number(lat).toFixed(6);
            inputLng.value = Number(lng).toFixed(6);
        }
    }

    // 🔥 CANCELAR AGORA RESTAURA O ORIGINAL COMPLETO
    cancelarEdicao() {
        if (this.pontoOriginal) {
            // Restaura o ponto original
            this.pontoSelecionado = JSON.parse(JSON.stringify(this.pontoOriginal));
            this.posicaoAtualForm = Array.isArray(this.pontoOriginal.posicao) ?
                { lat: this.pontoOriginal.posicao[0], lng: this.pontoOriginal.posicao[1] } :
                { lat: this.pontoOriginal.posicao.lat, lng: this.pontoOriginal.posicao.lng };

            // Se havia um status pendente, dispara reverter
            if (this.pontoOriginal._status) {
                dispararEventoAdmin('reverter', 'local', null, { id: this.pontoOriginal.id });
            }

            this.renderizarFormulario();
        } else {
            dispararEvento(MapEvents.ADMIN_CANCELAR_EDICAO, {
                id: this.pontoSelecionado?.id,
                tipo: 'local'
            });
            this.pontoSelecionado = null;
            this.pontoOriginal = null;
            this.mostrarSemPontos();
        }
    }
    
    submeterFormulario(e) {
        e.preventDefault();

        const nome = this.container.querySelector('#ponto-nome')?.value || '';
        const descricao = this.container.querySelector('#ponto-descricao')?.value || '';
        const chks = this.container.querySelectorAll('.chk-categoria:checked');

        const novasCategoriasRel = Array.from(chks).map(input => {
            const catObj = this.todasCategorias.find(c => String(c.id) === String(input.value));
            return catObj ? { id_categoria: catObj.id, Categorias: catObj } : null;
        }).filter(Boolean);

        const dadosAtualizados = {
            ...this.pontoSelecionado,
            nome,
            descricao,
            posicao: [this.posicaoAtualForm.lat, this.posicaoAtualForm.lng],
            Local_Categoria: novasCategoriasRel,
            categoria: novasCategoriasRel[0]?.Categorias || null
        };

        const ehNovo = String(this.pontoSelecionado.id).startsWith('temp-local-');
        const operacao = ehNovo ? 'inserir' : 'atualizar';

        // 🔥 Preparar a alteração
        if (ehNovo) {
            dispararEventoAdmin('preparar', 'local', 'inserir', dadosAtualizados, null);
        } else {
            dispararEventoAdmin('preparar', 'local', 'atualizar', dadosAtualizados, this.pontoOriginal);
        }

        // 🔥 CONFIRMAR a alteração - PASSANDO O ID CORRETAMENTE
        const id = dadosAtualizados.id;
        dispararEventoAdmin('confirmar', 'local', null, { id });

        if (window.InstanciaMapaGlobal?.pontosManager) {
            window.InstanciaMapaGlobal.pontosManager.atualizarPosicaoEValores(
                dadosAtualizados.id,
                'local',
                dadosAtualizados
            );
        }

        // Atualiza o original com os novos dados
        this.pontoOriginal = JSON.parse(JSON.stringify(dadosAtualizados));
        this.pontoSelecionado = dadosAtualizados;
    }

    mostrarSemPontos() {
        if (!this.conteudoDinamico) return;
        this.container.className = "admin-pontos-wrapper";
        this.pontoOriginal = null;
        this.conteudoDinamico.innerHTML = `
            <div class="ponto-selecionado-vazio">
                <p>💡 Clique em um marcador existente no mapa para modificar as suas informações ou criar relações.</p>
                <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    Ou use o botão "Novo Ponto" acima para criar um novo.
                </p>
            </div>
        `;
    }

    mostrarErro(mensagem) {
        if (!this.conteudoDinamico) return;
        this.conteudoDinamico.innerHTML = `
            <div class="ponto-selecionado-vazio" style="border-color: #ef4444; background: #fef2f2;">
                <p>❌ Erro ao carregar dados: ${mensagem}</p>
                <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    Tente recarregar a página.
                </p>
            </div>
        `;
    }

    extrairCategoriasGlobais(dados) {
        const mapaCats = new Map();
        (dados.locais || []).forEach(l => {
            if (l.categoria?.id) mapaCats.set(l.categoria.id, l.categoria);
            l.Local_Categoria?.forEach(lc => {
                if (lc.Categorias?.id) mapaCats.set(lc.Categorias.id, lc.Categorias);
            });
        });
        return Array.from(mapaCats.values());
    }
}