import { supabase } from './supabaseClient.js';

// Função auxiliar para extrair o valor de um cookie específico por nome
function obterCookie(cookieString, nome) {
    if (!cookieString) return null;
    const cookies = cookieString.split(';');
    for (let cookie of cookies) {
        const [chave, valor] = cookie.trim().split('=');
        if (chave === nome) {
            return valor;
        }
    }
    return null;
}

export const handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Método não permitido. Use GET.' })
        };
    }

    try {
        // EXTRAÇÃO VIA COOKIE: Em vez de buscar no event.headers.authorization
        const cookieHeader = event.headers.cookie || event.headers.Cookie;
        const token = obterCookie(cookieHeader, 'sb-access-token');

        // Se o token não existir no cookie, consideramos visitante anónimo
        if (!token) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: null, mensagem: 'Visitante anónimo' })
            };
        }

        const { data: { user }, error: erroSupabase } = await supabase.auth.getUser(token);

        if (erroSupabase || !user) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: null, mensagem: 'Sessão expirada' })
            };
        }

        const { data: perfil } = await supabase
            .from('Perfil')
            .select('admin, primeiro_nome, ultimo_nome')
            .eq('id', user.id) 
            .single();

        let nomeCompleto = null;
        if (perfil && (perfil.primeiro_nome || perfil.ultimo_nome)) {
            nomeCompleto = [perfil.primeiro_nome, perfil.ultimo_nome].filter(Boolean).join(' ');
        }

        const dadosDoUtilizador = {
            id: user.id,
            email: user.email,
            user_metadata: {
                display_name: user.user_metadata?.display_name || 'Utilizador'
            },
            nome_completo: nomeCompleto, 
            admin: perfil?.admin === true 
        };

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: dadosDoUtilizador })
        };

    } catch (erroCritico) {
        console.error(' Erro interno no back-end verificarsessao:', erroCritico.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Erro interno no servidor.' })
        };
    }
};