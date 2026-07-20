// menu mobile (só corre se o header já tiver sido injetado com este botão)
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');
if (menuToggle && navLinks) {
menuToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', isOpen);
    menuToggle.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
});
}



// carrossel simples de imagens no page-banner
const bannerPhotos = document.querySelectorAll('.page-banner-photo');
if (bannerPhotos.length > 1) {
let bannerIndex = 0;
setInterval(() => {
    bannerPhotos[bannerIndex].classList.remove('is-active');
    bannerIndex = (bannerIndex + 1) % bannerPhotos.length;
    bannerPhotos[bannerIndex].classList.add('is-active');
}, 5000); // troca a cada 5 segundos
}



// filtros por categoria
const filtros = document.getElementById('filtros');
const cartoes = document.querySelectorAll('#patrimonioGrid .patrimonio-card');

if (filtros) {
filtros.addEventListener('click', (e) => {
    const chip = e.target.closest('.filtro-chip');
    if (!chip) return;

    filtros.querySelectorAll('.filtro-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const categoria = chip.dataset.categoria;
    cartoes.forEach(cartao => {
    const mostrar = categoria === 'todos' || cartao.dataset.categoria === categoria;
    cartao.style.display = mostrar ? '' : 'none';
    });
});
}



// botão voltar ao topo
const backToTopBtn = document.getElementById('backToTopBtn');
if (backToTopBtn) {
window.addEventListener('scroll', () => {
    if (window.scrollY > 300) backToTopBtn.classList.add('show');
    else backToTopBtn.classList.remove('show');
});
backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}