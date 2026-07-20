// admin-categorias.js
import { obterDadosTurismo } from '../../../serviços/api.js'; // Ajuste o caminho se necessário
import { dispararEventoAdmin, ouvirEventoAdmin } from '../adminEvents.js';
import { PluginsAdmin } from '../adminPlugins.js';
import './admin-categorias.css';
export class ComponenteCategoriasAdmin {
    constructor(elementoAlvo) {
        this.container = elementoAlvo;
        this.listaCategorias = [];
        this.categoriasOriginais = [];
        this.init();
    }

    async init() {
        this.container.innerHTML = `
            <div class="admin-categorias-header">
                <h3>✨ Gestão de Categorias</h3>
                <button id="btn-nova-categoria" class="btn-primary">➕ Nova Categoria</button>
            </div>

            <div id="form-categoria-panel" class="form-categoria-panel escondido">
                <h4 id="form-titulo">Criar Nova Categoria</h4>
                <form id="form-categoria">
                    <input type="hidden" id="cat-id">
                    
                    <div class="form-group">
                        <label for="cat-nome">Nome da Categoria:</label>
                        <input type="text" id="cat-nome" required placeholder="Ex: Museus, Parques...">
                    </div>

                    <div class="form-group-row">
                        <div class="form-group">
                            <label for="cat-cor">Cor (Hex):</label>
                            <input type="color" id="cat-cor" value="#23769d">
                        </div>
                        <div class="form-group">
                            <label for="cat-simbolo">Símbolo (Emoji):</label>
                            <input type="text" id="cat-simbolo" required placeholder="Ex: 🏛️, 🌳" maxlength="2">
                        </div>
                    </div>

                    <div class="form-acoes">
                        <button type="button" id="btn-cancelar-form" class="btn-secondary">Cancelar</button>
                        <button type="submit" id="btn-salvar-form" class="btn-success">Preparar Alteração</button>
                    </div>
                </form>
            </div>

            <div id="lista-categorias-cards" class="lista-categorias-cards"></div>
        `;

        // 1. Mapeia os elementos do HTML que acabamos de injetar com segurança
        this.btnNovo = this.container.querySelector('#btn-nova-categoria');
        this.painelForm = this.container.querySelector('#form-categoria-panel');
        this.form = this.container.querySelector('#form-categoria');
        this.listaCardsContainer = this.container.querySelector('#lista-categorias-cards');
        this.btnCancelarForm = this.container.querySelector('#btn-cancelar-form');

        // 2. Busca inicial dos dados usando a api
        try {
            const dados = await obterDadosTurismo();
            this.listaCategorias = dados.categorias || this.extrairCategoriasDosDados(dados);
            this.categoriasOriginais = JSON.parse(JSON.stringify(this.listaCategorias));
        } catch (err) {
            console.error("Erro ao carregar dados de categorias:", err);
        }

        // 3. Registra Ouvintes do Ciclo de Staging (Eventos)
        ouvirEventoAdmin('categoria', 'preparar', (detalhes) => {
            this.listaCategorias = PluginsAdmin.categoria.preparar(detalhes, this.listaCategorias);
            this.render();
        });

        ouvirEventoAdmin('categoria', 'confirmar', (detalhes) => {
            this.listaCategorias = PluginsAdmin.categoria.confirmar(detalhes, this.listaCategorias);
            this.render();
        });

        ouvirEventoAdmin('categoria', 'reverter', (detalhes) => {
            this.listaCategorias = PluginsAdmin.categoria.reverter(detalhes, this.listaCategorias);
            this.render();
        });

        // 4. Ouvintes da Interface Gráfica (Agora livres do erro de null)
        this.btnNovo.addEventListener('click', () => this.abrirFormulario());
        this.btnCancelarForm.addEventListener('click', () => this.fecharFormulario());
        this.form.addEventListener('submit', (e) => this.submeterFormulario(e));

        this.render();
    }

    abrirFormulario(categoriaParaEditar = null) {
        this.painelForm.classList.remove('escondido');
        const titulo = this.container.querySelector('#form-titulo');

        if (categoriaParaEditar) {
            titulo.innerText = `✏️ Editando: ${categoriaParaEditar.nome}`;
            this.container.querySelector('#cat-id').value = categoriaParaEditar.id;
            this.container.querySelector('#cat-nome').value = categoriaParaEditar.nome;
            this.container.querySelector('#cat-cor').value = categoriaParaEditar.cor || '#23769d';
            this.container.querySelector('#cat-simbolo').value = categoriaParaEditar.simbolo || '📍';
        } else {
            titulo.innerText = '✨ Criar Nova Categoria';
            this.form.reset();
            this.container.querySelector('#cat-id').value = 'temp-' + Date.now();
        }
    }

