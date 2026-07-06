// mapa-rotas.js
import { converterCoordenadas } from './mapa-util.js';
import { CarrisService } from './carris-service.js';
import { MapEvents, dispararEvento } from './mapa-eventos.js';

export class GerenciadorRotas {
    constructor(mapaInstancia) {
        this.mapa = mapaInstancia;
        this.rotasCamadas = {}; // Guarda as referências visuais no mapa
        this.dadosRotasOriginais = []; 
        this.modoFocoAtivo = false;
        this.rotaFocadaId = null;
        this.modoTransporteAtual = 'foot'; // 'foot', 'carro', 'autocarro'
        this.posicaoUtilizador = null;
    }

    definirDadosRotas(rotas) {
        this.dadosRotasOriginais = rotas;
    }

    definirPosicaoUtilizador(latLng) {
        this.posicaoUtilizador = latLng;
    }

    /**
     * Desenha todas as rotas em modo visão geral unindo os segmentos reais
     */
    async renderizarTodasAsRotas() {
        this.limparMapasDeRotas();
        this.modoFocoAtivo = false;

        for (const rota of this.dadosRotasOriginais) {
            const corRota = rota.cor || rota.categoria?.cor || '#23769d';
            this.rotasCamadas[rota.id] = L.featureGroup().addTo(this.mapa);

            if (!rota.trajeto || !Array.isArray(rota.trajeto) || rota.trajeto.length === 0) {
                continue;
            }

            // Desenha cada segmento que compõe a rota
            rota.trajeto.forEach((segmento, index) => {
                // Inverte de GeoJSON [lng, lat] para o padrão Leaflet [lat, lng]
                const coordA = [segmento.ponto_A.coordinates[1], segmento.ponto_A.coordinates[0]];
                const coordB = [segmento.ponto_B.coordinates[1], segmento.ponto_B.coordinates[0]];

                const polyline = L.polyline([coordA, coordB], {
                    color: corRota,
                    weight: 5,
                    opacity: 0.6,
                    dashArray: '1, 5' // Estilo pontilhado discreto para visão geral
                }).addTo(this.rotasCamadas[rota.id]);

                // Adiciona o popup informativo contendo os detalhes desse trecho
                this.adicionarPopupAoSegmento(polyline, rota, segmento, index + 1, 0);

                // Permite clicar na linha para focar na rota inteira
                polyline.on('click', () => {
                    this.focarEmRota(rota.id, 'foot');
                });
            });
        }
    }

    /**
     * Foca em uma rota específica e reconstrói o trajeto usando OSRM (Caminho Real por Ruas)
     * de acordo com o modo de transporte para cada segmento dela.
     */
    async focarEmRota(id, modo = 'foot', inverterSentido = false) {
        const rota = this.dadosRotasOriginais.find(r => r.id === id);
        if (!rota || !rota.trajeto) return;

        this.limparMapasDeRotas();
        this.modoFocoAtivo = true;
        this.rotaFocadaId = id;
        this.modoTransporteAtual = modo;

        this.rotasCamadas[id] = L.featureGroup().addTo(this.mapa);

        // Se solicitado, clona e inverte a ordem dos segmentos e os pontos internos deles
        let segmentos = JSON.parse(JSON.stringify(rota.trajeto));
        if (inverterSentido) {
            segmentos.reverse().forEach(seg => {
                const temp = seg.ponto_A;
                seg.ponto_A = seg.ponto_B;
                seg.ponto_B = temp;
            });
        }

        let tempoTotalAcumulado = 0;
        const limitesMapa = L.latLngBounds();

        // Processa as ruas reais para cada um dos segmentos sequenciais da rota
        for (let index = 0; index < segmentos.length; index++) {
            const segmento = segmentos[index];
            
            // Formato Leaflet [lat, lng] vindo das coordenadas GeoJSON do banco
            const cA = [segmento.ponto_A.coordinates[1], segmento.ponto_A.coordinates[0]];
            const cB = [segmento.ponto_B.coordinates[1], segmento.ponto_B.coordinates[0]];

            try {
                let dadosRua;
                if (modo === 'autocarro') {
                    // Modo Carris usa o serviço de tempo real
                    dadosRua = await CarrisService.obterDadosAutocarroTempoReal(cA, cB);
                } else {
                    // Modo a pé (foot) ou carro usa OSRM direto
                    dadosRua = await CarrisService.obterCaminhoReal(cA, cB, modo);
                }

                // Desenha a linha perfeitamente moldada às ruas reais obtidas pelo OSRM
                const camadaGeometria = L.geoJSON(dadosRua.geometria, {
                    style: {
                        color: rota.cor || '#ff5722',
                        weight: 6,
                        opacity: 0.9
                    }
                }).addTo(this.rotasCamadas[id]);

                const tempoMinutos = Math.round((dadosRua.duracao || dadosRua.tempoRestanteMinutos * 60 || 0) / 60);
                tempoTotalAcumulado += tempoMinutos;

                // Adiciona limites para ajustar o zoom da tela no final
                camadaGeometria.eachLayer(layer => {
                    if (layer.getBounds) limitesMapa.extend(layer.getBounds());
                });

                // Vincula o popup interativo a esse pedaço da rua real
                this.adicionarPopupAoSegmento(camadaGeometria, rota, segmento, index + 1, tempoMinutos);

            } catch (erro) {
                console.error(`Erro ao traçar caminho real para o segmento ${segmento.id_segmento}:`, erro);
                // Fallback: Desenha linha reta caso o OSRM falhe
                const polylineFallback = L.polyline([cA, cB], { color: '#ecf0f1', weight: 4 }).addTo(this.rotasCamadas[id]);
                limitesMapa.extend(cA);
                limitesMapa.extend(cB);
            }
        }

        // Ajusta a câmera do mapa para enquadrar a rota inteira perfeitamente na tela
        if (limitesMapa.isValid()) {
            this.mapa.fitBounds(limitesMapa, { padding: [50, 50] });
        }

        dispararEvento(MapEvents.ROTA_SELECIONADA, { rota, modo, tempoTotal: tempoTotalAcumulado });
    }

