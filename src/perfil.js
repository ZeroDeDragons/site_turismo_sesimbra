import { supabase } from './supabaseClient.js';

// ============================================================
// 1. HEADER DROPDOWN
// ============================================================
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

document.getElementById('inicioBtn')?.addEventListener('click', () => {
    window.location.href = 'index.html';
});

document.getElementById('fakeProfileBtn')?.addEventListener('click', () => {
    window.location.href = 'perfil.html';
});

document.getElementById('fakeLogoutBtn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
});

// ============================================================
// 2. VARIÁVEIS GLOBAIS
// ============================================================
let currentUser = null;
let userProfile = null;
let userInterests = [];
let allCategories = [];
let userActivities = [];
let userFavorites = [];

// ============================================================
// 3. TABS
// ============================================================
function showTab(id, el) {
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    if (el) el.classList.add('active');
}
window.showTab = showTab;

// ============================================================
// 4. CARREGAR DADOS DO USUÁRIO
// ============================================================
async function loadUserData() {
    try {
        // Pegar usuário logado
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        currentUser = user;
        
        // Buscar perfil
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (profileError) throw profileError;
        userProfile = profile;
        
        // Buscar categorias (interesses disponíveis)
        const { data: categories, error: categoriesError } = await supabase
            .from('categorias')
            .select('*')
            .order('nome');
        
        if (categoriesError) throw categoriesError;
        allCategories = categories || [];
        
        // Buscar interesses do usuário (pode não ter)
        const { data: interests, error: interestsError } = await supabase
            .from('user_interests')
            .select('categoria_id')
            .eq('user_id', user.id);
        
        if (interestsError && interestsError.code !== 'PGRST116') {
            console.warn('Erro ao buscar interesses:', interestsError);
        }
        userInterests = (interests || []).map(i => i.categoria_id);
        
        // Buscar atividades do usuário (pode não ter)
        const { data: activities, error: activitiesError } = await supabase
            .from('user_activities')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (activitiesError && activitiesError.code !== 'PGRST116') {
            console.warn('Erro ao buscar atividades:', activitiesError);
        }
        userActivities = activities || [];
        
        // Buscar favoritos (pode não ter)
        const { data: favorites, error: favoritesError } = await supabase
            .from('user_favorites')
            .select('local_id')
            .eq('user_id', user.id);
        
        if (favoritesError && favoritesError.code !== 'PGRST116') {
            console.warn('Erro ao buscar favoritos:', favoritesError);
        }
        userFavorites = favorites || [];
        
        // Buscar preferências de notificação (pode não ter)
        const { data: prefs, error: prefsError } = await supabase
            .from('user_notification_preferences')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
        
        if (prefsError && prefsError.code !== 'PGRST116') {
            console.warn('Erro ao buscar preferências:', prefsError);
        }
        
        // Guardar preferências (ou criar padrão)
        window.notificationPrefs = prefs || {
            email_routes: true,
            email_events: true,
            email_security: true,
            push_enabled: true,
            push_messages: true
        };
        
        // Atualizar UI
        updateProfileUI();
        renderInterests();
        renderActivities();
        renderFavoritesStats();
        renderNotifications();
        
        console.log('✅ Dados do perfil carregados:', { 
            userProfile, 
            allCategories, 
            userInterests,
            userActivities,
            userFavorites,
            notificationPrefs: window.notificationPrefs
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        showToast('Erro ao carregar perfil');
    }
}

// ============================================================
// 5. ATUALIZAR UI DO PERFIL
// ============================================================
function updateProfileUI() {
    if (!userProfile) return;

    // Nome
    const displayName = document.getElementById('displayName');
    if (displayName) {
        displayName.textContent = userProfile.full_name || 'Utilizador';
    }

    // Header
    const headerName = document.querySelector('.user-header-name');
    if (headerName) {
        headerName.textContent = userProfile.full_name || userProfile.email?.split('@')[0] || 'Visitante';
    }

    // Avatar
    const avatarBig = document.getElementById('avatarBig');
    if (avatarBig) {
        if (userProfile.avatar_url) {
            avatarBig.innerHTML = `<img src="${userProfile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
            avatarBig.style.background = 'none';
            avatarBig.style.padding = '0';
        } else {
            const initials = getInitials(userProfile.full_name || userProfile.email || 'U');
            avatarBig.textContent = initials;
            avatarBig.style.background = '#979d23';
            avatarBig.style.padding = '';
        }
    }

    // Campos do formulário
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const phone = document.getElementById('phone');
    const location = document.getElementById('location');
    const bio = document.getElementById('bio');
    const email = document.getElementById('email');

    if (firstName) firstName.value = userProfile.first_name || '';
    if (lastName) lastName.value = userProfile.last_name || '';
    if (phone) phone.value = userProfile.phone || '';
    if (location) location.value = userProfile.location || '';
    if (bio) bio.value = userProfile.bio || '';
    if (email) email.value = userProfile.email || '';

    // Data de nascimento
    const birthDate = document.getElementById('birthDate');
    if (birthDate && userProfile.birth_date) {
        birthDate.value = userProfile.birth_date.split('T')[0];
    }

    // Género
    const gender = document.getElementById('gender');
    if (gender && userProfile.gender) {
        gender.value = userProfile.gender;
    }
}

// ============================================================
// 6. INTERESSES (conectado ao Supabase)
// ============================================================
function renderInterests() {
    const grid = document.getElementById('interestsGrid');
    if (!grid) return;

    if (allCategories.length === 0) {
        grid.innerHTML = '<p style="color:#9ca3af;">Nenhuma categoria disponível.</p>';
        return;
    }

    grid.innerHTML = allCategories.map(cat => {
        const isSelected = userInterests.includes(cat.id);
        return `
            <div class="interest-chip ${isSelected ? 'selected' : ''}" 
                 data-categoria-id="${cat.id}"
                 onclick="toggleInterest(${cat.id}, this)">
                <span class="chip-icon">${cat.simbolo || '📍'}</span>
                <span class="chip-label">${cat.nome}</span>
            </div>
        `;
    }).join('');
}

async function toggleInterest(categoriaId, element) {
    if (!currentUser) return;

    const isSelected = element.classList.toggle('selected');

    try {
        if (isSelected) {
            // Adicionar interesse
            const { error } = await supabase
                .from('user_interests')
                .insert({ user_id: currentUser.id, categoria_id: categoriaId });

            if (error) throw error;
            userInterests.push(categoriaId);

        } else {
            // Remover interesse
            const { error } = await supabase
                .from('user_interests')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('categoria_id', categoriaId);

            if (error) throw error;
            userInterests = userInterests.filter(id => id !== categoriaId);
        }

        showToast(isSelected ? 'Interesse adicionado!' : 'Interesse removido!');

    } catch (error) {
        console.error('❌ Erro ao atualizar interesse:', error);
        element.classList.toggle('selected'); // Reverter
        showToast('Erro ao atualizar interesse');
    }
}
window.toggleInterest = toggleInterest;

// ============================================================
// 7. ATIVIDADES (conectado ao Supabase)
// ============================================================
function renderActivities() {
    const list = document.getElementById('activityList');
    if (!list) return;

    if (userActivities.length === 0) {
        list.innerHTML = `
            <div class="activity-item">
                <div class="activity-info">
                    <div class="ai-title">Nenhuma atividade recente</div>
                    <div class="ai-time">Explora a plataforma para começares!</div>
                </div>
            </div>
        `;
        return;
    }

    const iconMap = {
        'route_created': 'route',
        'route_completed': 'route',
        'place_visited': 'hist',
        'favorite_added': 'fav'
    };

    list.innerHTML = userActivities.map(activity => {
        const iconType = iconMap[activity.type] || 'route';
        return `
            <div class="activity-item">
                <div class="activity-dot ${iconType}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${getIconSVG(iconType)}
                    </svg>
                </div>
                <div class="activity-info">
                    <div class="ai-title">${activity.title}</div>
                    <div class="ai-time">${formatDate(activity.created_at)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function getIconSVG(type) {
    const icons = {
        route: '<path d="M3 12h18M3 6h18M3 18h18"/>',
        fav: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
        hist: '<path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/>'
    };
    return icons[type] || icons.route;
}

// ============================================================
// 8. ESTATÍSTICAS (conectado ao Supabase)
// ============================================================
async function renderFavoritesStats() {
    const grid = document.getElementById('statsGrid');
    if (!grid) return;
    
    // Contar rotas criadas pelo usuário
    const { count: rotasCount, error: rotasError } = await supabase
        .from('rotas')
        .select('*', { count: 'exact', head: true })
        .eq('criado_por', currentUser?.id);
    
    if (rotasError && rotasError.code !== 'PGRST116') {
        console.warn('Erro ao contar rotas:', rotasError);
    }
    
    // Contar locais visitados (atividades do tipo 'place_visited')
    const { count: locaisCount, error: locaisError } = await supabase
        .from('user_activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser?.id)
        .eq('type', 'place_visited');
    
    if (locaisError && locaisError.code !== 'PGRST116') {
        console.warn('Erro ao contar locais:', locaisError);
    }
    
    // Contar favoritos
    const { count: favoritosCount, error: favError } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser?.id);
    
    if (favError && favError.code !== 'PGRST116') {
        console.warn('Erro ao contar favoritos:', favError);
    }
    
    const stats = [
        { value: rotasCount || 0, label: 'Rotas criadas', bg: 'var(--primary-faint)', color: 'var(--primary-dark)' },
        { value: locaisCount || 0, label: 'Locais visitados', bg: 'var(--secondary-faint)', color: 'var(--secondary-dark)' },
        { value: favoritosCount || 0, label: 'Favoritos', bg: '#f5f3ff', color: '#6d28d9' },
        { value: userActivities.length || 0, label: 'Atividades', bg: '#fff7ed', color: '#c2410c' }
    ];
    
    grid.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            ${stats.map(s => `
                <div style="background:${s.bg};border-radius:12px;padding:16px;text-align:center">
                    <div style="font-family:'Poppins',sans-serif;font-size:1.8rem;font-weight:800;color:${s.color}">${s.value}</div>
                    <div style="font-size:12px;font-weight:700;color:var(--mid);margin-top:2px">${s.label}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================================
// 9. NOTIFICAÇÕES (conectado ao Supabase)
// ============================================================
async function renderNotifications() {
    const prefs = window.notificationPrefs || {
        email_routes: true,
        email_events: true,
        email_security: true,
        push_enabled: true,
        push_messages: true
    };
    
    const emailNotifsData = [
        { 
            label: 'Novas rotas e trilhos', 
            desc: 'Quando uma nova rota é adicionada à região', 
            key: 'email_routes',
            enabled: prefs.email_routes ?? true 
        },
        { 
            label: 'Eventos e festividades', 
            desc: 'Atividades e eventos locais', 
            key: 'email_events',
            enabled: prefs.email_events ?? true 
        },
        { 
            label: 'Alertas de segurança', 
            desc: 'Acessos e alterações à conta', 
            key: 'email_security',
            enabled: prefs.email_security ?? true 
        }
    ];
    
    const pushNotifsData = [
        { 
            label: 'Ativar notificações push', 
            desc: 'Recebe alertas em tempo real', 
            key: 'push_enabled',
            enabled: prefs.push_enabled ?? true 
        },
        { 
            label: 'Novas mensagens', 
            desc: 'Comunicações da equipa Sesimbra', 
            key: 'push_messages',
            enabled: prefs.push_messages ?? true 
        }
    ];
    
    const emailList = document.getElementById('emailNotifList');
    const pushList = document.getElementById('pushNotifList');
    
    if (emailList) {
        emailList.innerHTML = emailNotifsData.map(n => `
            <div class="notif-row">
                <div class="notif-info">
                    <div class="notif-label">${n.label}</div>
                    <div class="notif-desc">${n.desc}</div>
                </div>
                <button class="toggle ${n.enabled ? 'on' : ''}" 
                        onclick="toggleNotification('${n.key}', this)"></button>
            </div>
        `).join('');
    }
    
    if (pushList) {
        pushList.innerHTML = pushNotifsData.map(n => `
            <div class="notif-row">
                <div class="notif-info">
                    <div class="notif-label">${n.label}</div>
                    <div class="notif-desc">${n.desc}</div>
                </div>
                <button class="toggle ${n.enabled ? 'on' : ''}" 
                        onclick="toggleNotification('${n.key}', this)"></button>
            </div>
        `).join('');
    }
}

async function toggleNotification(key, element) {
    if (!currentUser) return;

    const isEnabled = element.classList.toggle('on');

    try {
        const updateData = { [key]: isEnabled };
        const { error } = await supabase
            .from('user_notification_preferences')
            .upsert({
                user_id: currentUser.id,
                ...updateData,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        showToast('Preferência atualizada!');

    } catch (error) {
        console.error('❌ Erro ao atualizar preferência:', error);
        element.classList.toggle('on');
        showToast('Erro ao atualizar preferência');
    }
}
window.toggleNotification = toggleNotification;

// ============================================================
// 10. NAME SYNC
// ============================================================
function updateName() {
    const fn = document.getElementById('firstName').value;
    const ln = document.getElementById('lastName').value;
    document.getElementById('displayName').textContent = (fn || ln) ? fn + ' ' + ln : 'Utilizador';

    const initials = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || 'U';
    document.getElementById('avatarBig').textContent = initials;
    document.getElementById('modalAvatarPreview').textContent = initials;
}
window.updateName = updateName;

// ============================================================
// 11. TOAST
// ============================================================
let toastTimer;

function showToast(msg) {
    clearTimeout(toastTimer);
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (toastMsg) toastMsg.textContent = msg;
    if (toast) toast.classList.add('show');
    toastTimer = setTimeout(() => {
        if (toast) toast.classList.remove('show');
    }, 3000);
}
window.showToast = showToast;

// ============================================================
// 12. PASSWORD CHECK
// ============================================================
function checkPwd(v) {
    const checkSvg = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    const crossSvg = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    const set = (id, ok) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('ok', ok);
        el.classList.toggle('err', v.length > 0 && !ok);
        const dot = el.querySelector('.rule-dot');
        if (dot) {
            dot.innerHTML = (v.length > 0 && !ok) ? crossSvg : checkSvg;
        }
    };

    set('rule-len', v.length >= 8);
    set('rule-upper', /[A-Z]/.test(v));
    set('rule-num', /[0-9]/.test(v));
    set('rule-special', /[^A-Za-z0-9]/.test(v));
}
window.checkPwd = checkPwd;

function changePwd() {
    const cur = document.getElementById('currentPwd').value;
    const np = document.getElementById('newPwd').value;
    const cp = document.getElementById('confirmPwd').value;
    if (!cur || !np || !cp) { showToast('Preenche todos os campos.'); return; }
    if (np !== cp) { showToast('As palavras-passe não coincidem.'); return; }
    showToast('Palavra-passe atualizada com sucesso!');
    document.getElementById('currentPwd').value = '';
    document.getElementById('newPwd').value = '';
    document.getElementById('confirmPwd').value = '';
    checkPwd('');
}
window.changePwd = changePwd;

// ============================================================
// 13. DANGER MODAL
// ============================================================
let dangerType = '';
const dangerContent = {
    suspend: {
        title: 'Suspender conta',
        body: '<p style="font-size:14px;color:var(--mid);line-height:1.6">Tens a certeza que queres suspender a tua conta? Não conseguirás aceder à plataforma até reativares a conta através do email de registo.</p>'
    },
    delete: {
        title: 'Eliminar conta permanentemente',
        body: '<p style="font-size:14px;color:var(--mid);line-height:1.6;margin-bottom:14px">Esta ação é <strong style="color:#ef4444">irreversível</strong>. Todos os teus dados, favoritos e histórico serão permanentemente eliminados.</p><div class="modal-form-group"><label class="modal-label" style="font-size:11px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px;display:block">Escreve <strong>ELIMINAR</strong> para confirmar</label><input class="form-input no-icon" id="deleteConfirm" placeholder="ELIMINAR" style="border-color:#fecaca"></div>'
    }
};

function openDangerModal(type) {
    dangerType = type;
    const d = dangerContent[type];
    document.getElementById('dangerTitle').textContent = d.title;
    document.getElementById('dangerBody').innerHTML = d.body;
    document.getElementById('dangerModal').classList.add('show');
}
window.openDangerModal = openDangerModal;

function closeDanger() {
    document.getElementById('dangerModal').classList.remove('show');
}
window.closeDanger = closeDanger;

function closeDangerOutside(e) {
    if (e.target === document.getElementById('dangerModal')) closeDanger();
}
window.closeDangerOutside = closeDangerOutside;

function confirmDanger() {
    if (dangerType === 'delete') {
        const v = document.getElementById('deleteConfirm')?.value || '';
        if (v !== 'ELIMINAR') {
            showToast('Escreve ELIMINAR para confirmar.');
            return;
        }
    }
    closeDanger();
    const msgs = {
        suspend: 'Conta suspensa. Podes reativá-la a qualquer momento.',
        delete: 'Conta eliminada. Até à próxima!'
    };
    showToast(msgs[dangerType]);
}
window.confirmDanger = confirmDanger;

// ============================================================
// 14. AVATAR MODAL
// ============================================================
let pendingColor = null;
let pendingImageUrl = null;
let savedAvatarState = null;

function openAvatarModal() {
    const avatarBig = document.getElementById('avatarBig');
    savedAvatarState = {
        innerHTML: avatarBig.innerHTML,
        background: avatarBig.style.background,
        backgroundImage: avatarBig.style.backgroundImage,
        textContent: avatarBig.textContent,
        padding: avatarBig.style.padding
    };

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
window.openAvatarModal = openAvatarModal;

function closeAvatar() {
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
window.closeAvatar = closeAvatar;

function closeAvatarOutside(e) {
    if (e.target === document.getElementById('avatarModal')) closeAvatar();
}
window.closeAvatarOutside = closeAvatarOutside;

function setAvatarColor(color) {
    pendingColor = color;
    pendingImageUrl = null;

    document.getElementById('avatarFileInput').value = '';
    document.getElementById('avatarFileName').textContent = '';

    const preview = document.getElementById('modalAvatarPreview');
    preview.innerHTML = '';
    preview.style.backgroundImage = 'none';
    preview.style.background = color;

    // ← USAR AS INICIAIS DO PERFIL CARREGADO, NÃO SÓ DOS CAMPOS DO FORMULÁRIO
    const fn = document.getElementById('firstName')?.value || userProfile?.first_name || '';
    const ln = document.getElementById('lastName')?.value || userProfile?.last_name || '';
    const initials = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || getInitials(userProfile?.full_name || 'U');
    preview.textContent = initials;

    document.querySelectorAll('.color-swatch').forEach(s => {
        s.style.outline = s.style.background === color ? '2px solid var(--dark)' : 'none';
        s.style.outlineOffset = '2px';
    });
}
window.setAvatarColor = setAvatarColor;

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
window.previewAvatarFile = previewAvatarFile;

async function saveAvatar() {
    const avatarBig = document.getElementById('avatarBig');

    if (pendingImageUrl) {
        avatarBig.textContent = '';
        avatarBig.innerHTML = `<img src="${pendingImageUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
        avatarBig.style.background = 'none';
        avatarBig.style.padding = '0';

        // Atualizar no Supabase (se tiver bucket configurado)
        // Nota: Para upload real, precisas de configurar o Storage do Supabase
        // Por enquanto, guardamos a URL base64 no perfil
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: pendingImageUrl })
                .eq('id', currentUser.id);

            if (error) throw error;
            showToast('Foto de perfil atualizada!');
        } catch (error) {
            console.error('Erro ao salvar avatar:', error);
            showToast('Erro ao salvar foto. Tenta novamente.');
        }

    } else if (pendingColor) {
        avatarBig.innerHTML = '';
        avatarBig.style.backgroundImage = 'none';
        avatarBig.style.background = pendingColor;

        // ← MESMA LÓGICA: usar perfil como fallback
        const fn = document.getElementById('firstName')?.value || userProfile?.first_name || '';
        const ln = document.getElementById('lastName')?.value || userProfile?.last_name || '';
        const initials = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || getInitials(userProfile?.full_name || 'U');
        avatarBig.textContent = initials;
    }

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
}
window.saveAvatar = saveAvatar;

// ============================================================
// 15. SEGURANÇA - TOGGLE PASSWORD VISIBILITY
// ============================================================
function togglePwdVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = isPassword
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}
window.togglePwdVisibility = togglePwdVisibility;

// ============================================================
// 16. SAVE ALL
// ============================================================
async function saveAll() {
    try {
        const fn = document.getElementById('firstName').value;
        const ln = document.getElementById('lastName').value;
        const phone = document.getElementById('phone').value;
        const location = document.getElementById('location').value;
        const bio = document.getElementById('bio').value;
        const birthDate = document.getElementById('birthDate')?.value;
        const gender = document.getElementById('gender')?.value;

        const { error } = await supabase
            .from('profiles')
            .update({
                first_name: fn,
                last_name: ln,
                full_name: `${fn} ${ln}`.trim() || null,
                phone: phone || null,
                location: location || null,
                bio: bio || null,
                birth_date: birthDate || null,
                gender: gender || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);

        if (error) throw error;

        // Atualizar display name
        document.getElementById('displayName').textContent = `${fn} ${ln}`.trim() || 'Utilizador';

        showToast('Perfil guardado com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao guardar perfil:', error);
        showToast('Erro ao guardar perfil');
    }
}
window.saveAll = saveAll;

// ============================================================
// 17. UTILITÁRIOS
// ============================================================
function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================================
// 18. INICIALIZAR
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserData();
    console.log('✅ Perfil.js carregado e conectado ao Supabase!');
});