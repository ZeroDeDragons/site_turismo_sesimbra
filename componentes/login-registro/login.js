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
        window.location.href = '/dashboard.html'; 

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