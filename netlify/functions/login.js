import { supabase } from './supabase/supabaseClient.js'; 

function responder(statusCode, corpo, cookies = []) {
    const resposta = {
        statusCode,
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(corpo)
    };

    if (cookies.length > 0) {
        resposta.headers['Set-Cookie'] = cookies.join(', ');
    }

    return resposta;
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

        if (error || !data.user || !data.session) {
            return responder(401, { message: error?.message || 'Credenciais inválidas.' });
        }

        const { data: perfil } = await supabase
            .from('Perfil')
            .select('admin')
            .eq('id', data.user.id)
            .single();

        const accessToken = data.session.access_token;
        const maxAge = data.session.expires_in;
        const tokenCookie = `sb-access-token=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

        const respostaOtimizada = {
            user: {
                id: data.user.id,
                email: data.user.email,
                display_name: data.user.user_metadata?.display_name || 'Utilizador',
                admin: perfil?.admin === true
            }
        };

        return responder(200, respostaOtimizada, [tokenCookie]);

    } catch (erroCritico) {
        console.error(' Erro interno no backend ao efetuar login:', erroCritico.message);
        return responder(500, { message: 'Erro interno no servidor ao processar o login.' });
    }
};