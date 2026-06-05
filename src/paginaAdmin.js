// ============================================================
//  PÁGINA DE ADMIN - VERSÃO DE DIAGNÓSTICO
// ============================================================

// 1. Logo à entrada para garantir que o ficheiro está a ser lido
console.log('🟢 paginaAdmin.js carregado com sucesso!');

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Verificar se as variáveis do Supabase existem (erro muito comum no Vite)
console.log('🔗 SUPABASE_URL:', SUPABASE_URL ? 'Existe' : '❌ FALTA / INDEFINIDA');
console.log('🔑 SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Existe' : '❌ FALTA / INDEFINIDA');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('⚠️ As variáveis de ambiente não estão a ser lidas! O Vite precisa que reinicies o servidor (npm run dev) após alterar o .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let todosUtilizadores = [];
let modalTipo = null;
let editandoId = null;

// ============================================================
//  1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('⚡ DOMContentLoaded disparou!');

  await verificarSessaoAdmin();

  // O resto só corre se a sessão for válida
  await carregarUtilizadores();
  await carregarRotas();
  await carregarPostos();
  await atualizarEstatisticasDashboard();

  const btnSair = document.querySelector('.btn-icon[title="Sair"]');
  if (btnSair) {
    btnSair.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = '/login.html';
    });
  }
});


// ============================================================
//  2. SEGURANÇA — VERSÃO DE DIAGNÓSTICO (SEM REDIRECIONAMENTOS)
// ============================================================
async function verificarSessaoAdmin() {
  console.log('👀 A verificar sessão de admin...');
  
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('❌ Erro ao buscar sessão:', sessionError);
  }

  if (!session) {
    console.warn('⚠️ Não há sessão. Deveria ir para /login.html.');
    // window.location.href = '/login.html'; // <--- COMENTADO PARA NÃO FUGIR
    return;
  }

  console.log('✅ Sessão encontrada. User ID:', session.user.id);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', session.user.id)
    .single();

  console.log('📄 Resultado da query Profile:', { profile, error });

  if (error) {
    console.error('❌ Erro ao buscar perfil:', error.message);
    console.error('❌ Código do erro:', error.code);
    // window.location.href = '/index.html'; // <--- COMENTADO PARA NÃO FUGIR
    return;
  }

  if (!profile) {
    console.error('❌ Profile veio vazio/nulo (RLS está a bloquear?)');
    // window.location.href = '/index.html'; // <--- COMENTADO PARA NÃO FUGIR
    return;
  }

  console.log('🎭 Role do utilizador:', profile.role);

  if (profile.role !== 'admin') {
    console.warn(`⚠️ Role é "${profile.role}", não é "admin". Deveria ir para /index.html.`);
    // window.location.href = '/index.html'; // <--- COMENTADO PARA NÃO FUGIR
    return;
  }

  console.log('🎉 É ADMIN! Tudo certo, pode ficar na página.');

  // Atualizar o nome do admin na sidebar
  const nomeEl = document.querySelector('.user-name');
  const iniciais = document.querySelector('.user-avatar');
  if (nomeEl && profile.full_name) {
    nomeEl.textContent = profile.full_name;
    const partes = profile.full_name.split(' ');
    if (iniciais) {
      iniciais.textContent = (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
    }
  }
}