    /**
     * Cria e monta o HTML do Popup dinâmico para cada trecho/segmento da rota
     */
    adicionarPopupAoSegmento(polyline, rota, segmento, numSegmento, tempoMin) {
        const containerHtml = document.createElement('div');
        containerHtml.className = 'popup-rota-container';

        if (this.modoFocoAtivo) {
            containerHtml.innerHTML = `
                <h4>${rota.nome}</h4>
                <p class="popup-trecho-label"><b>Trecho ${numSegmento}:</b> ${segmento.ponto_A.nome} ➔ ${segmento.ponto_B.nome}</p>
                <p><b>Tempo estimado do trecho:</b> ${tempoMin || '...'} min</p>
                <div class="popup-botoes-modos" style="margin-top: 8px;">
                    <button class="btn-mudar-modo ${this.modoTransporteAtual === 'foot' ? 'ativo' : ''}" data-modo="foot">🚶 Peão</button>
                    <button class="btn-mudar-modo ${this.modoTransporteAtual === 'carro' ? 'ativo' : ''}" data-modo="carro">🚗 Carro</button>
                    <button class="btn-mudar-modo ${this.modoTransporteAtual === 'autocarro' ? 'ativo' : ''}" data-modo="autocarro">🚌 Carris</button>
                </div>
                <button class="btn-inverter" style="margin-top:8px; display:block; width:100%;">🔄 Inverter Sentido</button>
            `;
        } else {
            containerHtml.innerHTML = `
                <h4>${rota.nome}</h4>
                <p>${rota.descricao || 'Sem descrição disponível.'}</p>
                <p class="popup-trecho-label"><b>Trecho ${numSegmento}:</b> ${segmento.ponto_A.nome} ➔ ${segmento.ponto_B.nome}</p>
                <button class="btn-focar-rota-popup" style="margin-top:8px; width:100%;">🗺️ Ver Detalhes e Direções</button>
            `;
        }

        // Configura os ouvintes (listeners) dos botões injetados no popup
        setTimeout(() => {
            const btnFocar = containerHtml.querySelector('.btn-focar-rota-popup');
            if (btnFocar) {
                btnFocar.addEventListener('click', () => this.focarEmRota(rota.id, 'foot'));
            }

            containerHtml.querySelectorAll('.btn-mudar-modo').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const modo = e.currentTarget.getAttribute('data-modo');
                    this.focarEmRota(rota.id, modo);
                });
            });

            const btnInverter = containerHtml.querySelector('.btn-inverter');
            if (btnInverter) {
                btnInverter.addEventListener('click', () => {
                    this.focarEmRota(rota.id, this.modoTransporteAtual, true);
                });
            }
        }, 50);

        polyline.bindPopup(containerHtml);
    }

    limparMapasDeRotas() {
        Object.keys(this.rotasCamadas).forEach(id => {
            if (this.mapa.hasLayer(this.rotasCamadas[id])) {
                this.mapa.removeLayer(this.rotasCamadas[id]);
            }
        });
        this.rotasCamadas = {};
    }
}