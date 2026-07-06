import { supabaseAdmin } from './supabaseAdmin.js';
import { verificarAdmin } from './verificar-admin.js';

export const handler = async (event, context) => {
  const method = event.httpMethod;
  if (!['POST', 'PUT', 'DELETE'].includes(method)) {
    return { statusCode: 405, body: JSON.stringify({ message: 'Método não permitido' }) };
  }

  try {
    // Executa a validação centralizada
    const { userId, errorResponse } = await verificarAdmin(event);
    if (errorResponse) return errorResponse;

    const body = JSON.parse(event.body || '{}');
    const { id, nome, descricao, posicao, is_public } = body;

    if (method === 'POST') {
      if (!nome || !posicao) return { statusCode: 400, body: JSON.stringify({ message: 'Nome e posição são obrigatórios.' }) };

      const { data, error } = await supabaseAdmin
        .from('Local')
        .insert({ nome, descricao, posicao, is_public, criado_por: userId })
        .select();

      if (error) return { statusCode: 400, body: JSON.stringify({ message: error.message }) };
      return { statusCode: 201, body: JSON.stringify({ message: 'Local criado com sucesso!', data }) };
    }

    if (method === 'PUT') {
      if (!id) return { statusCode: 400, body: JSON.stringify({ message: 'ID do local é obrigatório.' }) };

      const { data, error } = await supabaseAdmin
        .from('Local')
        .update({ nome, descricao, posicao, is_public })
        .eq('id', id)
        .select();

      if (error) return { statusCode: 400, body: JSON.stringify({ message: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ message: 'Local atualizado!', data }) };
    }

    if (method === 'DELETE') {
      if (!id) return { statusCode: 400, body: JSON.stringify({ message: 'ID do local é obrigatório.' }) };

      const { error } = await supabaseAdmin.from('Local').delete().eq('id', id);

      if (error) return { statusCode: 400, body: JSON.stringify({ message: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ message: 'Local eliminado com sucesso!' }) };
    }

  } catch (erroCritico) {
    console.error('Erro em Local:', erroCritico.message);
    return { statusCode: 500, body: JSON.stringify({ message: 'Erro interno no servidor.' }) };
  }
};