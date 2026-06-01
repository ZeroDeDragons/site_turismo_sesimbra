import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuração do Supabase (SUBSTITUA PELAS SUAS CREDENCIAIS)
const SUPABASE_URL = 'https://seusupabaseurl.supabase.co';  // ← Coloque sua URL
const SUPABASE_ANON_KEY = 'sua-chave-anon-aqui';  // ← Coloque sua chave anônima

// Inicializa o Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos do DOM
const togglePwd = document.getElementById('togglePwd');
const pwdInput = document.getElementById('password');
const eyeIcon = document.getElementById('eyeIcon');
const loginBtn = document.getElementById('loginBtn');
const emailInput = document.getElementById('email');
const errorMsg = document.getElementById('errorMsg');
const rememberCheckbox = document.getElementById('remember');
const guestBtn = document.querySelector('.btn-guest');
const registerLink = document.querySelector('.panel-sub a');

// Ícones do olho (aberto/fechado)
const eyeOpenSVG = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
const eyeClosedSVG = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;

// Mostrar/esconder senha
if (togglePwd) {
    togglePwd.addEventListener('click', () => {
        const show = pwdInput.type === 'password';
        pwdInput.type = show ? 'text' : 'password';
        eyeIcon.innerHTML = show ? eyeClosedSVG : eyeOpenSVG;
    });
}

// Função para mostrar erro
function showError(message) {
    errorMsg.style.display = 'flex';
    errorMsg.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        ${message}
    `;
    
    // Esconde o erro após 5 segundos
    setTimeout(() => {
        errorMsg.style.display = 'none';
    }, 5000);
}

// Função para esconder erro
function hideError() {
    errorMsg.style.display = 'none';
}

// Função para salvar sessão (se "Lembrar-me" estiver marcado)
function salvarSessao(email) {
    if (rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem('savedEmail', email);
        localStorage.setItem('rememberMe', 'true');
    } else {
        localStorage.removeItem('savedEmail');
        localStorage.setItem('rememberMe', 'false');
    }
}

// Função para carregar email salvo
function carregarEmailSalvo() {
    const savedEmail = localStorage.getItem('savedEmail');
    const rememberMe = localStorage.getItem('rememberMe');
    
    if (rememberMe === 'true' && savedEmail && emailInput) {
        emailInput.value = savedEmail;
        if (rememberCheckbox) rememberCheckbox.checked = true;
    }
}

// Carregar email salvo ao iniciar
carregarEmailSalvo();

// Função de login
async function fazerLogin(email, password) {
    try {
        // Tenta fazer login com email e senha
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        // Login bem sucedido!
        console.log('Login realizado com sucesso!', data.user);
        
        // Salvar sessão se "Lembrar-me" estiver marcado
        salvarSessao(email);
        
        // Redirecionar para a página principal
        window.location.href = '/index.html';
        
        return { success: true, user: data.user };
        
    } catch (error) {
        console.error('Erro no login:', error.message);
        
        // Mensagens de erro personalizadas
        if (error.message.includes('Invalid login credentials')) {
            throw new Error('Email ou palavra-passe incorretos');
        } else if (error.message.includes('Email not confirmed')) {
            throw new Error('Por favor, confirme o seu email antes de entrar');
        } else {
            throw new Error(error.message);
        }
    }
}

// Evento de clique no botão de login
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const email = emailInput ? emailInput.value.trim() : '';
        const password = pwdInput ? pwdInput.value : '';
        
        // Validar campos
        if (!email || !password) {
            showError('Preencha todos os campos');
            return;
        }
        
        // Validar formato do email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showError('Por favor, insira um email válido');
            return;
        }
        
        // Mostrar loading
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
            // Tentar fazer login
            await fazerLogin(email, password);
            
        } catch (error) {
            // Mostrar erro
            showError(error.message);
            
            // Restaurar botão
            loginBtn.innerHTML = originalBtnHTML;
            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;
        }
    });
}

// Permitir login com Enter
if (emailInput && pwdInput) {
    const handleEnter = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            loginBtn.click();
        }
    };
    
    emailInput.addEventListener('keypress', handleEnter);
    pwdInput.addEventListener('keypress', handleEnter);
}

// Botão "Continuar como visitante"
if (guestBtn) {
    guestBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Redireciona para a página principal sem fazer login
        window.location.href = '/index.html';
    });
}

// Link de registro
if (registerLink) {
    registerLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Aqui você pode redirecionar para uma página de registro ou abrir um modal
        alert('Funcionalidade de registro em breve!');
        // window.location.href = '/register.html';
    });
}

// Link "Esqueci a palavra-passe"
const forgotLink = document.querySelector('.forgot-link');
if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        const email = emailInput ? emailInput.value.trim() : '';
        
        if (!email) {
            showError('Digite seu email para recuperar a palavra-passe');
            return;
        }
        
        // TODO: Implementar recuperação de senha
        alert(`Um link de recuperação será enviado para ${email}`);
    });
}

// Estilo para animação de loading
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

console.log('Sistema de login inicializado com Supabase');
