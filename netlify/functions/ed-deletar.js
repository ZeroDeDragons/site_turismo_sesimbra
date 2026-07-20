import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export async function handler(event, context) {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método Não Permitido' };

    try {
        // 1. Extrai o token diretamente do cookie da requisição
        const headers = event.headers || {};
        const cookieHeader = headers.cookie || headers.Cookie || '';
        const token = cookieHeader
            .split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('sb-access-token='))
            ?.split('=')[1];

        if (!token) {
            return { statusCode: 401, body: JSON.stringify({ erro: 'Não autenticado.' }) };
        }

        // 2. Cria o cliente scoped passando o token do utilizador para ativar a RLS
        const supabaseScoped = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false },
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        const { entidade, id } = JSON.parse(event.body || '{}');

        if (!entidade || !id) {
            return { statusCode: 400, body: 'Parâmetros "entidade" e "id" são obrigatórios.' };
        }

        // 3. O RLS do banco intercepta a deleção e valida através do public.is_admin()
        const { error } = await supabaseScoped.from(entidade).delete().eq('id', id);
        if (error) throw error;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ sucesso: true, id })
        };

    } catch (error) {
        console.error('Erro em ed-deletar:', error);
        return { 
            statusCode: error.code === '42501' ? 403 : 500, 
            body: JSON.stringify({ erro: error.message }) 
        };
    }
}