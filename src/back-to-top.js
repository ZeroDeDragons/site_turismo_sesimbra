// ============================================================
//  back-to-top.js
//  Botão "voltar ao topo" — independente do mapa/Supabase
//  Castelo Sesimbra
// ============================================================
(function () {
    function configurarBotaoVoltarAoTopo() {
        const btn = document.getElementById('backToTopBtn');
        if (!btn) return;

        function toggleVisibilidade() {
            if (window.scrollY > 200) {
                btn.classList.add('show');
            } else {
                btn.classList.remove('show');
            }
        }

        window.addEventListener('scroll', toggleVisibilidade, { passive: true });
        toggleVisibilidade();

        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', configurarBotaoVoltarAoTopo);
    } else {
        configurarBotaoVoltarAoTopo();
    }
})();