// --- CONFIGURAÇÃO E AUTENTICAÇÃO DO USUÁRIO (SUPABASE) ---

// Elementos do DOM
const userBtn = document.getElementById('userHeaderBtn');
const userDropdown = document.getElementById('userHeaderDropdown');
const userHeaderName = document.querySelector('.user-header-name');
const profileBtn = document.getElementById('profileBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Função para criar modal de login
function criarModalLogin() {
    // Remove modal existente se houver
    const modalExistente = document.getElementById('supabaseLoginModal');
    if (modalExistente) modalExistente.remove();
    
    const modal = document.createElement('div');
    modal.id = 'supabaseLoginModal';
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 10000;">
            <div style="background: white; padding: 30px; border-radius: 12px; width: 350px; max-width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <h3 style="margin-bottom: 20px; text-align: center;">Acesso à Área de Utilizador</h3>
                <div style="margin-bottom: 15px;">
                    <input type="email" id="modalEmail" placeholder="Email" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                </div>
                <div style="margin-bottom: 20px;">
                    <input type="password" id="modalPassword" placeholder="Palavra-passe" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                </div>
                <button id="modalLoginBtn" style="width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; margin-bottom: 10px;">Entrar</button>
                <button id="modalCloseBtn" style="width: 100%; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer;">Fechar</button>
                <hr style="margin: 20px 0 10px;">
                <p style="text-align: center; font-size: 12px; color: #666;">Não tem conta? <a href="#" id="showRegisterLink" style="color: #007bff;">Registar</a></p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Login
    document.getElementById('modalLoginBtn').onclick = async () => {
        const email = document.getElementById('modalEmail').value;
        const password = document.getElementById('modalPassword').value;
        
        if (!email || !password) {
            alert('Por favor, preencha email e palavra-passe');
            return;
        }
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email, password
        });
        
        if (error) {
            alert('Erro ao entrar: ' + error.message);
        } else {
            modal.remove();
            location.reload();
        }
    };
    
    // Fechar
    document.getElementById('modalCloseBtn').onclick = () => modal.remove();
    
    // Mostrar registro
    document.getElementById('showRegisterLink').onclick = (e) => {
        e.preventDefault();
        mostrarModalRegistro();
        modal.remove();
    };
}

// Função para criar modal de registro
function mostrarModalRegistro() {
    const modalExistente = document.getElementById('supabaseRegistroModal');
    if (modalExistente) modalExistente.remove();
    
    const modal = document.createElement('div');
    modal.id = 'supabaseRegistroModal';
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 10000;">
            <div style="background: white; padding: 30px; border-radius: 12px; width: 350px; max-width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <h3 style="margin-bottom: 20px; text-align: center;">Criar Conta</h3>
                <div style="margin-bottom: 15px;">
                    <input type="text" id="regNome" placeholder="Nome completo" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="email" id="regEmail" placeholder="Email" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                </div>
                <div style="margin-bottom: 20px;">
                    <input type="password" id="regPassword" placeholder="Palavra-passe" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                </div>
                <button id="modalRegisterBtn" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; margin-bottom: 10px;">Registar</button>
                <button id="modalCloseRegBtn" style="width: 100%; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Voltar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('modalRegisterBtn').onclick = async () => {
        const nome = document.getElementById('regNome').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        
        if (!email || !password) {
            alert('Por favor, preencha email e palavra-passe');
            return;
        }
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: nome || email.split('@')[0]
                }
            }
        });
        
        if (error) {
            alert('Erro ao registar: ' + error.message);
        } else {
            alert('Registo realizado com sucesso! Verifique seu email para confirmar.');
            modal.remove();
            // Tenta fazer login automático
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email, password
            });
            if (!signInError) location.reload();
        }
    };
    
    document.getElementById('modalCloseRegBtn').onclick = () => modal.remove();
}

// Função para verificar o status do login
async function gerenciarEstadoUsuario() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            if (userHeaderName) userHeaderName.textContent = 'Visitante';
            return null;
        }

        const nomeUsuario = user.user_metadata?.full_name || user.email.split('@')[0];
        if (userHeaderName) userHeaderName.textContent = nomeUsuario;
        
        return user;
    } catch (err) {
        console.error("Erro ao verificar autenticação:", err);
        if (userHeaderName) userHeaderName.textContent = 'Visitante';
        return null;
    }
}

// Executar verificação
gerenciarEstadoUsuario();

// Configuração do clique no botão
if (userBtn) {
    userBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const usuarioLogado = await gerenciarEstadoUsuario();

        if (!usuarioLogado) {
            // Mostra modal de login em vez de redirecionar
            criarModalLogin();
        } else {
            userBtn.classList.toggle('active');
            userDropdown.classList.toggle('show');
        }
    });
}

// Fecha o dropdown
document.addEventListener('click', (e) => {
    if (userBtn && userDropdown && !userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userBtn.classList.remove('active');
        userDropdown.classList.remove('show');
    }
});

// Perfil
if (profileBtn) {
    profileBtn.addEventListener('click', () => {
        alert("Área do utilizador - Em desenvolvimento");
    });
}

// Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            alert('Erro ao sair: ' + error.message);
        } else {
            alert('Sessão encerrada!');
            window.location.reload();
        }
    });
}
