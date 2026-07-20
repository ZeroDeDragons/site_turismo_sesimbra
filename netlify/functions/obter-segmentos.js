import { supabase } from './supabase/supabaseClient.js';

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Método Não Permitido' };
    }

    const { id_rota } = event.queryStringParameters || {};

    if (!id_rota) {
        return { statusCode: 400, body: 'O parâmetro query id_rota é obrigatório.' };
    }

    try {
        // Busca os segmentos no Supabase aplicando a ordenação correta pela coluna 'ordem'
        const { data, error } = await supabase
            .from('Segmento')
            .select('id, id_local1, id_local2, ordem')
            .eq('id_rota', id_rota)
            .order('ordem', { ascending: true });

        if (error) throw error;

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' 
            },
            body: JSON.stringify(data || [])
        };
    } catch (error) {
        console.error(`Erro ao obter segmentos da rota ${id_rota}:`, error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ erro: error.message || 'Erro ao buscar segmentos' }) 
        };
    }
}