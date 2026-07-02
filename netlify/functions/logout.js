const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Método não permitido. Use POST.' })
        };
    }

    try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Erro de Configuração: Chaves do Supabase não encontradas.' })
            };
        }

        const autorizacao = event.headers.authorization || event.headers.Authorization;

        // Sem token, não há sessão no servidor para terminar — responde OK
        // na mesma, para o frontend poder limpar o estado local.
        if (!autorizacao) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Sem sessão ativa.' })
            };
        }

        // Cria o client já autenticado com o token do utilizador, para que
        // o signOut() invalide a sessão correta no Supabase Auth.
        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: autorizacao } }
        });

        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('Erro ao terminar sessão no Supabase:', error.message);
            // Mesmo com erro no Supabase, o frontend já limpa o localStorage,
            // por isso não bloqueamos o fluxo do utilizador por isto.
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Logout efetuado com sucesso.' })
        };

    } catch (erroCritico) {
        console.error('Erro interno no back-end logout:', erroCritico.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Erro interno no servidor.' })
        };
    }
};
