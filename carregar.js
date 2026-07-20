document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("loader-canvas");
    const pctText = document.getElementById("loader-pct");
    const loaderScreen = document.getElementById("custom-loader");

    if (!canvas || !pctText || !loaderScreen) return;

    const thickness = 8; // Espessura das peças (mais finas)
    let num = 1;
    const layersConfig = [
        { id: 3, radius: 81, count: 36, color: "blue" },  // Camada Interna (Carrega de 0% a 33%)
        { id: 2, radius: 89, count: 42, color: "green" }, // Camada do Meio (Carrega de 34% a 66%)
        { id: 1, radius: 97, count: 48, color: "blue" }   // Camada Externa (Carrega de 67% a 100%)
    ];

    const layerBlocks = { 3: [], 2: [], 1: [] };

    // Criando os blocos
    layersConfig.forEach((config) => {
        const layerDiv = document.createElement("div");
        layerDiv.className = `loader-layer loader-layer--${config.id}`;
        canvas.appendChild(layerDiv);
        const blockWidth = ((2 * Math.PI * config.radius) / config.count) + 0.4;

        for (let i = 0; i < config.count; i++) {
            const block = document.createElement("div");

            if (num == 1) {
                block.className = `loader-block loader-block--green`;
                num = 0;
            } else {
                num = 1;
                block.className = `loader-block loader-block--blue`;
            }
            // Ângulo de posicionamento
            const angleDeg = (i / config.count) * 360;
            const angleRad = (angleDeg * Math.PI) / 180;

            // Coordenadas de disparo (vêm de fora da tela)
            const offscreenDistance = Math.max(window.innerWidth, window.innerHeight) * 1.2;
            const startX = `${Math.cos(angleRad) * offscreenDistance}px`;
            const startY = `${Math.sin(angleRad) * offscreenDistance}px`;

            // Passa as coordenadas calculadas para o CSS
            block.style.setProperty("--angle", `${angleDeg}deg`);
            block.style.setProperty("--radius", `${config.radius}px`);
            block.style.setProperty("--block-width", `${blockWidth}px`);
            block.style.setProperty("--block-thickness", `${thickness}px`);
            block.style.setProperty("--start-x", startX);
            block.style.setProperty("--start-y", startY);

            layerDiv.appendChild(block);
            layerBlocks[config.id].push(block);
        }

        // Embaralha as peças dentro de cada camada para elas entrarem de forma orgânica
        layerBlocks[config.id].sort(() => Math.random() - 0.5);
    });

    let progress = 0;

    function updateLoader() {
        progress += 1;
        if (progress > 100) progress = 100;

        pctText.textContent = `${progress}%`;

        // Distribui o surgimento dos blocos de forma rígida entre as camadas:
        // 0% a 33%   -> Renderiza a Camada 3 (Interna)
        // 34% a 66%  -> Renderiza a Camada 2 (Meio)
        // 67% a 100% -> Renderiza a Camada 1 (Externa)

        let activeLayerId = 3;
        let percentInLayer = 0;

        if (progress <= 33) {
            activeLayerId = 3;
            percentInLayer = progress / 33;
        } else if (progress <= 66) {
            // Garante que toda a camada 3 esteja ativa
            activateAllInLayer(3);
            activeLayerId = 2;
            percentInLayer = (progress - 33) / 33;
        } else {
            // Garante que as camadas 3 e 2 estejam completas
            activateAllInLayer(3);
            activateAllInLayer(2);
            activeLayerId = 1;
            percentInLayer = (progress - 66) / 34;
        }

        // Ativa os blocos da camada atualmente ativa proporcionalmente
        const blocksInCurrentLayer = layerBlocks[activeLayerId];
        const targetCount = Math.floor(percentInLayer * blocksInCurrentLayer.length);

        for (let i = 0; i < targetCount; i++) {
            const b = blocksInCurrentLayer[i];
            if (b && !b.classList.contains("is-active")) {
                b.classList.add("is-active");
                b.style.animation = "fly-in 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards";
            }
        }

        if (progress < 100) {
            setTimeout(updateLoader, 35); // Velocidade do contador (ms por porcentagem)
        } else {
            // Garante que absolutamente todos os blocos de todas as camadas estejam encaixados
            activateAllInLayer(3);
            activateAllInLayer(2);
            activateAllInLayer(1);

            // Espera o último bloco terminar a animação de voo e some com a tela de carregamento suavemente
            setTimeout(() => {
                loaderScreen.classList.add("is-hidden");
            }, 1000);
        }
    }

    // Função utilitária para garantir o preenchimento de segurança das camadas anteriores
    function activateAllInLayer(layerId) {
        layerBlocks[layerId].forEach((b) => {
            if (!b.classList.contains("is-active")) {
                b.classList.add("is-active");
                b.style.animation = "fly-in 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards";
            }
        });
    }

    // Pequeno delay inicial seguro antes de iniciar o progresso
    setTimeout(updateLoader, 200);
});
