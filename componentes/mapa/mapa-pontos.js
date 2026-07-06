import { criarJanelaPopup } from './mapa-popup.js';
import { converterCoordenadas, gerarIconeLeaflet } from './mapa-util.js';
import { MapEvents, dispararEvento } from './mapa-eventos.js';

export class GerenciadorPontos {
    constructor(mapaInstancia) {
        this.mapa = mapaInstancia;
        this.marcadores = { local: {}, rota: {} };
        this.pontoEmEdicao = null; // Guarda { id, tipo, posicaoOriginal }

        this.inicializarOuvintesAdmin();
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

            // Quando clicado, avisa o sistema (incluindo o painel admin)
            marcador.on('click', () => {
                // 🔄 ALTERAÇÃO: Se clicar no MESMO ponto em edição, ignore. 
                // Se clicar num ponto DIFERENTE, limpe a edição anterior e permita carregar o novo.
                if (this.pontoEmEdicao && this.pontoEmEdicao.id === item.id) return;

                if (this.pontoEmEdicao) {
                    this.desativarModoEdicao(); // Desativa o drag/click do ponto anterior antes de mudar
                }

                dispararEvento(MapEvents.PONTO_SELECIONADO, { id: item.id, tipo, dados: item });
            });

            // Ouvinte para quando o marcador terminar de ser arrastado
            marcador.on('dragend', (e) => {
                const novaPos = e.target.getLatLng();
                dispararEvento(MapEvents.ADMIN_PONTO_REPOSICIONADO, {
                    lat: novaPos.lat,
                    lng: novaPos.lng
                });
            });

            this.marcadores[tipo][item.id] = marcador;
        });
    }

    inicializarOuvintesAdmin() {
        // 1. Iniciar Edição: Torna o marcador arrastável e ativa clique no mapa
        window.addEventListener(MapEvents.ADMIN_INICIAR_EDICAO, (e) => {
            const { id, tipo } = e.detail;
            const marcador = this.marcadores[tipo]?.[id];

            if (marcador) {
                this.pontoEmEdicao = {
                    id,
                    tipo,
                    posicaoOriginal: marcador.getLatLng()
                };
                marcador.dragging.enable();
                marcador.closePopup(); // Fecha o popup para não atrapalhar

                // Ativa clique no mapa para mudar posição
                this.mapa.on('click', this.manipularCliqueMapaParaReposicionar, this);
            }
        });

        // 2. Cancelar Edição: Volta o marcador para a posição original e desativa arrasto
        window.addEventListener(MapEvents.ADMIN_CANCELAR_EDICAO, () => {
            if (this.pontoEmEdicao) {
                const { id, tipo, posicaoOriginal } = this.pontoEmEdicao;
                const marcador = this.marcadores[tipo]?.[id];

                if (marcador) {
                    marcador.setLatLng(posicaoOriginal);
                    marcador.dragging.disable();
                }
                this.desativarModoEdicao();
            }
        });
    }

    manipularCliqueMapaParaReposicionar(e) {
        if (!this.pontoEmEdicao) return;

        const { id, tipo } = this.pontoEmEdicao;
        const marcador = this.marcadores[tipo]?.[id];

        if (marcador) {
            marcador.setLatLng(e.latlng);
            dispararEvento(MapEvents.ADMIN_PONTO_REPOSICIONADO, {
                lat: e.latlng.lat,
                lng: e.latlng.lng
            });
        }
    }

    desativarModoEdicao() {
        if (this.pontoEmEdicao) {
            const { id, tipo } = this.pontoEmEdicao;
            const marcador = this.marcadores[tipo]?.[id];
            if (marcador) marcador.dragging.disable();
        }
        this.mapa.off('click', this.manipularCliqueMapaParaReposicionar, this);
        this.pontoEmEdicao = null;
    }

    obterMarcador(id, tipo) {
        return this.marcadores[tipo]?.[id];
    }

    atualizarPosicaoEValores(id, tipo, novosDados) {
        this.desativarModoEdicao(); // Garante o desligamento dos ouvintes temporários
        const marcador = this.marcadores[tipo]?.[id];
        if (!marcador) return;

        if (novosDados.posicao) {
            const novasCoordenadas = converterCoordenadas(novosDados.posicao);
            if (novasCoordenadas) marcador.setLatLng(novasCoordenadas);
        }
        // Recarrega o popup com os dados atualizados salvos
        const conteudoPopup = criarJanelaPopup(novosDados, tipo);
        marcador.bindPopup(conteudoPopup, { className: 'popup-leaflet' });
    }
}