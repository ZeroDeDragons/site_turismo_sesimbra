const userBtn = document.getElementById('userHeaderBtn');
const userDropdown = document.getElementById('userHeaderDropdown');

if (userBtn) {
    userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userBtn.classList.toggle('active');
        userDropdown.classList.toggle('show');
    });
}

document.addEventListener('click', (e) => {
    if (userBtn && userDropdown && !userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userBtn.classList.remove('active');
        userDropdown.classList.remove('show');
    }
});

document.getElementById('fakeProfileBtn')?.addEventListener('click', () => {
    window.location.href = 'perfil.html';
});

document.getElementById('fakeLogoutBtn')?.addEventListener('click', () => {
    window.location.href = 'index.html';
});


// ── TABS ──
function showTab(id, el) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  el.classList.add('active');
}

// ── NAME SYNC ──
function updateName() {
  const fn = document.getElementById('firstName').value;
  const ln = document.getElementById('lastName').value;
  document.getElementById('displayName').textContent = fn + ' ' + ln;
  const initials = ((fn[0]||'')+(ln[0]||'')).toUpperCase();
  document.getElementById('avatarBig').textContent = initials;
  document.getElementById('modalAvatarPreview').textContent = initials;
}

// ── INTERESTS ──
function toggleChip(el) { el.classList.toggle('selected') }

// ── TOGGLE ──
function toggleBtn(el) { el.classList.toggle('on') }

// ── PASSWORD CHECK ──
function checkPwd(v) {
    const checkSvg = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    const crossSvg = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    const set = (id, ok) => {
        const el = document.getElementById(id);
        el.classList.toggle('ok', ok);
        el.classList.toggle('err', v.length > 0 && !ok);
        el.querySelector('.rule-dot').innerHTML = (v.length > 0 && !ok) ? crossSvg : checkSvg;
    };

    set('rule-len', v.length >= 8);
    set('rule-upper', /[A-Z]/.test(v));
    set('rule-num', /[0-9]/.test(v));
    set('rule-special', /[^A-Za-z0-9]/.test(v));
}

function changePwd() {
  const cur = document.getElementById('currentPwd').value;
  const np = document.getElementById('newPwd').value;
  const cp = document.getElementById('confirmPwd').value;
  if(!cur || !np || !cp) { showToast('Preenche todos os campos.'); return; }
  if(np !== cp) { showToast('As palavras-passe não coincidem.'); return; }
  showToast('Palavra-passe atualizada com sucesso!');
  document.getElementById('currentPwd').value = '';
  document.getElementById('newPwd').value = '';
  document.getElementById('confirmPwd').value = '';
  checkPwd('');
}

// ── SAVE ──
function saveAll() { showToast('Perfil guardado com sucesso!') }

// ── TOAST ──
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  document.getElementById('toastMsg').textContent = msg;
  document.getElementById('toast').classList.add('show');
  toastTimer = setTimeout(() => document.getElementById('toast').classList.remove('show'), 3000);
}

// ── DANGER MODAL ──
let dangerType = '';
const dangerContent = {
  suspend: {title:'Suspender conta', body:'<p style="font-size:14px;color:var(--mid);line-height:1.6">Tens a certeza que queres suspender a tua conta? Não conseguirás aceder à plataforma até reativares a conta através do email de registo.</p>'},
  delete: {title:'Eliminar conta permanentemente', body:'<p style="font-size:14px;color:var(--mid);line-height:1.6;margin-bottom:14px">Esta ação é <strong style="color:#ef4444">irreversível</strong>. Todos os teus dados, favoritos e histórico serão permanentemente eliminados.</p><div class="modal-form-group"><label class="modal-label" style="font-size:11px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px;display:block">Escreve <strong>ELIMINAR</strong> para confirmar</label><input class="form-input no-icon" id="deleteConfirm" placeholder="ELIMINAR" style="border-color:#fecaca"></div>'}
};

function openDangerModal(type) {
  dangerType = type;
  const d = dangerContent[type];
  document.getElementById('dangerTitle').textContent = d.title;
  document.getElementById('dangerBody').innerHTML = d.body;
  document.getElementById('dangerModal').classList.add('show');
}

function closeDanger() { document.getElementById('dangerModal').classList.remove('show') }
function closeDangerOutside(e) { if(e.target === document.getElementById('dangerModal')) closeDanger() }

function confirmDanger() {
  if(dangerType === 'delete') {
    const v = (document.getElementById('deleteConfirm')||{}).value;
    if(v !== 'ELIMINAR') { showToast('Escreve ELIMINAR para confirmar.'); return; }
  }
  closeDanger();
  const msgs = {suspend:'Conta suspensa. Podes reativá-la a qualquer momento.', delete:'Conta eliminada. Até à próxima!'};
  showToast(msgs[dangerType]);
}

