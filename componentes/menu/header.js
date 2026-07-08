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
        const userData = await ChamarServidor('verificarsessao', { method: 'GET' });
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