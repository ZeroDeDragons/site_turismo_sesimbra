// src/admin/rotas/admin-rotas.js
import { obterDadosTurismo } from '../../../serviços/api.js';
import { dispararEventoAdmin, ouvirEventoAdmin } from '../adminEvents.js';
import { MapEvents, dispararEvento } from '../../mapa/mapa-eventos.js';

export class ComponenteRotasAdmin {
    constructor(elementoAlvo) {
        this.container = elementoAlvo;
        this.pontoSelecionado = null;
        this.rotasDisponiveis = [];
        this.rotaSelecionada = null;
        this.rotaOriginal = null; // 🔥 NOVO: Guarda o estado original
        this.segmentos = [];
        this.segmentosOriginais = []; // 🔥 NOVO: Guarda os segmentos originais
        this.todasCategorias = [];
        this.modoCriacao = false;
        this.init();
    }

    async init() {
        try {
            await import('./admin-rotas.css');
        } catch (e) {
            console.warn('CSS admin-rotas não encontrado');
        }

        if (!this.container) {
            console.error('[AdminRotas] Container não encontrado');
            return;
        }

        if (!this.container.querySelector('#rotas-dinamico-content')) {
            this.container.innerHTML = `
                <div class="admin-rotas-header">
                    <h3>🗺️ Gestão de Rotas do Ponto</h3>
                    <span class="badge-ponto-nome" id="rotas-ponto-nome">Nenhum ponto selecionado</span>
                </div>
                <div id="rotas-dinamico-content">
                    <div class="rotas-selecionado-vazio">
                        <p>⏳ Carregando dados...</p>
                    </div>
                </div>
            `;
        }

        this.conteudoDinamico = this.container.querySelector('#rotas-dinamico-content');
        if (!this.conteudoDinamico) {
            console.error('[AdminRotas] #rotas-dinamico-content não encontrado');
            return;
        }

        try {
            const dados = await obterDadosTurismo();
            this.rotasDisponiveis = dados.rotas || [];
            this.todasCategorias = dados.categorias || [];

            if (this.pontoSelecionado) {
                this.atualizarRotasDoPonto();
            } else {
                this.mostrarSemPonto();
            }
        } catch (err) {
            console.error('[AdminRotas] Erro ao carregar dados:', err);
            this.mostrarErro(err.message);
        }

        this.configurarListeners();
    }

    configurarListeners() {
        window.addEventListener(MapEvents.PONTO_SELECIONADO, (e) => {
            if (e.detail.tipo === 'local') {
                this.pontoSelecionado = e.detail.dados;
                this.modoCriacao = false;
                this.atualizarRotasDoPonto();
            }
        });

        window.addEventListener(MapEvents.ROTA_SELECIONADA, (e) => {
            if (e.detail.rota) {
                this.modoCriacao = false;
                this.selecionarRota(e.detail.rota.id);
            }
        });

        ouvirEventoAdmin('rota', 'preparar', (detalhes) => {
            if (this.rotaSelecionada && String(this.rotaSelecionada.id) === String(detalhes.id)) {
                this.rotaSelecionada = { ...detalhes.dadosAtualizados, _status: 'pendente_atualizar' };
                this.renderizarRotas();
            }
        });
    }

    atualizarRotasDoPonto() {

        if (!this.pontoSelecionado) {
            this.mostrarSemPonto();
            return;
        }

        const nomePonto = this.container.querySelector('#rotas-ponto-nome');
        if (nomePonto) {
            nomePonto.textContent = `📍 ${this.pontoSelecionado.nome || 'Ponto sem nome'}`;
        }

        const rotasDoPonto = this.rotasDisponiveis.filter(rota => {
            if (!rota.trajeto || !Array.isArray(rota.trajeto)) return false;

            return rota.trajeto.some(segmento => {
                const id1 = segmento.ponto_A?.id || segmento.id_local1;
                const id2 = segmento.ponto_B?.id || segmento.id_local2;
                return String(id1) === String(this.pontoSelecionado.id) ||
                    String(id2) === String(this.pontoSelecionado.id);
            });
        });

        if (rotasDoPonto.length === 0) {
            this.mostrarSemRotas();
            return;
        }

        if (!this.rotaSelecionada || !rotasDoPonto.some(r => String(r.id) === String(this.rotaSelecionada.id))) {
            this.selecionarRota(rotasDoPonto[0].id);
        }

        this.renderizarRotas(rotasDoPonto);
    }

