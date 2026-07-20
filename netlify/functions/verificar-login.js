// netlify/functions/verificar-login.js
import { supabase } from './supabase/supabaseClient.js'; // Ajusta o caminho relativo se necessário

export async function handler(event, context) {
    const headers = {
        'Content-Type': 'application/json',
    };

    try {
        // 1. Obter o token de acesso (JWT) enviado pelo frontend.
        // O Supabase costuma enviar isto no cabeçalho Authorization (Bearer token) ou através de cookies.
        const authHeader = event.headers.authorization || event.headers.Authorization;
        let token = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else {
            // Alternativa: Tentar obter o token a partir dos cookies de sessão enviados pelo browser
            token = obterTokenDosCookies(event.headers.cookie);
        }

        if (!token) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ user: null })
            };
        }

        // 2. Verificar a validade do token no Supabase Auth para obter o utilizador ativo
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !authUser) {
            console.warn('Token inválido ou expirado:', authError?.message);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ user: null })
            };
        }

        // 3. Buscar os dados complementares do Perfil na tabela pública do PostgreSQL
        const { data: perfil, error: perfilError } = await supabase
            .from('Perfil') // Nome exato da tua tabela no banco de dados
            .select('id, admin, primeiro_nome, ultimo_nome, avatar_url, avatar_cor')
            .eq('id', authUser.id)
            .single();

        if (perfilError || !perfil) {
            console.error('Erro ao procurar o perfil na tabela Perfil:', perfilError?.message);
            // Se o perfil não existir na tabela "Perfil", retornamos apenas os dados básicos que o auth tem
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    user: {
                        id: authUser.id,
                        admin: false,
                        nome_completo: authUser.user_metadata?.display_name || 'Utilizador',
                        avatar_url: null,
                        avatar_cor: null
                    }
                })
            };
        }

        // Montar o nome completo esperado pelo teu header.js
        const nomeCompleto = `${perfil.primeiro_nome || ''} ${perfil.ultimo_nome || ''}`.trim();

        // 4. Retornar os dados formatados para o header.js
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                user: {
                    id: perfil.id,
                    admin: perfil.admin,
                    nome_completo: nomeCompleto || 'Utilizador',
                    avatar_url: perfil.avatar_url,
                    avatar_cor: perfil.avatar_cor
                }
            })
        };

    } catch (error) {
        console.error('Erro crítico na função verificar-login:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: 'Erro interno ao processar a sessão.' })
        };
    }
}

// Função utilitária para extrair cookies
function obterTokenDosCookies(cookieHeader) {
    if (!cookieHeader) return null;

    const cookies = Object.fromEntries(
        cookieHeader.split(';').map(cookie => {
            const [key, ...val] = cookie.trim().split('=');
            return [key, val.join('=')];
        })
    );

    return cookies['sb-access-token'] || cookies['access_token'] || null;
}