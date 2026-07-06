import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Valida o token JWT e verifica se o utilizador tem permissões de administrador.
 * @param {Object} event - O objeto event da Netlify Function.
 * @returns {Promise<{userId: string|null, errorResponse: Object|null}>}
 */
export async function verificarAdmin(event) {
  // 1. Extrair o token do Header Authorization
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      userId: null,
      errorResponse: { statusCode: 401, body: JSON.stringify({ message: 'Não autorizado. Token em falta.' }) }
    };
  }

  const token = authHeader.split(' ')[1];

  try {
    // 2. Validar o token diretamente no Supabase Auth
    const { data: { user }, error: erroAuth } = await supabaseAdmin.auth.getUser(token);

    if (erroAuth || !user) {
      return {
        userId: null,
        errorResponse: { statusCode: 401, body: JSON.stringify({ message: 'Sessão inválida ou expirada.' }) }
      };
    }

    const userId = user.id;

    // 3. Verificar o status de administrador na tabela Perfil
    const { data: perfil, error: erroPerfil } = await supabaseAdmin
      .from('Perfil')
      .select('admin')
      .eq('id', userId)
      .single();

    if (erroPerfil || !perfil || !perfil.admin) {
      return {
        userId: null,
        errorResponse: { statusCode: 403, body: JSON.stringify({ message: 'Acesso negado. Apenas administradores.' }) }
      };
    }

    // Sucesso absoluto: Retorna o userId para ser usado na criação dos registos
    return { userId, errorResponse: null };

  } catch (err) {
    console.error('Erro crítico no middleware de autenticação:', err.message);
    return {
      userId: null,
      errorResponse: { statusCode: 500, body: JSON.stringify({ message: 'Erro interno na validação de acessos.' }) }
    };
  }
}