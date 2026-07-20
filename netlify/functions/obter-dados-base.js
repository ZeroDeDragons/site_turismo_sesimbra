import { supabase } from './supabase/supabaseClient.js'; 

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Método Não Permitido' };
    }

    try {
        // Realiza as buscas em paralelo no Supabase de forma ultra rápida
        const [locaisRes, rotasRes, categoriasRes] = await Promise.all([
            supabase.from('Local').select('*'),
            supabase.from('Rotas').select('*'),
            supabase.from('Categorias').select('*')
        ]);

        // Trata possíveis erros retornados pelo banco
        if (locaisRes.error) throw locaisRes.error;
        if (rotasRes.error) throw rotasRes.error;
        if (categoriasRes.error) throw categoriasRes.error;

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' // Permite requisições do front-end
            },
            body: JSON.stringify({
                locais: locaisRes.data || [],
                rotas: rotasRes.data || [],
                categorias: categoriasRes.data || []
            })
        };
    } catch (error) {
        console.error('Erro ao obter dados base do Supabase:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ erro: error.message || 'Erro interno no servidor' }) 
        };
    }
}