    fecharFormulario() {
        this.painelForm.classList.add('escondido');
        this.form.reset();
    }

    submeterFormulario(e) {
        e.preventDefault();

        const id = this.container.querySelector('#cat-id').value;
        const nome = this.container.querySelector('#cat-nome').value;
        const cor = this.container.querySelector('#cat-cor').value;
        const simbolo = this.container.querySelector('#cat-simbolo').value;

        const dadosForm = { id, nome, cor, simbolo };
        const ehNovo = String(id).startsWith('temp-');
        const operacao = ehNovo ? 'inserir' : 'atualizar';

        if (ehNovo) {
            dispararEventoAdmin('preparar', 'categoria', 'inserir', dadosForm, null);
        } else {
            const original = this.categoriasOriginais.find(c => String(c.id) === String(id));
            dispararEventoAdmin('preparar', 'categoria', 'atualizar', dadosForm, original);
        }

        // 🔥 CONFIRMA a alteração - PASSANDO O ID CORRETAMENTE
        dispararEventoAdmin('confirmar', 'categoria', null, { id });

        this.fecharFormulario();
    }

    // Modificar confirmarCommit()
    confirmarCommit(id) {
        // Dispara diretamente a confirmação com o ID
        dispararEventoAdmin('confirmar', 'categoria', null, { id });
    }

    // Modificar solicitarDelecao()
    solicitarDelecao(cat) {
        dispararEventoAdmin('preparar', 'categoria', 'deletar', cat, cat);
        // Após preparar, confirma automaticamente
        dispararEventoAdmin('confirmar', 'categoria', null, { id: cat.id });
    }

    // Modificar confirmarCommit()
    confirmarCommit(id) {
        // Dispara diretamente a confirmação
        dispararEventoAdmin('confirmar', 'categoria');
    }

    solicitarDelecao(cat) {
        dispararEventoAdmin('preparar', 'categoria', 'deletar', cat, cat);
    }

    confirmarCommit(id) {
        dispararEventoAdmin('confirmar', 'categoria', null, { id });
    }

    reverterFase(id) {
        dispararEventoAdmin('reverter', 'categoria', null, { id });
    }

    render() {
        this.listaCardsContainer.innerHTML = '';

        if (this.listaCategorias.length === 0) {
            this.listaCardsContainer.innerHTML = `<p style="color:#7f8c8d; text-align:center; font-size:14px;">Nenhuma categoria mapeada.</p>`;
            return;
        }

        this.listaCategorias.forEach(cat => {
            const card = document.createElement('div');
            card.className = `cartao-categoria ${cat._status || ''}`;

            card.innerHTML = `
                <div class="cat-info-bloco">
                    <div class="cat-badge-preview" style="background: ${cat.cor || '#7f8c8d'}">
                        ${cat.simbolo || '❓'}
                    </div>
                    <div class="cat-detalhes-texto">
                        <div class="cat-nome">${cat.nome}</div>
                        <div class="cat-meta">${cat._status ? `⚠️ Alteração em rascunho` : `ID estável no banco`}</div>
                    </div>
                </div>
                <div class="cat-acoes-bloco">
                    ${!cat._status ? `
                        <button class="btn-edit" data-id="${cat.id}">Editar</button>
                        <button class="btn-danger" data-id="${cat.id}">Apagar</button>
                    ` : `
                        <button class="btn-success btn-commit" data-id="${cat.id}">Aplicar</button>
                        <button class="btn-secondary btn-rollback" data-id="${cat.id}">Desfazer</button>
                    `}
                </div>
            `;

            if (!cat._status) {
                card.querySelector('.btn-edit').addEventListener('click', () => this.abrirFormulario(cat));
                card.querySelector('.btn-danger').addEventListener('click', () => this.solicitarDelecao(cat));
            } else {
                card.querySelector('.btn-commit').addEventListener('click', () => this.confirmarCommit(cat.id));
                card.querySelector('.btn-rollback').addEventListener('click', () => this.reverterFase(cat.id));
            }

            this.listaCardsContainer.appendChild(card);
        });
    }

    extrairCategoriasDosDados(dados) {
        const mapaCats = new Map();
        const processar = (item) => {
            if (item?.categoria?.id) mapaCats.set(item.categoria.id, item.categoria);
        };
        (dados.locais || []).forEach(processar);
        (dados.rotas || []).forEach(processar);
        return Array.from(mapaCats.values());
    }
}