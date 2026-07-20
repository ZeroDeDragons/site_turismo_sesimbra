import { supabase } from './supabase/supabaseClient.js'; 

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Método não permitido. Use POST.' })
        };
    }

    try {
        const autorizacao = event.headers.authorization || event.headers.Authorization;

        if (!autorizacao) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Sem sessão activa.' })
            };
        }

        const token = autorizacao.replace('Bearer ', '');
        const { error } = await supabase.auth.signOut(token);

        if (error) {
            console.error('Erro ao terminar sessão no Supabase:', error.message);
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