Guia de Integração e Extensibilidade do Módulo de Mapa

Este documento descreve detalhadamente o funcionamento interno do módulo de mapa baseado na biblioteca Leaflet. Demonstra-se aqui como estender, interagir e controlar o mapa a partir de qualquer outro componente do sistema, utilizando o padrão arquitetural Publish-Subscribe (Pub/Sub) por meio de eventos personalizados da API do navegador (CustomEvents).

Com esta arquitetura de baixo acoplamento, a integração de novas funcionalidades ocorre sem a necessidade de modificar o ficheiro de código principal (mapa.js).

1. Arquitetura do Sistema e Fluxo de Dados

O módulo foi projetado com separação estrita de responsabilidades, distribuindo as tarefas de renderização, gestão de marcadores e manipulação de eventos por diferentes ficheiros autónomos:

Ficheiro

Classe ou Função

Responsabilidade Técnica

mapa.js

ModuloMapa

Ponto de entrada do módulo. Inicializa a instância do mapa Leaflet, carrega os dados iniciais via API e regista os ouvintes de eventos globais.

mapa-pontos.js

GerenciadorPontos

Cria, armazena, atualiza e expõe os marcadores físicos (L.marker) no mapa, gerindo o ciclo de vida dos mesmos.

mapa-popup.js

criarJanelaPopup

Fábrica de componentes que gera o elemento HTML para o balão de informações do marcador, acoplando ações customizadas.

mapa-eventos.js

MapEvents

Centraliza a declaração dos nomes dos eventos suportados e fornece a função utilitária dispararEvento().

mapa-util.js

Funções Utilitárias

Realiza a conversão de estruturas de coordenadas (incluindo o formato GeoJSON do Supabase) e gera a marcação visual dos marcadores.

mapa.css

Estilos CSS

Controla a apresentação visual dos marcadores e as dimensões dos balões informativos do Leaflet.

Fluxo de Comunicação por Eventos

[ Componente Externo ] --(Dispara: FOCAR_PONTO)-------> [ ModuloMapa (mapa.js) ]
                                                            |
                                                            v (Centraliza a câmara)
                                                      [ mapa-pontos.js ] 
                                                            |
                                                            v (Apresenta o balão de detalhes)
[ Interação do Utilizador ] -> [ Clique no marcador ] --(Dispara: PONTO_SELECIONADO)--> [ Componente Externo ]


2. Protocolos de Interação Baseados em Eventos (Plugins)

A comunicação bidirecional com o mapa é efetuada exclusivamente através do objeto global window.

Caso de Uso A: Focar e Centralizar o Mapa num Ponto Específico

Quando o utilizador clica num item de uma lista externa (como uma barra lateral), o sistema deve ordenar ao mapa que centralize a câmara no marcador correspondente e abra o respetivo popup informacional.

Para tal, dispare o evento mapa:focar-ponto:

import { MapEvents, dispararEvento } from './mapa-eventos.js';

// Exemplo: Evento associado a um botão na barra de navegação lateral
const botaoDetalhes = document.querySelector('#btn-local-123');

botaoDetalhes.addEventListener('click', () => {
    // O módulo de mapa intercetará este evento e executará a transição de câmara
    dispararEvento(MapEvents.FOCAR_PONTO, { 
        id: '123',        // Identificador único do registo
        tipo: 'local'     // Categoria do marcador ('local' ou 'rota')
    });
});


Caso de Uso B: Atualização de Dados e Coordenadas em Tempo Real

Caso o utilizador submeta um formulário de edição (alterando o nome, a descrição ou a geolocalização de um ponto), é possível atualizar a interface do mapa imediatamente sem reprocessar todos os marcadores ativos na memória.

Para tal, dispare o evento mapa:atualizar-ponto:

import { MapEvents, dispararEvento } from './mapa-eventos.js';

