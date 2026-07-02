import { criarJanelaPopup } from './mapa-popup.js';
import { converterCoordenadas, gerarIconeLeaflet } from './mapa-util.js';
import { MapEvents, dispararEvento } from './mapa-eventos.js';

export class GerenciadorPontos {
    constructor(mapaInstancia) {
        this.mapa = mapaInstancia;
        this.marcadores = { local: {}, rota: {} };
    }

    adicionarPontos(dadosLocais, tipo = 'local') {
        dadosLocais.forEach(item => {
            const coordenadas = converterCoordenadas(item.posicao || item.coordenadas);
            if (!coordenadas) return;

            const cor = item.categoria?.cor || '#23769d';
            const simbolo = item.categoria?.simbolo || '📍';
            const icone = gerarIconeLeaflet(cor, simbolo);
            
            const conteudoPopup = criarJanelaPopup(item, tipo);

            const marcador = L.marker(coordenadas, { icon: icone })
                .bindPopup(conteudoPopup, { className: 'popup-leaflet' })
                .addTo(this.mapa);

            // Plugin 2: Quando clicado diretamente no mapa, avisa o resto da aplicação
            marcador.on('click', () => {
                dispararEvento(MapEvents.PONTO_SELECIONADO, { id: item.id, tipo });
            });

            this.marcadores[tipo][item.id] = marcador;
        });
    }

    mostrarPopup(id, tipo) {
        const marcador = this.marcadores[tipo]?.[id];
        if (marcador) {
            marcador.openPopup();
        }
    }

    atualizarPosicaoEValores(id, tipo, novosDados) {
        const marcador = this.marcadores[tipo]?.[id];
        if (!marcador) return;

        // Atualiza posição se enviada
        if (novosDados.posicao) {
            const novasCoordenadas = converterCoordenadas(novosDados.posicao);
            if (novasCoordenadas) marcador.setLatLng(novasCoordenadas);
        }

        // Atualiza o conteúdo do popup dinamicamente sem recriar o marcador
        const novoConteudo = criarJanelaPopup({ id, ...novosDados }, tipo);
        marcador.setPopupContent(novoConteudo);
    }

    obterMarcador(id, tipo) {
        return this.marcadores[tipo]?.[id];
    }
}