const { createClient } = require('@supabase/supabase-js');

// Função auxiliar para inicializar o cliente Supabase
function obterClienteSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Configuração incompleta: Chaves do Supabase em falta.');
    }
    return createClient(supabaseUrl, supabaseKey);
}

// Função auxiliar para estruturar respostas HTTP uniformes
function responder(statusCode, corpo) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
    };
}

exports.handler = async (event, context) => {
    // 1. Garantir que o método é estritamente POST para envio seguro de dados
    if (event.httpMethod !== 'POST') {
        return responder(405, { message: 'Método não permitido. Utilize POST.' });
    }

    try {
        const supabase = obterClienteSupabase();
        
        // 2. Extrair e validar dados do corpo da requisição (Apenas o essencial)
        const { email, password } = JSON.parse(event.body || '{}');
        if (!email || !password) {
            return responder(400, { message: 'Email e senha são obrigatórios.' });
        }

        // 3. Efetuar a autenticação diretamente no Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error || !data.user) {
            return responder(401, { message: error?.message || 'Credenciais inválidas.' });
        }

        // 4. Otimização de Tráfego: Procurar o perfil para saber se é Admin
        const { data: perfil } = await supabase
            .from('Perfil')
            .select('admin')
            .eq('id', data.user.id)
            .single();

        // Envia de volta apenas o estritamente necessário para o Frontend
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