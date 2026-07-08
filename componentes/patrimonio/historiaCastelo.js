document.addEventListener('DOMContentLoaded', function () {
const userBtn = document.getElementById('userHeaderBtn');
const userDropdown = document.getElementById('userHeaderDropdown');
if (userBtn && userDropdown) {
    userBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    userBtn.classList.toggle('active');
    userDropdown.classList.toggle('show');
    });
    document.addEventListener('click', function (e) {
    if (!userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userBtn.classList.remove('active');
        userDropdown.classList.remove('show');
    }
    });
}

// Linha do tempo horizontal: setas de navegação
const muralhaScroll = document.getElementById('muralhaScroll');
const muralhaPrev = document.getElementById('muralhaPrev');
const muralhaNext = document.getElementById('muralhaNext');

if (muralhaScroll && muralhaPrev && muralhaNext) {
    const passo = () => Math.min(320, muralhaScroll.clientWidth * 0.8);

    muralhaPrev.addEventListener('click', function () {
    muralhaScroll.scrollBy({ left: -passo(), behavior: 'smooth' });
    });
    muralhaNext.addEventListener('click', function () {
    muralhaScroll.scrollBy({ left: passo(), behavior: 'smooth' });
    });

    const atualizarSetas = () => {
    const maximo = muralhaScroll.scrollWidth - muralhaScroll.clientWidth - 2;
    muralhaPrev.disabled = muralhaScroll.scrollLeft <= 2;
    muralhaNext.disabled = muralhaScroll.scrollLeft >= maximo;
    };

    muralhaScroll.addEventListener('scroll', atualizarSetas);
    window.addEventListener('resize', atualizarSetas);
    atualizarSetas();
}
});