// Função executada após a confirmação de gravação dos dados na base de dados
function processarAtualizacaoPontual(idRegisto, dadosFormulario) {
    dispararEvento(MapEvents.ATUALIZAR_PONTO, {
        id: idRegisto,
        tipo: 'local',
        dados: {
            posicao: { lat: -23.55052, lng: -46.633308 }, // Coordenadas geográficas opcionais
            titulo: dadosFormulario.nome,
            descricao: dadosFormulario.descricao,
            categoria: {
                cor: '#e74c3c',
                simbolo: 'P'
            }
        }
    });
}


Caso de Uso C: Capturar a Seleção de um Marcador no Mapa

Quando o utilizador clica diretamente sobre um marcador no mapa, a aplicação pode necessitar de reagir, por exemplo, abrindo um painel lateral detalhado. O mapa comunica esta ação disparando o evento mapa:ponto-selecionado.

Para escutar esta ação na sua aplicação:

import { MapEvents } from './mapa-eventos.js';

// Escuta ativa no contexto global da aplicação
window.addEventListener(MapEvents.PONTO_SELECIONADO, (evento) => {
    const { id, tipo } = evento.detail;
    
    // Processamento da informação do ponto selecionado
    carregarPainelLateralInformativo(id, tipo);
});


Caso de Uso D: Ação Personalizada Injetada no Popup ("Revelar Rotas")

O componente de popup gerado pelo ficheiro mapa-popup.js possui um botão interno de ação que dispara o evento personalizado mapa:revelar-rotas-ponto para a janela global.

Para capturar e processar este comando:

window.addEventListener('mapa:revelar-rotas-ponto', (evento) => {
    const { id } = evento.detail;
    
    // Execução da lógica de negócio associada às rotas do local selecionado
    requisitarRotasRelacionadas(id);
});


3. Exemplo de Integração Completa

O exemplo seguinte demonstra a inicialização do mapa e a integração de eventos com uma barra lateral de navegação:

import { ModuloMapa } from './mapa.js';
import { MapEvents, dispararEvento } from './mapa-eventos.js';

// 1. Inicialização do mapa com as configurações de geolocalização padrão
const definicoesMapa = {
    centro: [-23.5489, -46.6388],
    zoom: 13
};
const instanciaMapa = new ModuloMapa('map-container', definicoesMapa);

// 2. Vinculação da interface lateral para controlo de foco no mapa
const itensLista = document.querySelectorAll('.item-lista-local');
itensLista.forEach(item => {
    item.addEventListener('click', () => {
        const idLocal = item.dataset.id;
        
        // Solicita ao mapa a focagem dinâmica do marcador correspondente
        dispararEvento(MapEvents.FOCAR_PONTO, { id: idLocal, tipo: 'local' });
    });
});

// 3. Sincronização do estado da lista com as interações ocorridas no mapa
window.addEventListener(MapEvents.PONTO_SELECIONADO, (evento) => {
    const { id } = evento.detail;
    
    // Atualização visual do estado ativo na interface lateral
    itensLista.forEach(item => item.classList.remove('ativo'));
    const itemCorrespondente = document.querySelector(`.item-lista-local[data-id="${id}"]`);
    if (itemCorrespondente) {
        itemCorrespondente.classList.add('ativo');
        itemCorrespondente.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});


4. Vantagens Arquiteturais e Boas Práticas

Abstração da Biblioteca de Terceiros: A infraestrutura de eventos atua como uma interface de programação estável. Caso exista a necessidade futura de substituir o Leaflet por outro provedor de mapas (como Google Maps ou Maplibre), o restante código da aplicação permanece inalterado.

Eficiência de Renderização: O método de atualização parcial implementado evita a destruição de marcadores existentes na árvore do mapa, minimizando operações custosas de manipulação de DOM e otimizando o consumo de memória.

Desacoplamento Completo: A inexistência de referências diretas de instâncias de classes externas para com o mapa garante facilidade na manutenção do código, permitindo que diferentes programadores trabalhem de forma autónoma nas interfaces e nas funcionalidades geográficas.