    selecionarRota(rotaId) {
        const rota = this.rotasDisponiveis.find(r => String(r.id) === String(rotaId));
        if (!rota) {
            console.warn('[AdminRotas] Rota não encontrada:', rotaId);
            return;
        }

        this.rotaSelecionada = rota;
        // 🔥 GUARDA O ORIGINAL PARA REVERSÃO
        this.rotaOriginal = JSON.parse(JSON.stringify(rota));
        this.segmentos = rota.trajeto ? JSON.parse(JSON.stringify(rota.trajeto)) : [];
        this.segmentosOriginais = rota.trajeto ? JSON.parse(JSON.stringify(rota.trajeto)) : [];
        this.modoCriacao = false;
        this.renderizarRotas();
    }

    renderizarFormularioNovaRota() {
        if (!this.conteudoDinamico) return;

        this.modoCriacao = true;

        this.conteudoDinamico.innerHTML = `
            <div class="rotas-admin-container">
                <div class="rotas-selector">
                    <button id="btn-voltar-rotas" class="btn-secondary btn-pequeno">← Voltar</button>
                    <span style="font-weight: 600; color: #1e293b;">Criando nova rota para: ${this.pontoSelecionado?.nome}</span>
                </div>

                <div class="rota-detalhes">
                    <form id="form-nova-rota" class="form-nova-rota">
                        <div class="form-group">
                            <label for="nova-rota-nome">Nome da Rota *</label>
                            <input type="text" id="nova-rota-nome" placeholder="Ex: Rota Histórica de Lisboa" required>
                        </div>

                        <div class="form-group">
                            <label for="nova-rota-descricao">Descrição</label>
                            <textarea id="nova-rota-descricao" rows="3" placeholder="Descreva o que esta rota oferece..."></textarea>
                        </div>

                        <div class="form-group">
                            <label for="nova-rota-cor">Cor da Rota</label>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <input type="color" id="nova-rota-cor" value="#8b5cf6">
                                <span style="font-size: 13px; color: #64748b;">Clique para escolher uma cor</span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Categorias</label>
                            <div class="checkbox-categorias-grid" style="max-height: 100px;">
                                ${this.todasCategorias.map(cat => `
                                    <label class="checkbox-item" style="border-left: 4px solid ${cat.cor || '#ccc'}">
                                        <input type="checkbox" class="chk-categoria-rota" value="${cat.id}">
                                        <span>${cat.simbolo || '📍'} ${cat.nome}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Segmentos da Rota</label>
                            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px dashed #cbd5e1;">
                                <p style="color: #64748b; font-size: 13px; margin: 0;">
                                    💡 Os segmentos serão adicionados depois que a rota for criada.
                                    <br>Clique em "Salvar" para criar a rota e depois adicione os segmentos.
                                </p>
                            </div>
                        </div>

                        <div class="rotas-acoes">
                            <button type="button" id="btn-cancelar-nova-rota" class="btn-secondary">Cancelar</button>
                            <button type="submit" id="btn-salvar-nova-rota" class="btn-success">✅ Salvar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const btnVoltar = this.conteudoDinamico.querySelector('#btn-voltar-rotas');
        if (btnVoltar) {
            btnVoltar.addEventListener('click', () => {
                this.modoCriacao = false;
                this.atualizarRotasDoPonto();
            });
        }

        const btnCancelar = this.conteudoDinamico.querySelector('#btn-cancelar-nova-rota');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => {
                this.modoCriacao = false;
                this.atualizarRotasDoPonto();
            });
        }

        const form = this.conteudoDinamico.querySelector('#form-nova-rota');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.salvarNovaRota();
            });
        }
    }

    salvarNovaRota() {
        const nome = this.conteudoDinamico.querySelector('#nova-rota-nome')?.value?.trim();
        const descricao = this.conteudoDinamico.querySelector('#nova-rota-descricao')?.value?.trim() || '';
        const cor = this.conteudoDinamico.querySelector('#nova-rota-cor')?.value || '#8b5cf6';
        const categoriasSelecionadas = this.conteudoDinamico.querySelectorAll('.chk-categoria-rota:checked');

        if (!nome) {
            alert('⚠️ Por favor, insira um nome para a rota.');
            return;
        }

        const existe = this.rotasDisponiveis.some(r => r.nome.toLowerCase() === nome.toLowerCase());
        if (existe) {
            alert('⚠️ Já existe uma rota com este nome. Por favor, escolha outro nome.');
            return;
        }

        const categorias = Array.from(categoriasSelecionadas).map(input => {
            const cat = this.todasCategorias.find(c => String(c.id) === String(input.value));
            return cat || null;
        }).filter(Boolean);

        const novaRota = {
            id: 'temp-rota-' + Date.now(),
            nome: nome,
            descricao: descricao,
            cor: cor,
            trajeto: [],
            categorias: categorias,
            _status: 'pendente_inserir',
            criado_em: new Date().toISOString()
        };

        this.rotasDisponiveis.push(novaRota);

        dispararEventoAdmin('preparar', 'rota', 'inserir', novaRota, null);

        this.modoCriacao = false;
        this.selecionarRota(novaRota.id);
        this.atualizarRotasDoPonto();

        alert(`✅ Rota "${novaRota.nome}" criada com sucesso! Agora você pode adicionar segmentos.`);
    }

    renderizarRotas(rotasDoPonto = null) {

        if (!this.conteudoDinamico) {
            console.error('[AdminRotas] conteudoDinamico não encontrado');
            return;
        }

        if (!this.pontoSelecionado) {
            this.mostrarSemPonto();
            return;
        }

        if (this.modoCriacao) {
            this.renderizarFormularioNovaRota();
            return;
        }

        const rotas = rotasDoPonto || this.rotasDisponiveis.filter(rota => {
            if (!rota.trajeto || !Array.isArray(rota.trajeto)) return false;
            return rota.trajeto.some(segmento => {
                const id1 = segmento.ponto_A?.id || segmento.id_local1;
                const id2 = segmento.ponto_B?.id || segmento.id_local2;
                return String(id1) === String(this.pontoSelecionado.id) ||
                    String(id2) === String(this.pontoSelecionado.id);
            });
        });

        if (!this.rotaSelecionada || !rotas.some(r => String(r.id) === String(this.rotaSelecionada.id))) {
            this.rotaSelecionada = rotas.length > 0 ? rotas[0] : null;
            this.segmentos = this.rotaSelecionada?.trajeto ? JSON.parse(JSON.stringify(this.rotaSelecionada.trajeto)) : [];
            this.segmentosOriginais = this.rotaSelecionada?.trajeto ? JSON.parse(JSON.stringify(this.rotaSelecionada.trajeto)) : [];
        }

        const rotasSelectHtml = rotas.map(rota => `
            <option value="${rota.id}" ${String(this.rotaSelecionada?.id) === String(rota.id) ? 'selected' : ''}>
                ${rota.nome} ${rota.trajeto?.length ? `(${rota.trajeto.length} segmentos)` : ''}
            </option>
        `).join('');

        const segmentosHtml = this.segmentos && this.segmentos.length > 0 ?
            this.segmentos.map((segmento, index) => {
                const pontoA = segmento.ponto_A || segmento.local1 || { nome: 'Ponto A' };
                const pontoB = segmento.ponto_B || segmento.local2 || { nome: 'Ponto B' };
                const isPontoSelecionado = (id) => String(id) === String(this.pontoSelecionado.id);

                return `
                    <div class="segmento-item" data-segmento-index="${index}">
                        <div class="segmento-ordem">
                            <span class="ordem-numero">${index + 1}</span>
                            <div class="ordem-botoes">
                                <button class="btn-mover-segmento" data-direction="up" ${index === 0 ? 'disabled' : ''}>↑</button>
                                <button class="btn-mover-segmento" data-direction="down" ${index === this.segmentos.length - 1 ? 'disabled' : ''}>↓</button>
                            </div>
                        </div>
                        <div class="segmento-info">
                            <div class="segmento-pontos">
                                <span class="ponto-nome ${isPontoSelecionado(pontoA.id) ? 'ponto-destacado' : ''}">
                                    ${isPontoSelecionado(pontoA.id) ? '📍 ' : ''}${pontoA.nome || 'Ponto A'}
                                </span>
                                <span class="segmento-seta">➔</span>
                                <span class="ponto-nome ${isPontoSelecionado(pontoB.id) ? 'ponto-destacado' : ''}">
                                    ${isPontoSelecionado(pontoB.id) ? '📍 ' : ''}${pontoB.nome || 'Ponto B'}
                                </span>
                            </div>
                            <div class="segmento-acoes">
                                <button class="btn-remover-segmento" data-segmento-index="${index}">🗑️</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('') :
            '<p class="sem-segmentos">Esta rota não tem segmentos definidos.</p>';

        const btnApagarRotaHtml = this.rotaSelecionada ? `
            <button id="btn-apagar-rota" class="btn-danger btn-pequeno">🗑️ Apagar Rota</button>
        ` : '';

        this.conteudoDinamico.innerHTML = `
            <div class="rotas-admin-container">
                <div class="rotas-selector">
                    <label for="select-rota">Selecionar Rota:</label>
                    <select id="select-rota" class="select-rota">
                        ${rotasSelectHtml}
                    </select>
                    <button id="btn-nova-rota" class="btn-primary btn-pequeno">➕ Nova Rota</button>
                    ${btnApagarRotaHtml}
                </div>

                <div class="rota-detalhes">
                    <div class="rota-info">
                        <h4>${this.rotaSelecionada?.nome || 'Nenhuma rota selecionada'}</h4>
                        <p class="rota-descricao">${this.rotaSelecionada?.descricao || 'Sem descrição'}</p>
                        <span class="segmentos-count">${this.segmentos?.length || 0} segmento(s)</span>
                    </div>

                    <div class="segmentos-header">
                        <span>Ordem dos Segmentos</span>
                        <span class="segmentos-actions">
                            <button id="btn-adicionar-segmento" class="btn-primary btn-pequeno">➕ Adicionar</button>
                        </span>
                    </div>
                    <div class="segmentos-container">
                        ${segmentosHtml}
                    </div>

                    <div class="rotas-acoes">
                        <button id="btn-cancelar-rotas" class="btn-secondary">Cancelar</button>
                        <button id="btn-salvar-rotas" class="btn-success">💾 Salvar</button>
                    </div>
                </div>
            </div>
        `;

        this.configurarOuvintesFormulario();
    }

    configurarOuvintesFormulario() {
        const selectRota = this.conteudoDinamico.querySelector('#select-rota');
        if (selectRota) {
            selectRota.addEventListener('change', (e) => {
                this.modoCriacao = false;
                this.selecionarRota(e.target.value);
            });
        }

        this.conteudoDinamico.querySelectorAll('.btn-mover-segmento').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const direction = btn.dataset.direction;
                const segmentoItem = btn.closest('.segmento-item');
                const index = parseInt(segmentoItem.dataset.segmentoIndex);
                this.moverSegmento(index, direction);
            });
        });

        this.conteudoDinamico.querySelectorAll('.btn-remover-segmento').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(btn.dataset.segmentoIndex);
                this.removerSegmento(index);
            });
        });

        const btnAdicionar = this.conteudoDinamico.querySelector('#btn-adicionar-segmento');
        if (btnAdicionar) {
            btnAdicionar.addEventListener('click', () => this.adicionarSegmento());
        }

        const btnCancelar = this.conteudoDinamico.querySelector('#btn-cancelar-rotas');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => this.cancelarEdicao());
        }

        const btnSalvar = this.conteudoDinamico.querySelector('#btn-salvar-rotas');
        if (btnSalvar) {
            btnSalvar.addEventListener('click', () => this.salvarAlteracoes());
        }

        const btnNovaRota = this.conteudoDinamico.querySelector('#btn-nova-rota');
        if (btnNovaRota) {
            btnNovaRota.addEventListener('click', () => {
                this.modoCriacao = true;
                this.renderizarFormularioNovaRota();
            });
        }

        const btnApagarRota = this.conteudoDinamico.querySelector('#btn-apagar-rota');
        if (btnApagarRota) {
            btnApagarRota.addEventListener('click', () => this.apagarRota());
        }
    }

    apagarRota() {
        if (!this.rotaSelecionada) {
            alert('⚠️ Selecione uma rota para apagar!');
            return;
        }

        const isTemp = String(this.rotaSelecionada.id).startsWith('temp-rota-');
        const mensagemConfirmacao = isTemp
            ? `Tem certeza que deseja apagar a rota "${this.rotaSelecionada.nome}"? Esta rota ainda não foi salva no banco.`
            : `⚠️ ATENÇÃO: Tem certeza que deseja apagar a rota "${this.rotaSelecionada.nome}"? Esta ação irá remover a rota do banco de dados.`;

        if (!confirm(mensagemConfirmacao)) {
            return;
        }

        const index = this.rotasDisponiveis.findIndex(r => String(r.id) === String(this.rotaSelecionada.id));
        if (index !== -1) {
            this.rotasDisponiveis.splice(index, 1);
        }

        dispararEventoAdmin('preparar', 'rota', 'deletar', null, this.rotaSelecionada);

        this.rotaSelecionada = null;
        this.rotaOriginal = null;
        this.segmentos = [];
        this.segmentosOriginais = [];

        if (window.InstanciaMapaGlobal?.rotasManager) {
            window.InstanciaMapaGlobal.rotasManager.limparMapasDeRotas();
            window.InstanciaMapaGlobal.rotasManager.renderizarTodasAsRotas();
        }

        this.atualizarRotasDoPonto();
        alert(`✅ Rota removida com sucesso!`);
    }

    moverSegmento(index, direction) {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= this.segmentos.length) return;

        const [segmento] = this.segmentos.splice(index, 1);
        this.segmentos.splice(newIndex, 0, segmento);
        this.segmentos.forEach((seg, i) => seg.ordem = i + 1);

        this.renderizarRotas();
    }

    removerSegmento(index) {
        const segmento = this.segmentos[index];
        if (!segmento) return;

        const nomeA = segmento.ponto_A?.nome || 'Ponto A';
        const nomeB = segmento.ponto_B?.nome || 'Ponto B';

        if (!confirm(`Remover o segmento "${nomeA} ➔ ${nomeB}"?`)) {
            return;
        }

        this.segmentos.splice(index, 1);
        this.segmentos.forEach((seg, i) => seg.ordem = i + 1);
        this.renderizarRotas();
    }

    adicionarSegmento() {
        if (!this.pontoSelecionado) {
            alert('⚠️ Selecione um ponto primeiro!');
            return;
        }

        if (!this.rotaSelecionada) {
            alert('⚠️ Selecione uma rota primeiro!');
            return;
        }

        const nomePontoA = prompt('Nome do Ponto A (origem):');
        if (!nomePontoA) return;

        const nomePontoB = prompt('Nome do Ponto B (destino):');
        if (!nomePontoB) return;

        const novoSegmento = {
            id: 'temp-seg-' + Date.now(),
            ponto_A: {
                id: 'temp-' + Date.now(),
                nome: nomePontoA,
                coordinates: [0, 0]
            },
            ponto_B: {
                id: 'temp-' + Date.now() + 1,
                nome: nomePontoB,
                coordinates: [0, 0]
            },
            ordem: this.segmentos.length + 1
        };

        this.segmentos.push(novoSegmento);
        this.renderizarRotas();

        alert(`✅ Segmento "${nomePontoA} ➔ ${nomePontoB}" adicionado!`);
    }

    // 🔥 CANCELAR AGORA RESTAURA O ORIGINAL COMPLETO
    cancelarEdicao() {
        if (this.rotaOriginal) {
            // Restaura a rota original
            this.rotaSelecionada = JSON.parse(JSON.stringify(this.rotaOriginal));
            this.segmentos = JSON.parse(JSON.stringify(this.rotaOriginal.trajeto || []));
            this.segmentosOriginais = JSON.parse(JSON.stringify(this.rotaOriginal.trajeto || []));

            // Se havia status pendente, dispara reverter
            if (this.rotaOriginal._status) {
                dispararEventoAdmin('reverter', 'rota', null, { id: this.rotaOriginal.id });
            }

            this.renderizarRotas();
        } else {
            this.rotaSelecionada = null;
            this.rotaOriginal = null;
            this.segmentos = [];
            this.segmentosOriginais = [];
            this.atualizarRotasDoPonto();
        }
    }
    
    async salvarAlteracoes() {
        if (!this.rotaSelecionada) {
            alert('⚠️ Selecione uma rota para salvar!');
            return;
        }

        // Verifica se houve mudanças
        const segmentosAtuais = JSON.stringify(this.segmentos);
        const segmentosOriginal = JSON.stringify(this.segmentosOriginais);

        if (segmentosAtuais === segmentosOriginal && !this.rotaSelecionada._status) {
            alert('ℹ️ Nenhuma alteração foi feita para salvar.');
            return;
        }

        if (this.segmentos.length === 0) {
            if (!confirm('⚠️ Esta rota não tem segmentos. Deseja salvar mesmo assim?')) {
                return;
            }
        }

        const isTemp = String(this.rotaSelecionada.id).startsWith('temp-rota-');
        const operacao = isTemp ? 'inserir' : 'atualizar';

        const dadosAtualizados = {
            ...this.rotaSelecionada,
            nome: this.rotaSelecionada.nome,
            descricao: this.rotaSelecionada.descricao || '',
            cor: this.rotaSelecionada.cor || '#8b5cf6',
            is_public: true,
            trajeto: this.segmentos,
            _status: isTemp ? 'pendente_inserir' : 'pendente_atualizar',
            id: this.rotaSelecionada.id
        };

        console.log('[AdminRotas] Salvando alterações:', dadosAtualizados);

        // 🔥 PREPARA a alteração (guarda no backup)
        const original = this.rotaOriginal || this.rotaSelecionada;
        dispararEventoAdmin('preparar', 'rota', operacao, dadosAtualizados, original);

        // 🔥 CONFIRMA a alteração - PASSANDO O ID CORRETAMENTE
        const id = dadosAtualizados.id;
        dispararEventoAdmin('confirmar', 'rota', null, { id });

        // Atualiza os originais
        this.rotaOriginal = JSON.parse(JSON.stringify(dadosAtualizados));
        this.segmentosOriginais = JSON.parse(JSON.stringify(this.segmentos));

        // Renderiza novamente para mostrar o status
        this.renderizarRotas();
    }

    mostrarSemPonto() {
        if (!this.conteudoDinamico) return;
        this.modoCriacao = false;
        this.rotaOriginal = null;
        this.conteudoDinamico.innerHTML = `
            <div class="rotas-selecionado-vazio">
                <p>💡 Selecione um ponto no mapa para ver e editar suas rotas associadas.</p>
            </div>
        `;
        const nomePonto = this.container.querySelector('#rotas-ponto-nome');
        if (nomePonto) nomePonto.textContent = 'Nenhum ponto selecionado';
    }

    mostrarSemRotas() {
        if (!this.conteudoDinamico) return;
        this.modoCriacao = false;
        this.rotaOriginal = null;
        this.conteudoDinamico.innerHTML = `
            <div class="rotas-selecionado-vazio" style="border-color: #f59e0b; background: #fffbeb;">
                <p>📌 O ponto <strong>"${this.pontoSelecionado?.nome}"</strong> não está associado a nenhuma rota.</p>
                <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    Crie uma nova rota ou adicione este ponto a uma rota existente.
                </p>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 15px; flex-wrap: wrap;">
                    <button id="btn-criar-rota-para-ponto" class="btn-primary">
                        ➕ Nova Rota com este Ponto
                    </button>
                    <button id="btn-adicionar-rota-existente" class="btn-secondary">
                        📋 Adicionar a Rota Existente
                    </button>
                </div>
            </div>
        `;

        const btnCriar = this.conteudoDinamico.querySelector('#btn-criar-rota-para-ponto');
        if (btnCriar) {
            btnCriar.addEventListener('click', () => {
                this.modoCriacao = true;
                this.renderizarFormularioNovaRota();
            });
        }

        const btnAdicionar = this.conteudoDinamico.querySelector('#btn-adicionar-rota-existente');
        if (btnAdicionar) {
            btnAdicionar.addEventListener('click', () => this.adicionarARotaExistente());
        }
    }

    adicionarARotaExistente() {
        if (!this.pontoSelecionado) {
            alert('⚠️ Selecione um ponto primeiro!');
            return;
        }

        const rotasDisponiveis = this.rotasDisponiveis.filter(rota => {
            if (!rota.trajeto || !Array.isArray(rota.trajeto)) return true;
            return !rota.trajeto.some(segmento => {
                const id1 = segmento.ponto_A?.id || segmento.id_local1;
                const id2 = segmento.ponto_B?.id || segmento.id_local2;
                return String(id1) === String(this.pontoSelecionado.id) ||
                    String(id2) === String(this.pontoSelecionado.id);
            });
        });

        if (rotasDisponiveis.length === 0) {
            alert('ℹ️ Não há rotas disponíveis para adicionar este ponto. Crie uma nova rota!');
            return;
        }

        const opcoes = rotasDisponiveis.map((r, i) =>
            `${i + 1}. ${r.nome}${r.trajeto?.length ? ` (${r.trajeto.length} segmentos)` : ' (vazia)'}`
        ).join('\n');

        const escolha = prompt(
            `Selecione uma rota para adicionar o ponto "${this.pontoSelecionado.nome}":\n\n${opcoes}\n\nDigite o número da rota:`
        );

        if (!escolha) return;

        const index = parseInt(escolha) - 1;
        if (isNaN(index) || index < 0 || index >= rotasDisponiveis.length) {
            alert('❌ Seleção inválida!');
            return;
        }

        const rotaSelecionada = rotasDisponiveis[index];

        const novoSegmento = {
            id: 'temp-seg-' + Date.now(),
            ponto_A: {
                id: this.pontoSelecionado.id,
                nome: this.pontoSelecionado.nome,
                coordinates: this.pontoSelecionado.posicao || [0, 0]
            },
            ponto_B: {
                id: 'temp-' + Date.now(),
                nome: 'Ponto de destino',
                coordinates: [0, 0]
            },
            ordem: (rotaSelecionada.trajeto?.length || 0) + 1
        };

        if (!rotaSelecionada.trajeto) {
            rotaSelecionada.trajeto = [];
        }

        rotaSelecionada.trajeto.push(novoSegmento);

        this.selecionarRota(rotaSelecionada.id);
        this.atualizarRotasDoPonto();

        alert(`✅ Ponto "${this.pontoSelecionado.nome}" adicionado à rota "${rotaSelecionada.nome}"!`);
    }

    mostrarErro(mensagem) {
        if (!this.conteudoDinamico) return;
        this.modoCriacao = false;
        this.conteudoDinamico.innerHTML = `
            <div class="rotas-selecionado-vazio" style="border-color: #ef4444; background: #fef2f2;">
                <p>❌ Erro: ${mensagem}</p>
            </div>
        `;
    }
}