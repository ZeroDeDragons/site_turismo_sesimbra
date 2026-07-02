import { GerenciadorCartoes } from '../cartao/cartao.js';

export function criarJanelaPopup(dados, tipo) {
    // Definimos uma ação customizada para o botão quando ele for renderizado DENTRO do mapa
    const botoesCustomizadosDoPopup = [
        {
            texto: '🗺️ Revelar Rotas Associadas',
            classe: 'btn-popup-revelar-rotas',
            acao: (evento, dadosDoPonto) => {
                console.log(`Botão clicado! Iniciando busca de rotas para o local ID: ${dadosDoPonto.id}`);
                
                // Dispara o evento personalizado para o plugin do mapa interceptar
                const eventoRotas = new CustomEvent('mapa:revelar-rotas-ponto', {
                    detail: { id: dadosDoPonto.id }
                });
                window.dispatchEvent(eventoRotas);
            }
        }
    ];

    // Pedimos para a fábrica gerar o cartão idêntico ao do site, mas com o botão customizado!
    const elementoCartaoTotal = GerenciadorCartoes.criarElementoCartao(dados, tipo, botoesCustomizadosDoPopup);
    
    // Adicionamos uma classe extra apenas para estilos específicos de dimensões no Leaflet se necessário
    elementoCartaoTotal.classList.add('cartao-modo-popup');

    return elementoCartaoTotal;
}