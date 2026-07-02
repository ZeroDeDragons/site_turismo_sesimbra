<<<<<<< HEAD
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
     * Desenha todas as rotas em modo visão geral
     */
    async renderizarTodasAsRotas() {
        this.limparMapasDeRotas();
        this.modoFocoAtivo = false;

        for (const rota of this.dadosRotasOriginais) {
            const corRota = rota.categoria?.cor || '#23769d';
            this.rotasCamadas[rota.id] = L.featureGroup().addTo(this.mapa);

            // Se a rota possui múltiplos segmentos mapeados por ID no BD
            // No mock do Netlify temos 'coordenadas' fixas, vamos iterar sobre os pares
            const coords = rota.coordenadas || [];
            
            for (let i = 0; i < coords.length - 1; i++) {
                const p1 = converterCoordenadas(coords[i]);
                const p2 = converterCoordenadas(coords[i+1]);
                
                if (p1 && p2) {
                    const dadosCaminho = await CarrisService.obterCaminhoReal(p1, p2, 'foot');
                    const coordenadasInvertidasParaLeaflet = dadosCaminho.geometria.coordinates.map(c => [c[1], c[0]]);
                    
                    const polyline = L.polyline(coordenadasInvertidasParaLeaflet, {
                        color: corRota,
                        weight: 4,
                        opacity: 0.8
                    });

                    this.adicionarPopupGeral(polyline, rota, dadosCaminho);
                    this.rotasCamadas[rota.id].addLayer(polyline);
                }
            }
        }
    }

    /**
     * Foca em uma rota específica e renderiza com base no modo de transporte selecionado
     */
    async focarEmRota(idRota, modoTransporte = 'foot', inverterSentido = false) {
        this.limparMapasDeRotas();
        this.modoFocoAtivo = true;
        this.rotaFocadaId = idRota;
        this.modoTransporteAtual = modoTransporte;

        const rota = this.dadosRotasOriginais.find(r => r.id === idRota);
        if (!rota) return;

        this.rotasCamadas[idRota] = L.featureGroup().addTo(this.mapa);
        let coords = [...(rota.coordenadas || [])];

        if (inverterSentido) {
            coords.reverse();
        }

        // Regra 5: Ordenação não sequencial por proximidade do utilizador
        if (this.posicaoUtilizador && coords.length > 2) {
            coords = this.ordenarSegmentosPorProximidade(coords, this.posicaoUtilizador);
        }

        if (modoTransporte === 'autocarro') {
            // Processamento Especial Carris
            const pPrimeiro = converterCoordenadas(coords[0]);
            const pUltimo = converterCoordenadas(coords[coords.length - 1]);
            
            const dadosCarris = await CarrisService.obterDadosAutocarroTempoReal(pPrimeiro, pUltimo);
            const latLngsAutocarro = dadosCarris.geometria.coordinates.map(c => [c[1], c[0]]);

            // Marcadores de paragem Carris
            const iconeParagem = L.divIcon({ html: '🚌', className: 'marcador-paragem' });
            L.marker(dadosCarris.paragemPartida.coordenadas, { icon: iconeParagem })
                .bindPopup(`<b>Paragem Próxima:</b> ${dadosCarris.paragemPartida.nome}<br>Próximo veículo em: ${dadosCarris.paragemPartida.tempoRestanteMinutos} min`)
                .addTo(this.rotasCamadas[idRota]);

            const linhaCarris = L.polyline(latLngsAutocarro, { color: '#ffcc00', weight: 6, dashArray: '10, 10' });
            this.adicionarPopupDetalhado(linhaCarris, rota, dadosCarris, true);
            this.rotasCamadas[idRota].addLayer(linhaCarris);
            
            this.adicionarSetasDirecao(latLngsAutocarro, idRota);
        } else {
            // Modos de Superfície padrão (A pé / Carro)
            for (let i = 0; i < coords.length - 1; i++) {
                const p1 = converterCoordenadas(coords[i]);
                const p2 = converterCoordenadas(coords[i+1]);

                if (p1 && p2) {
                    const dadosCaminho = await CarrisService.obterCaminhoReal(p1, p2, modoTransporte);
                    const latLngs = dadosCaminho.geometria.coordinates.map(c => [c[1], c[0]]);

                    // Estilização dinâmica por segmento se estiver em foco (Ex: tons alternados para diferenciar)
                    const corSegmento = i % 2 === 0 ? '#e74c3c' : '#3498db';

                    const polyline = L.polyline(latLngs, {
                        color: corSegmento,
                        weight: 5,
                        opacity: 0.9
                    });

                    this.adicionarPopupDetalhado(polyline, rota, dadosCaminho, false, i+1);
                    this.rotasCamadas[idRota].addLayer(polyline);

                    // Adicionar texto com o nome do local/ponto no mapa
                    L.marker(p1, { 
                        icon: L.divIcon({ className: 'rotulo-ponto', html: `<span>Ponto ${i+1}</span>`, iconSize: [60, 20] }) 
                    }).addTo(this.rotasCamadas[idRota]);

                    this.adicionarSetasDirecao(latLngs, idRota);
                }
            }
        }

        // Ajusta o zoom do mapa para abranger a rota completa focada
        const limites = this.rotasCamadas[idRota].getBounds();
        if (limites.isValid()) this.mapa.fitBounds(limites, { padding: [50, 50] });
    }

    ordenarSegmentosPorProximidade(coords, localReferencia) {
        // Ordena os pontos originais com base em qual está mais perto do local atual do utilizador
        return [...coords].sort((a, b) => {
            const pA = converterCoordenadas(a);
            const pB = converterCoordenadas(b);
            const distA = L.latLng(localReferencia).distanceTo(L.latLng(pA));
            const distB = L.latLng(localReferencia).distanceTo(L.latLng(pB));
            return distA - distB;
        });
    }

    adicionarSetasDirecao(latLngs, idRota) {
        // Implementação nativa simples usando SVG ou polilinhas curtas intermédias para indicar a direção (Ponto A -> B)
        if (latLngs.length < 2) return;
        const meio = latLngs[Math.floor(latLngs.length / 2)];
        const proximo = latLngs[Math.floor(latLngs.length / 2) + 1];

        if(meio && proximo) {
            const iconeSeta = L.divIcon({
                className: 'seta-direcao',
                html: `<div style="transform: rotate(${this.calcularAngulo(meio, proximo)}deg);">➔</div>`,
                iconSize: [20, 20]
            });
            L.marker(meio, { icon: iconeSeta }).addTo(this.rotasCamadas[idRota]);
        }
    }

    calcularAngulo(p1, p2) {
        return Math.atan2(p2[0] - p1[0], p2[1] - p1[1]) * 180 / Math.PI;
    }

    adicionarPopupGeral(polyline, rota, dadosCaminho) {
        const distKm = (dadosCaminho.distancia / 1000).toFixed(2);
        const tempoMin = Math.round(dadosCaminho.duracao / 60);

        const containerHtml = document.createElement('div');
        containerHtml.innerHTML = `
            <h4>${rota.nome}</h4>
            <p><b>Distância:</b> ${distKm} km</p>
            <p><b>Tempo Est.:</b> ${tempoMin} min</p>
            <button class="btn-ver-detalhes" style="padding:4px 8px; cursor:pointer;">Ver Rota Detalhada</button>
        `;

        containerHtml.querySelector('.btn-ver-detalhes').addEventListener('click', () => {
            this.focarEmRota(rota.id, 'foot');
        });

        polyline.bindPopup(containerHtml);
    }

    adicionarPopupDetalhado(polyline, rota, dados, ehAutocarro = false, numSegmento = 1) {
        const containerHtml = document.createElement('div');
        const tempoMin = Math.round(dados.duracao / 60 || dados.duracaoSegundos / 60);

        if (ehAutocarro) {
            containerHtml.innerHTML = `
                <h4>Linha Carris ${dados.linha}</h4>
                <p>${dados.nomeLinha}</p>
                <p><b>Próxima paragem:</b> ${dados.paragemPartida.nome}</p>
                <p><b>Próximo Horário Real:</b> ${dados.paragemPartida.tempoRestanteMinutos} min</p>
                <hr/>
                <button class="btn-inverter" style="margin-top:5px;">🔄 Inverter Sentido</button>
            `;
        } else {
            containerHtml.innerHTML = `
                <h4>${rota.nome} - Segmento ${numSegmento}</h4>
                <p><b>Tempo do Trecho:</b> ${tempoMin} min</p>
                <div style="margin-top: 8px;">
                    <button class="btn-mudar-modo" data-modo="foot">🚶</button>
                    <button class="btn-mudar-modo" data-modo="carro">🚗</button>
                    <button class="btn-mudar-modo" data-modo="autocarro">🚌 Carris</button>
                </div>
                <button class="btn-inverter" style="margin-top:8px; display:block;">🔄 Inverter Sentido</button>
            `;
        }

        // Listeners dos botões internos do popup dinâmico
        setTimeout(() => {
            containerHtml.querySelectorAll('.btn-mudar-modo').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const modo = e.currentTarget.getAttribute('data-modo');
                    this.focarEmRota(rota.id, modo);
                });
            });

            containerHtml.querySelector('.btn-inverter').addEventListener('click', () => {
                this.focarEmRota(rota.id, this.modoTransporteAtual, true);
            });
        }, 100);

        polyline.bindPopup(containerHtml);
    }

    limparMapasDeRotas() {
        Object.keys(this.rotasCamadas).forEach(id => {
            this.mapa.removeLayer(this.rotasCamadas[id]);
        });
        this.rotasCamadas = {};
    }
