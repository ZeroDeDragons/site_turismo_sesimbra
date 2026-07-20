import { supabase } from './supabase/supabaseClient.js';

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Método Não Permitido' };
    }

    const { tipo, id } = event.queryStringParameters || {};

    if (!tipo || !id) {
        return { statusCode: 400, body: 'Parâmetros "tipo" e "id" são obrigatórios.' };
    }

    try {
        let dados = [];

        switch (tipo) {
            case 'categoriaLocais': {
                // Consulta na tabela pivô Local_Categoria filtrando pela Categoria
                const { data, error } = await supabase
                    .from('Local_Categoria')
                    .select('id_local')
                    .eq('id_categoria', id);

                if (error) throw error;
                dados = data || [];
                break;
            }

            case 'categoriaRotas': {
                // Consulta na tabela pivô Rota_Categoria filtrando pela Categoria
                const { data, error } = await supabase
                    .from('Rota_Categoria')
                    .select('id_rota')
                    .eq('id_categoria', id);

                if (error) throw error;
                dados = data || [];
                break;
            }

            case 'localRotas': {
                // Na tabela Segmento, descobrimos quais rotas passam por este local 
                // verificando se ele é o ponto de partida (id_local1) ou de destino (id_local2)
                const { data, error } = await supabase
                    .from('Segmento')
                    .select('id_rota')
                    .or(`id_local1.eq.${id},id_local2.eq.${id}`);

                if (error) throw error;

                // Remove duplicados: se um local aparece em vários segmentos da mesma rota, manda o ID apenas uma vez
                const idsUnicos = [...new Set(data?.map(s => s.id_rota))];
                dados = idsUnicos.map(id_rota => ({ id_rota }));
                break;
            }

            default:
                return { statusCode: 400, body: 'Tipo de relacionamento desconhecido ou inválido.' };
        }

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' 
            },
            body: JSON.stringify(dados)
        };

    } catch (error) {
        console.error(`Erro ao processar relacionamento ${tipo} no Supabase:`, error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ erro: error.message || 'Erro ao consultar relacionamentos' }) 
        };
    }
}