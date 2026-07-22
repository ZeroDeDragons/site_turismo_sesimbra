import { ChamarServidor } from '../../serviços/api.js';

// Função para extrair os dados diretamente do DOM
function obterDadosFormulario() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    return {
        email: emailInput ? emailInput.value.trim() : '',
        password: passwordInput ? passwordInput.value : ''
    };
}

// Função para salvar a sessão localmente (Essencial para o funcionamente do verificarSessao)
function guardarSessaoLocal(dadosAutenticacao) {
    if (dadosAutenticacao && dadosAutenticacao.session) {
        localStorage.setItem('access_token', dadosAutenticacao.session.access_token);
        localStorage.setItem('user_info', JSON.stringify(dadosAutenticacao.user));
    }
}

// Função de execução que encapsula a lógica de envio
async function executarProcessoLogin(botaoSubmit) {
    const { email, password } = obterDadosFormulario();

    if (!email || !password) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    // Feedback visual (Desativa o botão para evitar cliques duplicados e sobrecarga)
    botaoSubmit.disabled = true;
    const textoOriginal = botaoSubmit.innerHTML;
    botaoSubmit.innerText = 'A entrar...';

    try {
        // Invoca a Netlify Function criada acima usando a sua estrutura padrão
        const resultado = await ChamarServidor('efetuarlogin', {
            method: 'POST',
            body: { email, password }
        });

        // Se correu bem, guarda os tokens e redireciona
        guardarSessaoLocal(resultado);
        console.log('✅ Login efetuado com sucesso!');
        
        // Altere para a página interna da sua plataforma turística
        window.location.href = '/index.html'; 

    } catch (erro) {
        alert(erro.message || 'Falha ao autenticar. Verifique os seus dados.');
    } finally {
        // Restaura o estado do botão
        botaoSubmit.disabled = false;
        botaoSubmit.innerHTML = textoOriginal;
    }
}

// Inicialização dos Event Listeners assim que o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    const botaoEntrar = document.querySelector('.btn--primary');
    
    if (botaoEntrar) {
        botaoEntrar.addEventListener('click', (e) => {
            e.preventDefault();
            executarProcessoLogin(botaoEntrar);
        });
    }
});


// Mostra/oculta password
document.querySelectorAll('.field__toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
    var input = document.getElementById(btn.dataset.toggle);
    var isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.querySelector('.icon-eye-off').style.display = isHidden ? 'none' : 'block';
    btn.querySelector('.icon-eye').style.display = isHidden ? 'block' : 'none';
    });
});


/* ═══════════════════════════════════════════════════
   GOOGLE TRANSLATE
═══════════════════════════════════════════════════ */
(function () {
var LANG_KEY = 'siteLang';

function setLangCookie(lang) {
    var value = '/pt/' + lang;
    document.cookie = 'googtrans=' + value + ';path=/';
    document.cookie = 'googtrans=' + value + ';path=/;domain=' + window.location.hostname;
}

function currentLang() {
    return localStorage.getItem(LANG_KEY) || 'pt';
}

function applyLang(lang, reload) {
    localStorage.setItem(LANG_KEY, lang);
    document.getElementById('langLabel').textContent = lang.toUpperCase();
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

document.addEventListener('DOMContentLoaded', function () {
    applyLang(currentLang(), false);

    var wrap = document.querySelector('.lang-switch');
    var btn = document.getElementById('langBtn');

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
});
})();
// Impede o Google de voltar a empurrar a página para baixo
new MutationObserver(function () {
document.body.style.top = '0px';
}).observe(document.body, { attributes: true, attributeFilter: ['style'] });