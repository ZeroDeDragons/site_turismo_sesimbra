import dataManager from '../../serviços/GerenciadorDados.js';
import { GerenciadorPontos } from './mapa-pontos.js';
import { GerenciadorRotas } from './mapa-rotas.js'; 
import { MapEvents } from './mapa-eventos.js';

export class ModuloMapa {
    constructor(idContainer, config) {
        this.container = document.getElementById(idContainer);
        if (!this.container) {
            console.error(`Container #${idContainer} não encontrado.`);
            return;
        }
        window.InstanciaMapaGlobal = this;

        this.mapa = L.map(idContainer).setView(config.centro, config.zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.mapa);

        this.pontosManager = new GerenciadorPontos(this.mapa);
        this.rotasManager = new GerenciadorRotas(this.mapa); 

        this.inicializarPlugins();
        this.capturarLocalizacaoUtilizador();
        this.carregarDadosIniciais();
    }

    async carregarDadosIniciais() {
        try {
            const locais = await dataManager.getTodosLocais();
            const rotas = await dataManager.getTodasRotas();

            this.pontosManager.adicionarPontos(locais, 'local');

            this.rotasManager.definirDadosRotas(rotas);
            await this.rotasManager.renderizarTodasAsRotas();
        } catch (erro) {
            console.error("Erro ao carregar dados no mapa principal através do DataManager:", erro);
        }
    }

    capturarLocalizacaoUtilizador() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (posicao) => {
                    const local = [posicao.coords.latitude, posicao.coords.longitude];
                    this.rotasManager.definirPosicaoUtilizador(local);
                },
                () => console.warn("Acesso à localização recusado. Paragens ordenadas por padrão.")
            );
        }
    }

    inicializarPlugins() {
        window.addEventListener(MapEvents.FOCAR_PONTO, (e) => {
            const { id, tipo } = e.detail;
            this.focarNoPonto(id, tipo);
        });

        window.addEventListener('mapa:revelar-rotas-ponto', (e) => {
            const { id } = e.detail;
            this.rotasManager.focarEmRota(id, 'foot');
        });

        window.addEventListener(MapEvents.ATUALIZAR_PONTO, (e) => {
            const { id, tipo, dados } = e.detail;
            this.pontosManager.atualizarPosicaoEValores(id, tipo, dados);
            this.focarNoPonto(id, tipo);
        });
    }

    focarNoPonto(id, tipo) {
        const marcador = this.pontosManager.obterMarcador(id, tipo);
        if (!marcador) return;

        this.container.scrollIntoView({ behavior: 'smooth' });

        marcador.openPopup();
    }
}