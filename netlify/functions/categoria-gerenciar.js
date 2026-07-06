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
    const { id, nome, cor, simbolo } = body;

    if (method === 'POST') {
      if (!nome) return { statusCode: 400, body: JSON.stringify({ message: 'O nome da categoria é obrigatório.' }) };

      const { data, error } = await supabaseAdmin
        .from('Categorias')
        .insert({ nome, cor, simbolo, criado_por: userId })
        .select();

      if (error) return { statusCode: 400, body: JSON.stringify({ message: error.message }) };
      return { statusCode: 201, body: JSON.stringify({ message: 'Categoria criada!', data }) };
    }

    if (method === 'PUT') {
      if (!id) return { statusCode: 400, body: JSON.stringify({ message: 'ID da categoria é obrigatório.' }) };

      const { data, error } = await supabaseAdmin
        .from('Categorias')
        .update({ nome, cor, simbolo })
        .eq('id', id)
        .select();

      if (error) return { statusCode: 400, body: JSON.stringify({ message: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ message: 'Categoria atualizada!', data }) };
    }

    if (method === 'DELETE') {
      if (!id) return { statusCode: 400, body: JSON.stringify({ message: 'ID da categoria é obrigatório.' }) };

      const { error } = await supabaseAdmin.from('Categorias').delete().eq('id', id);

      if (error) return { statusCode: 400, body: JSON.stringify({ message: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ message: 'Categoria eliminada com sucesso!' }) };
    }

  } catch (erroCritico) {
    console.error('Erro em Categorias:', erroCritico.message);
    return { statusCode: 500, body: JSON.stringify({ message: 'Erro interno no servidor.' }) };
  }
};