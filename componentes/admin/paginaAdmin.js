  // ---- pílulas de navegação: realçam e fazem scroll até ao painel correspondente ----
  const filterRow = document.getElementById('filterRow');
  filterRow.querySelectorAll('.admin-tab[data-target]').forEach(chip => {
    chip.addEventListener('click', () => {
      filterRow.querySelectorAll('.admin-tab[data-target]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const target = chip.dataset.target;
      if (target){
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  document.getElementById('scrollToMap').addEventListener('click', () => {
    document.getElementById('mapa').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---- pesquisa simples: filtra cartões pelo nome/título ----
  const adminSearch = document.getElementById('adminSearch');
  adminSearch.addEventListener('input', () => {
    const q = adminSearch.value.trim().toLowerCase();
    document.querySelectorAll('.grade-de-cartoes .cartao, .grade-de-cartoes .cartao-categoria').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  });

  // ---- estado vazio para containers ainda sem conteúdo dinâmico ----
  function markEmptyIfNeeded(id, mensagem, icone){
    const el = document.getElementById(id);
    if (el && el.children.length === 0){
      el.innerHTML = `<div class="empty-state"><i class="fas ${icone}"></i> ${mensagem}</div>`;
    }
  }
  window.addEventListener('load', () => {
    setTimeout(() => {
      markEmptyIfNeeded('container-locais', 'Ainda não há locais registados.', 'fa-map-marker-alt');
      markEmptyIfNeeded('container-rotas', 'Ainda não há rotas registadas.', 'fa-route');
      markEmptyIfNeeded('container-admin-categorias', 'Ainda não há categorias criadas.', 'fa-tags');
    }, 800); // dá tempo ao componentes.js popular os containers primeiro
  });

  // ---- botão voltar ao topo ----
  const backToTopBtn = document.getElementById('backToTopBtn');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) backToTopBtn.classList.add('show');
    else backToTopBtn.classList.remove('show');
  });
  backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));