// ── AVATAR MODAL ──
let pendingColor = null;
let pendingImageUrl = null;
let savedAvatarState = null; // guarda o estado atual antes de abrir

function openAvatarModal() {
    // guarda o estado atual do avatar
    const avatarBig = document.getElementById('avatarBig');
    savedAvatarState = {
        innerHTML: avatarBig.innerHTML,
        background: avatarBig.style.background,
        backgroundImage: avatarBig.style.backgroundImage,
        textContent: avatarBig.textContent,
        padding: avatarBig.style.padding
    };

    // sincroniza o preview com o estado atual
    const preview = document.getElementById('modalAvatarPreview');
    preview.innerHTML = avatarBig.innerHTML;
    preview.style.background = avatarBig.style.background;
    preview.style.backgroundImage = avatarBig.style.backgroundImage;
    if (!avatarBig.innerHTML) {
        preview.textContent = avatarBig.textContent;
    }

    document.getElementById('avatarFileName').textContent = '';
    document.getElementById('avatarFileInput').value = '';
    pendingColor = null;
    pendingImageUrl = null;

    document.querySelectorAll('.color-swatch').forEach(s => s.style.outline = 'none');
    document.getElementById('avatarModal').classList.add('show');
}

function closeAvatar() {
    // repõe o preview para o estado guardado (cancela alterações)
    if (savedAvatarState) {
        const preview = document.getElementById('modalAvatarPreview');
        preview.innerHTML = savedAvatarState.innerHTML;
        preview.style.background = savedAvatarState.background;
        preview.style.backgroundImage = savedAvatarState.backgroundImage;
        if (!savedAvatarState.innerHTML) {
            preview.textContent = savedAvatarState.textContent;
        }
    }

    document.getElementById('avatarFileInput').value = '';
    document.getElementById('avatarFileName').textContent = '';
    document.querySelectorAll('.color-swatch').forEach(s => s.style.outline = 'none');
    pendingColor = null;
    pendingImageUrl = null;

    document.getElementById('avatarModal').classList.remove('show');
}

function closeAvatarOutside(e) {
    if (e.target === document.getElementById('avatarModal')) closeAvatar();
}

function setAvatarColor(color) {
    pendingColor = color;
    pendingImageUrl = null;

    document.getElementById('avatarFileInput').value = '';
    document.getElementById('avatarFileName').textContent = '';

    const preview = document.getElementById('modalAvatarPreview');
    preview.innerHTML = '';
    preview.style.backgroundImage = 'none';
    preview.style.background = color;

    const fn = document.getElementById('firstName')?.value || '';
    const ln = document.getElementById('lastName')?.value || '';
    preview.textContent = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || 'JS';

    document.querySelectorAll('.color-swatch').forEach(s => {
        s.style.outline = s.style.background === color ? '2px solid var(--dark)' : 'none';
        s.style.outlineOffset = '2px';
    });
}

function previewAvatarFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Só são permitidas imagens.');
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        showToast('A imagem não pode ter mais de 2MB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        pendingImageUrl = e.target.result;
        pendingColor = null;

        document.querySelectorAll('.color-swatch').forEach(s => s.style.outline = 'none');

        const preview = document.getElementById('modalAvatarPreview');
        preview.textContent = '';
        preview.innerHTML = `<img src="${pendingImageUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;

        document.getElementById('avatarFileName').textContent = file.name;
    };
    reader.readAsDataURL(file);
}

function saveAvatar() {
    const avatarBig = document.getElementById('avatarBig');

    if (pendingImageUrl) {
        avatarBig.textContent = '';
        avatarBig.innerHTML = `<img src="${pendingImageUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
        avatarBig.style.background = 'none';
        avatarBig.style.padding = '0';
    } else if (pendingColor) {
        avatarBig.innerHTML = '';
        avatarBig.style.backgroundImage = 'none';
        avatarBig.style.background = pendingColor;
        const fn = document.getElementById('firstName')?.value || '';
        const ln = document.getElementById('lastName')?.value || '';
        avatarBig.textContent = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || 'JS';
    }

    // atualiza o estado guardado após guardar
    savedAvatarState = {
        innerHTML: avatarBig.innerHTML,
        background: avatarBig.style.background,
        backgroundImage: avatarBig.style.backgroundImage,
        textContent: avatarBig.textContent,
        padding: avatarBig.style.padding
    };

    document.getElementById('avatarFileInput').value = '';
    document.getElementById('avatarFileName').textContent = '';
    document.querySelectorAll('.color-swatch').forEach(s => s.style.outline = 'none');
    pendingColor = null;
    pendingImageUrl = null;

    document.getElementById('avatarModal').classList.remove('show');
    showToast('Foto de perfil atualizada!');
}

// ── SEGURANÇA ──
function togglePwdVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = isPassword
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}
window.togglePwdVisibility = togglePwdVisibility;