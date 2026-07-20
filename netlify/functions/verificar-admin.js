import { supabase } from './supabase/supabaseClient.js';

export async function verificarAdmin(event) {
    try {
        const headers = event.headers || {};
        const cookieHeader = headers.cookie || headers.Cookie || '';
        
        const token = cookieHeader
            .split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('sb-access-token='))
            ?.split('=')[1];

        if (!token) {
            return { eAdmin: false, userId: null, token: null, erro: 'Não autenticado.' };
        }

        // 1. Valida se o token JWT é válido e obtém o utilizador básico da Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return { eAdmin: false, userId: null, token: null, erro: 'Sessão expirada.' };
        }

        // 2. CORREÇÃO: Consulta a tabela Perfil na base de dados para validar a coluna admin
        // NOTA: Ajusta para 'Perfil' (com P maiúsculo) se for o caso no teu banco de dados
        const { data: perfil, error: perfilError } = await supabase
            .from('Perfil') 
            .select('admin')
            .eq('id', user.id)
            .single();

        // Se der erro, se o perfil não existir ou se a coluna admin for false -> Acesso Negado
        if (perfilError || !perfil || perfil.admin !== true) {
            return { eAdmin: false, userId: user.id, token: token, erro: 'Acesso negado. Não possui privilégios de administrador.' };
        }

        // Se passou em todas as verificações, o utilizador está logado E é um admin real
        return { eAdmin: true, userId: user.id, token: token, erro: null };

    } catch (err) {
        console.error(err);
        return { eAdmin: false, userId: null, token: null, erro: 'Erro interno no servidor.' };
    }
}