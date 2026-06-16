import { API_URL } from './config/api.js';
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DEBUG LOGIN ===');
    console.log('1. DOM carregado');

    // Elementos do DOM
    const loginBtn = document.getElementById('loginBtn');
    const togglePwd = document.getElementById('togglePwd');
    const pwdInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');
    const emailInput = document.getElementById('email');
    const errorMsg = document.getElementById('errorMsg');
    const rememberCheckbox = document.getElementById('remember');
    const guestBtn = document.querySelector('.btn-guest');
    const registerLink = document.querySelector('.panel-sub a');

    console.log('2. Botão login encontrado?', !!loginBtn);
    console.log('3. Supabase importado?', !!supabase);

    const eyeOpenSVG = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    const eyeClosedSVG = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;

    if (togglePwd && pwdInput && eyeIcon) {
        togglePwd.addEventListener('click', () => {
            const show = pwdInput.type === 'password';
            pwdInput.type = show ? 'text' : 'password';
            eyeIcon.innerHTML = show ? eyeClosedSVG : eyeOpenSVG;
        });
    }

    function showError(message) {
        if (errorMsg) {
            errorMsg.style.display = 'flex';
            errorMsg.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                ${message}
            `;

            setTimeout(() => {
                errorMsg.style.display = 'none';
            }, 5000);
        }
    }

    function hideError() {
        if (errorMsg) {
            errorMsg.style.display = 'none';
        }
    }

    function salvarSessao(email) {
        if (rememberCheckbox && rememberCheckbox.checked) {
            localStorage.setItem('savedEmail', email);
            localStorage.setItem('rememberMe', 'true');
        } else {
            localStorage.removeItem('savedEmail');
            localStorage.setItem('rememberMe', 'false');
        }
    }

    function carregarEmailSalvo() {
        const savedEmail = localStorage.getItem('savedEmail');
        const rememberMe = localStorage.getItem('rememberMe');

        if (rememberMe === 'true' && savedEmail && emailInput) {
            emailInput.value = savedEmail;
            if (rememberCheckbox) rememberCheckbox.checked = true;
        }
    }

    carregarEmailSalvo();

    // ── FUNÇÃO PARA VERIFICAR SE UTILIZADOR É ADMIN ──
    async function verificarRoleUtilizador(userId) {
        try {
            console.log('Verificando role do utilizador:', userId);

            // Buscar o role na tabela profiles
            const { data, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Erro ao buscar role:', error);
                // Se não encontrar na tabela profiles, assume user normal
                return 'user';
            }

            console.log('Role encontrado:', data?.role);
            return data?.role || 'user';

        } catch (error) {
            console.error('Erro ao verificar role:', error);
            return 'user';
        }
    }

    async function fazerLogin(email, password) {
        try {
            console.log('Tentando login com:', email);

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            console.log('Login bem sucedido!', data.user);

            // Salvar sessão
            salvarSessao(email);

            // Verificar se o utilizador é admin
            const role = await verificarRoleUtilizador(data.user.id);

            // Guardar role na sessão (opcional, para uso posterior)
            sessionStorage.setItem('userRole', role);
            sessionStorage.setItem('userId', data.user.id);

            console.log('Role do utilizador:', role);

            // Redirecionar baseado no role
            if (role === 'admin') {
                console.log('Redirecionando para página de admin...');
                window.location.href = '/paginaAdmin.html';
            } else {
                console.log('Redirecionando para página inicial...');
                window.location.href = '/index.html';
            }

            return { success: true, user: data.user, role: role };

        } catch (error) {
            console.error('Erro detalhado:', error);

            if (error.message.includes('Invalid login credentials')) {
                throw new Error('Email ou palavra-passe incorretos');
            } else if (error.message.includes('Email not confirmed')) {
                throw new Error('Por favor, confirme o seu email antes de entrar');
            } else {
                throw new Error(error.message);
            }
        }
    }

    if (loginBtn && emailInput && pwdInput) {
        loginBtn.addEventListener('click', async () => {
            const email = emailInput.value.trim();
            const password = pwdInput.value;

            console.log('Botão clicado - Email:', email);

            if (!email || !password) {
                showError('Preencha todos os campos');
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showError('Por favor, insira um email válido');
                return;
            }

            hideError();
            loginBtn.classList.add('loading');
            const originalBtnHTML = loginBtn.innerHTML;
            loginBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.7s linear infinite;">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                A entrar...
            `;
            loginBtn.disabled = true;

            try {
                await fazerLogin(email, password);
            } catch (error) {
                showError(error.message);
                loginBtn.innerHTML = originalBtnHTML;
                loginBtn.classList.remove('loading');
                loginBtn.disabled = false;
            }
        });
    } else {
        console.error('Elementos do login não encontrados!');
        console.log('loginBtn:', loginBtn);
        console.log('emailInput:', emailInput);
        console.log('pwdInput:', pwdInput);
    }

    if (emailInput && pwdInput && loginBtn) {
        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginBtn.click();
            }
        };

        emailInput.addEventListener('keyp   s', handleEnter);
        pwdInput.addEventListener('keypress', handleEnter);
    }

    if (guestBtn) {
        guestBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/index.html';
        });
    }

    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'registo.html';
        });
    }

    const forgotLink = document.querySelector('.forgot-link');
    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = emailInput ? emailInput.value.trim() : '';

            if (!email) {
                showError('Digite seu email para recuperar a palavra-passe');
                return;
            }

            try {
                forgotLink.style.pointerEvents = 'none';
                forgotLink.textContent = 'Enviando...';

                // ✅ USA O SUPABASE PARA ENVIAR O EMAIL
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/reset'
                });

                if (error) throw error;

                alert(`📧 Um link de recuperação foi enviado para ${email}`);

            } catch (err) {
                showError('Erro ao enviar recuperação: ' + err.message);
            } finally {
                forgotLink.style.pointerEvents = 'auto';
                forgotLink.textContent = 'Esqueci a palavra-passe';
            }
        });
    }

    // ── VERIFICAR SE JÁ ESTÁ LOGADO ──
    async function verificarSessaoExistente() {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                console.log('Sessão existente encontrada:', session.user.id);

                // Verificar role
                const role = await verificarRoleUtilizador(session.user.id);

                if (role === 'admin') {
                    console.log('Utilizador admin já logado, redirecionando...');
                    window.location.href = '/paginaAdmin.html';
                } else {
                    console.log('Utilizador normal já logado, redirecionando...');
                    window.location.href = '/index.html';
                }
            }
        } catch (error) {
            console.error('Erro ao verificar sessão:', error);
        }
    }

    // Verificar se já existe sessão ativa
    verificarSessaoExistente();

    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .btn-login.loading {
            opacity: 0.7;
            cursor: not-allowed;
        }

        .error-msg {
            display: none;
            align-items: center;
            gap: 8px;
            background: #fee;
            color: #c33;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }

        .error-msg svg {
            flex-shrink: 0;
        }
    `;
    document.head.appendChild(style);

    console.log('Sistema de login inicializado');
});
