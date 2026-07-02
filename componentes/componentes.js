const COMPONENTES_MAPA = {
    'header-container': {
        // Deixamos apenas o nome da pasta e do arquivo aqui
        pasta: 'menu',
        arquivo: 'header.js',
        init: (modulo, elemento) => {
            modulo.inicializarHeader();
        }
    },
    'container-locais': {
        pasta: 'cartao',
        arquivo: 'cartao.js',
        init: (modulo, elemento) => {
            modulo.renderizarGradeTuristica();
        }
    },
    'map-container': {
        pasta: 'mapa',
        arquivo: 'mapa.js',
        init: (modulo, elemento) => {
            window.InstanciaMapaGlobal = new modulo.ModuloMapa('map-container', {
                centro: [38.4445, -9.1015],
                zoom: 13
            });
        }
    }
};

async function carregarComponentesNecessarios() {
    const idsDosComponentes = Object.keys(COMPONENTES_MAPA);
    const componentesAcarregar = idsDosComponentes.filter(id => document.getElementById(id) !== null);

    const promises = componentesAcarregar.map(async (id) => {
        const config = COMPONENTES_MAPA[id];
        try {
            // A MÁGICA ESTÁ AQUI: O Vite exige ver o "./" escrito explicitamente 
            // seguido de uma parte do caminho para incluir os arquivos no build!
            const modulo = await import(`./${config.pasta}/${config.arquivo}`);
            const elementoAlvo = document.getElementById(id);

            if (config.init) {
                config.init(modulo, elementoAlvo);
            }
            console.log(` Componente para a ID [#${id}] carregado com sucesso.`);
        } catch (erro) {
            console.error(` Erro ao carregar o componente para a ID [#${id}]:`, erro);
        }
    });

    await Promise.all(promises);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarComponentesNecessarios);
} else {
    carregarComponentesNecessarios();
}
