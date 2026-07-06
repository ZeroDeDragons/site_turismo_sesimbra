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
    const { id, nome, descricao, is_public, cor } = body;

    if (method === 'POST') {
      if (!nome) return { statusCode: 400, body: JSON.stringify({ message: 'O nome da rota é obrigatório.' }) };

      const { data, error } = await supabaseAdmin
        .from('Rotas')
        .insert({ nome, descricao, is_public, cor, criado_por: userId })
        .select();

      if (error) return { statusCode: 400, body: JSON.stringify({ message: error.message }) };
      return { statusCode: 201, body: JSON.stringify({ message: 'Rota criada com sucesso!', data }) };
    }

    if (method === 'PUT') {
      if (!id) return { statusCode: 400, body: JSON.stringify({ message: 'ID da rota é obrigatório.' }) };

      const { data, error } = await supabaseAdmin
        .from('Rotas')
        .update({ nome, descricao, is_public, cor })
        .eq('id', id)
        .select();

      if (error) return { statusCode: 400, body: JSON.stringify({ message: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ message: 'Rota updated!', data }) };
    }

    if (method === 'DELETE') {
      if (!id) return { statusCode: 400, body: JSON.stringify({ message: 'ID da rota é obrigatório.' }) };

      const { error } = await supabaseAdmin.from('Rotas').delete().eq('id', id);

      if (error) return { statusCode: 400, body: JSON.stringify({ message: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ message: 'Rota eliminada com sucesso!' }) };
    }

  } catch (erroCritico) {
    console.error('Erro em Rotas:', erroCritico.message);
    return { statusCode: 500, body: JSON.stringify({ message: 'Erro interno no servidor.' }) };
  }
};