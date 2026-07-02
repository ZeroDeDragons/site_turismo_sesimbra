import { obterDadosTurismo } from '../../serviços/api.js';
import { MapEvents, dispararEvento } from '../mapa/mapa-eventos.js';
import './cartao.css';

export class GerenciadorCartoes {
    /**
     * Instancia um cartão base totalmente funcional.
     * Pode ser chamado tanto pela página principal quanto pelo mapa.
     */
    static criarElementoCartao(dado, tipo, botoesCustomizados = null) {
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="cartao" data-id="${dado.id}" data-tipo="${tipo}">
                <div class="cartao-img-wrapper">
                    <img class="cartao-img" src="${dado.fotos?.[0]?.url || 'https://via.placeholder.com/300'}" alt="${dado.nome}">
                    <button class="seta seta-esquerda" style="display: ${dado.fotos?.length > 1 ? 'block' : 'none'}">◀</button>
                    <button class="seta seta-direita" style="display: ${dado.fotos?.length > 1 ? 'block' : 'none'}">▶</button>
                </div>
                <div class="cartao-conteudo">
                    <div class="cartao-topo">
                        <h3 class="cartao-titulo">${dado.nome}</h3>
                    </div>
                    <p class="cartao-descricao">${dado.descricao || 'Sem descrição.'}</p>
                    <div class="cartao-botoes-rodape"></div>
                </div>
            </div>
        `;

        const elementoCartao = div.firstElementChild;
        
        // 1. Inicializa o Carrossel Interno de Fotos do Cartão
        this._configurarCarrosselInterno(elementoCartao, dado.fotos || []);

        // 2. Injeta as Ações do Rodapé (Se não vier personalizado, coloca o padrão "Ver mais")
        const containerBotoes = elementoCartao.querySelector('.cartao-botoes-rodape');
        
        if (botoesCustomizados && botoesCustomizados.length > 0) {
            botoesCustomizados.forEach(configBotao => {
                const btn = document.createElement('button');
                btn.className = configBotao.classe || 'btn btn--primary';
                btn.textContent = configBotao.texto;
                btn.addEventListener('click', (e) => configBotao.acao(e, dado));
                containerBotoes.appendChild(btn);
            });
        } else {
            // Ação Padrão: Botão "Ver mais" que foca no mapa
            const btnVerMais = document.createElement('button');
            btnVerMais.className = 'btn btn--primary cartao-btn';
            btnVerMais.textContent = 'Ver mais';
            btnVerMais.addEventListener('click', () => {
                dispararEvento(MapEvents.FOCAR_PONTO, { id: dado.id, tipo: tipo });
            });
            containerBotoes.appendChild(btnVerMais);
        }

        return elementoCartao;
    }

    /**
     * Controla a troca de imagens interna de cada cartão individual
     */
    static _configurarCarrosselInterno(cartao, fotos) {
        if (fotos.length <= 1) return;
        let indexAtual = 0;
        const imgElemento = cartao.querySelector('.cartao-img');
        
        cartao.querySelector('.seta-esquerda').addEventListener('click', (e) => {
            e.stopPropagation();
            indexAtual = (indexAtual - 1 + fotos.length) % fotos.length;
            imgElemento.src = fotos[indexAtual].url;
        });

        cartao.querySelector('.seta-direita').addEventListener('click', (e) => {
            e.stopPropagation();
            indexAtual = (indexAtual + 1) % fotos.length;
            imgElemento.src = fotos[indexAtual].url;
        });
    }

    /**
     * Renderiza as listas na página principal dividindo por Locais e Rotas
     */
    static async renderizarGradeTuristica() {
        try {
            // 1. Procura ambos os containers na página
            const containerLocais = document.getElementById('container-locais');
            const containerRotas = document.getElementById('container-rotas');

            // Se nenhum dos dois existir na página atual, não faz nada
            if (!containerLocais && !containerRotas) return;

            // 2. Procura os dados unificados na API (Supabase/Cache)
            const { locais, rotas } = await obterDadosTurismo();

            // 3. Verifica e renderiza os LOCAIS (se o container existir)
            if (containerLocais && locais) {
                containerLocais.innerHTML = ""; // Limpa skeletons/gráficos antigos
                locais.forEach(local => {
                    // Passa o tipo 'local' para a fábrica saber como etiquetar o HTML e o evento
                    const cartao = this.criarElementoCartao(local, 'local');
                    containerLocais.appendChild(cartao);
                });
            }

            // 4. Verifica e renderiza as ROTAS (se o container existir)
            if (containerRotas && rotas) {
                containerRotas.innerHTML = ""; // Limpa
                rotas.forEach(rota => {
                    // Passa o tipo 'rota' para a fábrica criar o cartão correto da rota
                    const cartao = this.criarElementoCartao(rota, 'rota');
                    containerRotas.appendChild(cartao);
                });
            }

        } catch (erro) {
            console.error("❌ Erro ao carregar e separar a grade de cartões:", erro);
        }
    }
}

export async function renderizarGradeTuristica() {
    // Repassa a execução para o método estático dentro da sua Classe
    await GerenciadorCartoes.renderizarGradeTuristica();
}