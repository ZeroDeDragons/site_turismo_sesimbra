import { supabase } from './supabaseClient.js'; // Importante incluir a extensão .js no import

function responder(statusCode, corpo) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
    };
}

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return responder(405, { message: 'Método não permitido. Utilize POST.' });
    }

    try {
        const { email, password } = JSON.parse(event.body || '{}');
        if (!email || !password) {
            return responder(400, { message: 'Email e senha são obrigatórios.' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error || !data.user) {
            return responder(401, { message: error?.message || 'Credenciais inválidas.' });
        }

        const { data: perfil } = await supabase
            .from('Perfil')
            .select('admin')
            .eq('id', data.user.id)
            .single();

        const respostaOtimizada = {
            session: {
                access_token: data.session.access_token,
                expires_at: data.session.expires_at
            },
            user: {
                id: data.user.id,
                email: data.user.email,
                display_name: data.user.user_metadata?.display_name || 'Utilizador',
                admin: perfil?.admin === true
            }
        };

        return responder(200, respostaOtimizada);

    } catch (erroCritico) {
        console.error(' Erro interno no backend ao efetuar login:', erroCritico.message);
        return responder(500, { message: 'Erro interno no servidor ao processar o login.' });
    }
};