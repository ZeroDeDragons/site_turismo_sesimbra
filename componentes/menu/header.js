import { ChamarServidor } from '../../serviços/api.js';
import './header.css';
let perfilUtilizador = null;

export async function inicializarHeader() {
    const container = document.getElementById('header-container');

    try {
        await verificarSessaoNoServidor();
        const tempDiv = await baixarTemplateHeader();

        preencherDadosNoTemplate(tempDiv);

        container.innerHTML = tempDiv.innerHTML;
        configurarEventosHeaderGlobais();

    } catch (error) {
        console.error('Erro crítico ao montar o cabeçalho:', error);
        container.innerHTML = `<div style="padding:15px; color:red; text-align:center;">Erro ao carregar o menu.</div>`;
    }
}

async function verificarSessaoNoServidor() {
    try {
        const userData = await ChamarServidor('verificar-login', { method: 'GET' });
        console.log('Dados do usuário recebidos do servidor:', userData);
        if (userData && userData.user) {
            perfilUtilizador = userData.user;
        } else {
            perfilUtilizador = null;
        }
    } catch (erro) {
        console.warn('Utilizador não autenticado ou falha na sessão:', erro.message);
        perfilUtilizador = null;
    }
}

async function baixarTemplateHeader() {
    const response = await fetch('/componentes/menu/header.html');
    if (!response.ok) throw new Error('Falha ao baixar componentes/menu/header.html');
    const htmlBruto = await response.text();

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlBruto;
    return tempDiv;
}

function preencherDadosNoTemplate(tempDiv) {
    const userHeaderName = tempDiv.querySelector('.user-header-name');
    const adminBtn = tempDiv.querySelector('#botao_admin');

    if (perfilUtilizador) {
        const nome = perfilUtilizador.nome_completo ||
            perfilUtilizador.user_metadata?.display_name ||
            'Utilizador';

        if (userHeaderName) userHeaderName.textContent = nome;
        if (adminBtn) adminBtn.style.display = perfilUtilizador.admin === true ? 'flex' : 'none';
    } else {
        if (userHeaderName) userHeaderName.textContent = 'Visitante';
        if (adminBtn) adminBtn.style.display = 'none';
    }
}

function configurarEventosHeaderGlobais() {
    document.removeEventListener('click', gerirCliquesHeader);
    document.addEventListener('click', gerirCliquesHeader);

    // Google Translate: inicializa só agora, porque só agora o header
    // (com #langBtn, #langMenu, etc.) está de facto no DOM.
    inicializarSeletorIdioma();

    document.body.onmouseover = (e) => {
        const navItem = e.target.closest('.user-nav-item');
        if (navItem && perfilUtilizador) {
            abrirDropdown(navItem);
        }
    };

    document.body.onmouseout = (e) => {
        const navItem = e.target.closest('.user-nav-item');
        if (navItem && perfilUtilizador && !navItem.contains(e.relatedTarget)) {
            fecharDropdown(navItem);
        }
    };
}

function abrirDropdown(navItem) {
    navItem.querySelector('#botao_usuario')?.classList.add('active');
    navItem.querySelector('#userHeaderDropdown')?.classList.add('show');
}

function fecharDropdown(navItem) {
    navItem.querySelector('#botao_usuario')?.classList.remove('active');
    navItem.querySelector('#userHeaderDropdown')?.classList.remove('show');
}

async function gerirCliquesHeader(e) {
    const userBtn = e.target.closest('#botao_usuario');
    const inicioBtn = e.target.closest('#botao_inicio');
    const patrimonioBtn = e.target.closest('#botao_patrimonio');
    const profileBtn = e.target.closest('#botao_perfil');
    const adminBtn = e.target.closest('#botao_admin');
    const logoutBtn = e.target.closest('#botao_login'); // o botão "Sair" usa este id no HTML
    const userDropdown = document.getElementById('userHeaderDropdown');
    if (userBtn) {
        e.preventDefault();
        e.stopPropagation();

        if (!perfilUtilizador) {
            window.location.href = '/login.html';
        } else {
            userBtn.classList.toggle('active');
            userDropdown?.classList.toggle('show');
        }
        return;
    }

    if (inicioBtn) {
        window.location.href = '/index.html';
        return;
    }

    if (patrimonioBtn) {
        window.location.href = '/patrimonio.html';
        return;
    }

    if (profileBtn) {
        window.location.href = '/perfil.html';
        return;
    }

    if (adminBtn) {
        window.location.href = '/paginaAdmin.html';
        return;
    }

    if (logoutBtn) {
        e.preventDefault();
        await efetuarLogout();
        return;
    }

    if (userDropdown && !userDropdown.contains(e.target)) {
        document.getElementById('botao_usuario')?.classList.remove('active');
        userDropdown.classList.remove('show');
    }
}

async function efetuarLogout() {
    try {
        // O próprio servidor vai expirar o cookie HttpOnly ao receber esta chamada POST
        await ChamarServidor('logout', { method: 'POST' });
        perfilUtilizador = null;

        // REMOVIDO: localStorage.removeItem('access_token'); (Não é mais necessário!)
        localStorage.removeItem('user_info');

        window.location.reload();
    } catch (error) {
        alert('Erro ao efetuar logout: ' + error.message);
    }
}

/* ═══════════════════════════════════════════════════
   GOOGLE TRANSLATE
═══════════════════════════════════════════════════ */
const LANG_KEY = 'siteLang';
let googleScriptCarregado = false;

function carregarScriptGoogleTranslate() {
    if (googleScriptCarregado) return;
    googleScriptCarregado = true;

    window.googleTranslateElementInit = function () {
        new google.translate.TranslateElement(
            {
                pageLanguage: 'pt',
                includedLanguages: 'pt,en,es,fr,de,it,zh-CN,ja,ko,th,ru,sv,tr,no,pl,fi,uk',
                layout: google.translate.TranslateElement.InlineLayout.SIMPLE
            },
            'google_translate_element'
        );
    };

    const script = document.createElement('script');
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);
}

function setLangCookie(lang) {
    const value = '/pt/' + lang;
    document.cookie = 'googtrans=' + value + ';path=/';
    document.cookie = 'googtrans=' + value + ';path=/;domain=' + window.location.hostname;
}

function currentLang() {
    return localStorage.getItem(LANG_KEY) || 'pt';
}

function applyLang(lang, reload) {
    localStorage.setItem(LANG_KEY, lang);
    const label = document.getElementById('langLabel');
    if (label) label.textContent = lang.toUpperCase();
    document.querySelectorAll('.lang-switch__item').forEach(function (item) {
        item.classList.toggle('is-active', item.dataset.lang === lang);
    });
    if (lang === 'pt') {
        document.cookie = 'googtrans=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT';
    } else {
        setLangCookie(lang);
    }
    if (reload) window.location.reload();
}

function inicializarSeletorIdioma() {
    carregarScriptGoogleTranslate();
    applyLang(currentLang(), false);

    const wrap = document.querySelector('.lang-switch');
    const btn = document.getElementById('langBtn');
    if (!wrap || !btn) return;

    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        wrap.classList.toggle('is-open');
    });

    document.addEventListener('click', function () {
        wrap.classList.remove('is-open');
    });

    document.querySelectorAll('.lang-switch__item').forEach(function (item) {
        item.addEventListener('click', function () {
            applyLang(item.dataset.lang, true);
        });
    });

    // Impede o Google de voltar a empurrar a página para baixo
    new MutationObserver(function () {
        document.body.style.top = '0px';
    }).observe(document.body, { attributes: true, attributeFilter: ['style'] });
}