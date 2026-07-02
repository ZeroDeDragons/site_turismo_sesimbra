const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Método não permitido. Use GET.' })
        };
    }

    try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: 'Erro de Configuração: Chaves do Supabase não encontradas.' 
                })
            };
        }

        const autorizacao = event.headers.authorization || event.headers.Authorization;

        if (!autorizacao) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: null, mensagem: 'Visitante anônimo' })
            };
        }

        const token = autorizacao.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: autorizacao } }
        });

        const { data: { user }, error: erroSupabase } = await supabase.auth.getUser(token);

        if (erroSupabase || !user) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: null, mensagem: 'Sessão expirada' })
            };
        }

        // Busca o primeiro e último nome associados ao ID da Auth Table
        const { data: perfil, error: erroPerfil } = await supabase
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