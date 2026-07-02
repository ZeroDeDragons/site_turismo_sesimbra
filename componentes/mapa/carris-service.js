export const CarrisService = {
    async obterCaminhoReal(coordInicio, coordFim, modo = 'foot') {
        const perfil = modo === 'carro' ? 'driving' : 'foot';
        const url = `https://router.project-osrm.org/route/v1/${perfil}/${coordInicio[1]},${coordInicio[0]};${coordFim[1]},${coordFim[0]}?geometries=geojson&overview=full`;
        
        try {
            const resposta = await fetch(url);
            const dados = await resposta.json();
            if (dados.code !== 'Ok') throw new Error('Rota não encontrada pelo OSRM.');
            
            return {
                geometria: dados.routes[0].geometry,
                distancia: dados.routes[0].distance,
                duracao: dados.routes[0].duration
            };
        } catch (erro) {
            console.error("Erro no OSRM Routing:", erro);
            return this.gerarFallbackLinhaReta(coordInicio, coordFim);
        }
    },

    async obterDadosAutocarroTempoReal(coordInicio, coordFim) {
        try {
            // Em produção, substituir pelo endpoint real da Carris/Transporlis ou do seu Back-end Netlify
            // Exemplo simulado com o padrão de resposta esperado da API de tempo real da Carris:
            const dadosEstimados = {
                linha: "736",
                nomeLinha: "Cais do Sodré - Odivelas",
                paragemPartida: {
                    id: "01202",
                    nome: "Pç. Rossio",
                    coordenadas: [38.7140, -9.1390],
                    tempoRestanteMinutos: 4 // Tempo real do próximo autocarro
                },
                paragemChegada: {
                    id: "01405",
                    nome: "Campo Pequeno",
                    coordenadas: [38.7430, -9.1440]
                },
                horariosAgendados: ["12:05", "12:20", "12:35"],
                distanciaMetros: 3400,
                duracaoSegundos: 900
            };

            // Obtém a geometria da rua para o trajeto do autocarro
            const rotaRua = await this.obterCaminhoReal(dadosEstimados.paragemPartida.coordenadas, dadosEstimados.paragemChegada.coordenadas, 'carro');

            return {
                ...dadosEstimados,
                geometria: rotaRua.geometria
            };
        } catch (erro) {
            console.error("Erro ao obter dados em tempo real da Carris:", erro);
            throw erro;
        }
    },

    gerarFallbackLinhaReta(inicio, fim) {
        return {
            geometria: {
                type: "LineString",
                coordinates: [[inicio[1], inicio[0]], [fim[1], fim[0]]]
            },
            distancia: 0,
            duracao: 0
        };
    }
};