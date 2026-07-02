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
});


(function(){
    function desenharCurva(){
    const track = document.getElementById('timelineTrack');
    const svg = document.getElementById('timelineCurve');
    const path = document.getElementById('timelineCurvePath');
    if(!track || !svg || !path) return;

    const largura = track.scrollWidth;
    const altura = track.scrollHeight;
    svg.setAttribute('width', largura);
    svg.setAttribute('height', altura);
    svg.setAttribute('viewBox', `0 0 ${largura} ${altura}`);

    const trackRect = track.getBoundingClientRect();
    const marcadores = track.querySelectorAll('.t-marker');
    const pontos = Array.from(marcadores).map(m => {
        const r = m.getBoundingClientRect();
        return { x: r.left - trackRect.left + r.width / 2, y: r.top - trackRect.top + r.height / 2 };
    });
    if(pontos.length < 2) return;

    let d = `M ${pontos[0].x} ${pontos[0].y}`;
    for(let i = 0; i < pontos.length - 1; i++){
        const p0 = pontos[i - 1] || pontos[i];
        const p1 = pontos[i];
        const p2 = pontos[i + 1];
        const p3 = pontos[i + 2] || p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    path.setAttribute('d', d);
    }

    window.addEventListener('load', desenharCurva);
    window.addEventListener('resize', desenharCurva);
    if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(desenharCurva);
    }
})();