=======
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
     * Desenha todas as rotas em modo visão geral
     */
    async renderizarTodasAsRotas() {
        this.limparMapasDeRotas();
        this.modoFocoAtivo = false;

        for (const rota of this.dadosRotasOriginais) {
            const corRota = rota.categoria?.cor || '#23769d';
            this.rotasCamadas[rota.id] = L.featureGroup().addTo(this.mapa);

            // Se a rota possui múltiplos segmentos mapeados por ID no BD
            // No mock do Netlify temos 'coordenadas' fixas, vamos iterar sobre os pares
            const coords = rota.coordenadas || [];
            
            for (let i = 0; i < coords.length - 1; i++) {
                const p1 = converterCoordenadas(coords[i]);
                const p2 = converterCoordenadas(coords[i+1]);
                
                if (p1 && p2) {
                    const dadosCaminho = await CarrisService.obterCaminhoReal(p1, p2, 'foot');
                    const coordenadasInvertidasParaLeaflet = dadosCaminho.geometria.coordinates.map(c => [c[1], c[0]]);
                    
                    const polyline = L.polyline(coordenadasInvertidasParaLeaflet, {
                        color: corRota,
                        weight: 4,
                        opacity: 0.8
                    });

                    this.adicionarPopupGeral(polyline, rota, dadosCaminho);
                    this.rotasCamadas[rota.id].addLayer(polyline);
                }
            }
        }
    }

    /**
     * Foca em uma rota específica e renderiza com base no modo de transporte selecionado
     */
    async focarEmRota(idRota, modoTransporte = 'foot', inverterSentido = false) {
        this.limparMapasDeRotas();
        this.modoFocoAtivo = true;
        this.rotaFocadaId = idRota;
        this.modoTransporteAtual = modoTransporte;

        const rota = this.dadosRotasOriginais.find(r => r.id === idRota);
        if (!rota) return;

        this.rotasCamadas[idRota] = L.featureGroup().addTo(this.mapa);
        let coords = [...(rota.coordenadas || [])];

        if (inverterSentido) {
            coords.reverse();
        }

        // Regra 5: Ordenação não sequencial por proximidade do utilizador
        if (this.posicaoUtilizador && coords.length > 2) {
            coords = this.ordenarSegmentosPorProximidade(coords, this.posicaoUtilizador);
        }

        if (modoTransporte === 'autocarro') {
            // Processamento Especial Carris
            const pPrimeiro = converterCoordenadas(coords[0]);
            const pUltimo = converterCoordenadas(coords[coords.length - 1]);
            
            const dadosCarris = await CarrisService.obterDadosAutocarroTempoReal(pPrimeiro, pUltimo);
            const latLngsAutocarro = dadosCarris.geometria.coordinates.map(c => [c[1], c[0]]);

            // Marcadores de paragem Carris
            const iconeParagem = L.divIcon({ html: '🚌', className: 'marcador-paragem' });
            L.marker(dadosCarris.paragemPartida.coordenadas, { icon: iconeParagem })
                .bindPopup(`<b>Paragem Próxima:</b> ${dadosCarris.paragemPartida.nome}<br>Próximo veículo em: ${dadosCarris.paragemPartida.tempoRestanteMinutos} min`)
                .addTo(this.rotasCamadas[idRota]);

            const linhaCarris = L.polyline(latLngsAutocarro, { color: '#ffcc00', weight: 6, dashArray: '10, 10' });
            this.adicionarPopupDetalhado(linhaCarris, rota, dadosCarris, true);
            this.rotasCamadas[idRota].addLayer(linhaCarris);
            
            this.adicionarSetasDirecao(latLngsAutocarro, idRota);
        } else {
            // Modos de Superfície padrão (A pé / Carro)
            for (let i = 0; i < coords.length - 1; i++) {
                const p1 = converterCoordenadas(coords[i]);
                const p2 = converterCoordenadas(coords[i+1]);

                if (p1 && p2) {
                    const dadosCaminho = await CarrisService.obterCaminhoReal(p1, p2, modoTransporte);
                    const latLngs = dadosCaminho.geometria.coordinates.map(c => [c[1], c[0]]);

                    // Estilização dinâmica por segmento se estiver em foco (Ex: tons alternados para diferenciar)
                    const corSegmento = i % 2 === 0 ? '#e74c3c' : '#3498db';

                    const polyline = L.polyline(latLngs, {
                        color: corSegmento,
                        weight: 5,
                        opacity: 0.9
                    });

                    this.adicionarPopupDetalhado(polyline, rota, dadosCaminho, false, i+1);
                    this.rotasCamadas[idRota].addLayer(polyline);

                    // Adicionar texto com o nome do local/ponto no mapa
                    L.marker(p1, { 
                        icon: L.divIcon({ className: 'rotulo-ponto', html: `<span>Ponto ${i+1}</span>`, iconSize: [60, 20] }) 
                    }).addTo(this.rotasCamadas[idRota]);

                    this.adicionarSetasDirecao(latLngs, idRota);
                }
            }
        }

        // Ajusta o zoom do mapa para abranger a rota completa focada
        const limites = this.rotasCamadas[idRota].getBounds();
        if (limites.isValid()) this.mapa.fitBounds(limites, { padding: [50, 50] });
    }

    ordenarSegmentosPorProximidade(coords, localReferencia) {
        // Ordena os pontos originais com base em qual está mais perto do local atual do utilizador
        return [...coords].sort((a, b) => {
            const pA = converterCoordenadas(a);
            const pB = converterCoordenadas(b);
            const distA = L.latLng(localReferencia).distanceTo(L.latLng(pA));
            const distB = L.latLng(localReferencia).distanceTo(L.latLng(pB));
            return distA - distB;
        });
    }

    adicionarSetasDirecao(latLngs, idRota) {
        // Implementação nativa simples usando SVG ou polilinhas curtas intermédias para indicar a direção (Ponto A -> B)
        if (latLngs.length < 2) return;
        const meio = latLngs[Math.floor(latLngs.length / 2)];
        const proximo = latLngs[Math.floor(latLngs.length / 2) + 1];

        if(meio && proximo) {
            const iconeSeta = L.divIcon({
                className: 'seta-direcao',
                html: `<div style="transform: rotate(${this.calcularAngulo(meio, proximo)}deg);">➔</div>`,
                iconSize: [20, 20]
            });
            L.marker(meio, { icon: iconeSeta }).addTo(this.rotasCamadas[idRota]);
        }
    }

    calcularAngulo(p1, p2) {
        return Math.atan2(p2[0] - p1[0], p2[1] - p1[1]) * 180 / Math.PI;
    }

    adicionarPopupGeral(polyline, rota, dadosCaminho) {
        const distKm = (dadosCaminho.distancia / 1000).toFixed(2);
        const tempoMin = Math.round(dadosCaminho.duracao / 60);

        const containerHtml = document.createElement('div');
        containerHtml.innerHTML = `
            <h4>${rota.nome}</h4>
            <p><b>Distância:</b> ${distKm} km</p>
            <p><b>Tempo Est.:</b> ${tempoMin} min</p>
            <button class="btn-ver-detalhes" style="padding:4px 8px; cursor:pointer;">Ver Rota Detalhada</button>
        `;

        containerHtml.querySelector('.btn-ver-detalhes').addEventListener('click', () => {
            this.focarEmRota(rota.id, 'foot');
        });

        polyline.bindPopup(containerHtml);
    }

    adicionarPopupDetalhado(polyline, rota, dados, ehAutocarro = false, numSegmento = 1) {
        const containerHtml = document.createElement('div');
        const tempoMin = Math.round(dados.duracao / 60 || dados.duracaoSegundos / 60);

        if (ehAutocarro) {
            containerHtml.innerHTML = `
                <h4>Linha Carris ${dados.linha}</h4>
                <p>${dados.nomeLinha}</p>
                <p><b>Próxima paragem:</b> ${dados.paragemPartida.nome}</p>
                <p><b>Próximo Horário Real:</b> ${dados.paragemPartida.tempoRestanteMinutos} min</p>
                <hr/>
                <button class="btn-inverter" style="margin-top:5px;">🔄 Inverter Sentido</button>
            `;
        } else {
            containerHtml.innerHTML = `
                <h4>${rota.nome} - Segmento ${numSegmento}</h4>
                <p><b>Tempo do Trecho:</b> ${tempoMin} min</p>
                <div style="margin-top: 8px;">
                    <button class="btn-mudar-modo" data-modo="foot">🚶</button>
                    <button class="btn-mudar-modo" data-modo="carro">🚗</button>
                    <button class="btn-mudar-modo" data-modo="autocarro">🚌 Carris</button>
                </div>
                <button class="btn-inverter" style="margin-top:8px; display:block;">🔄 Inverter Sentido</button>
            `;
        }

        // Listeners dos botões internos do popup dinâmico
        setTimeout(() => {
            containerHtml.querySelectorAll('.btn-mudar-modo').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const modo = e.currentTarget.getAttribute('data-modo');
                    this.focarEmRota(rota.id, modo);
                });
            });

            containerHtml.querySelector('.btn-inverter').addEventListener('click', () => {
                this.focarEmRota(rota.id, this.modoTransporteAtual, true);
            });
        }, 100);

        polyline.bindPopup(containerHtml);
    }

    limparMapasDeRotas() {
        Object.keys(this.rotasCamadas).forEach(id => {
            this.mapa.removeLayer(this.rotasCamadas[id]);
        });
        this.rotasCamadas = {};
    }
>>>>>>> ab6c34930675a2be95c5cba4fbea6f5316e191bf
}