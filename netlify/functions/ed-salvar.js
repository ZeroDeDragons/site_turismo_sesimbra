import { createClient } from '@supabase/supabase-js'; 
import { supabase } from './supabase/supabaseClient.js'; 

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export async function handler(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Método Não Permitido' };
    }

    try {
        const headers = event.headers || {};
        const cookieHeader = headers.cookie || headers.Cookie || '';
        
        const token = cookieHeader
            .split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('sb-access-token='))
            ?.split('=')[1];

        if (!token) {
            return { 
                statusCode: 401, 
                body: JSON.stringify({ erro: 'Não autenticado. Faça login novamente.' }) 
            };
        }

        const supabaseScoped = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistenceSession: false },
            global: {
                headers: {
                    Authorization: `Bearer ${token}` 
                }
            }
        });

        const { entidade, dado } = JSON.parse(event.body || '{}');

        if (!entidade || !dado) {
            return { statusCode: 400, body: 'Parâmetros obrigatórios ausentes.' };
        }

        let query;
        if (dado.id !== undefined && dado.id !== null && dado.id !== "") {
            const idParaAtualizar = dado.id;
            const dadosParaAtualizar = { ...dado };
            delete dadosParaAtualizar.id; 

            query = supabaseScoped.from(entidade).update(dadosParaAtualizar).eq('id', idParaAtualizar);
        } else {
            const dadosParaInserir = { ...dado };
            delete dadosParaInserir.id;

            query = supabaseScoped.from(entidade).insert(dadosParaInserir);
        }

        const { data, error } = await query.select().single();

        if (error) throw error; 

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(data)
        };

    } catch (error) {
        return { 
            statusCode: error.code === '42501' ? 403 : 500, 
            body: JSON.stringify({ erro: error.message }) 
        };
    }
}