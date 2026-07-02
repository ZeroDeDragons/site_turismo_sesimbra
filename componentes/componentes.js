const COMPONENTES_MAPA = {
    'header-container': {
        // Guardamos apenas o subcaminho exato aqui
        path: 'menu/header.js', 
        init: (modulo, elemento) => {
            modulo.inicializarHeader();
        }
    },
    'container-locais': {
        path: 'cartao/cartao.js',
        init: (modulo, elemento) => {
            modulo.renderizarGradeTuristica();
        }
    },
    'map-container': {
        path: 'mapa/mapa.js',
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
            // AQUI ESTÁ O SEGREDO:
            // Deixamos o './' fixo para o seu notebook funcionar localmente,
            // e usamos a template string para forçar o Vite a incluir essas subpastas no build final!
            const modulo = await import(`./${config.path}`); 
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
