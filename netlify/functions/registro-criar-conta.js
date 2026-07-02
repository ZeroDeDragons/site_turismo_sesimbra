import { supabaseAdmin } from './supabaseAdmin.js';

export const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Método não permitido' }) }; 
  }

  try {
    const { email, password, primeiroNome, ultimoNome, dataNascimento } = JSON.parse(event.body || '{}'); 

    if (!email || !password || !primeiroNome || !ultimoNome || !dataNascimento) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Faltam dados obrigatórios.' }) }; 
    }

    const { data: novoUsuario, error: erroCriacao } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    }); 

    if (erroCriacao) {
      return { statusCode: 400, body: JSON.stringify({ message: erroCriacao.message }) }; 
    }

    const { error: erroPerfil } = await supabaseAdmin
      .from('Perfil')
      .insert({
        id: novoUsuario.user.id,
        primeiro_nome: primeiroNome,
        ultimo_nome: ultimoNome,
        data_de_nascimento: dataNascimento
      }); 

    if (erroPerfil) {
      return { statusCode: 400, body: JSON.stringify({ message: erroPerfil.message }) }; 
    }

    return { 
      statusCode: 200, 
      body: JSON.stringify({ message: 'Conta criada com sucesso!' }) 
    };

  } catch (erroCritico) {
    console.error('Erro interno ao criar conta:', erroCritico.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Erro interno no servidor ao processar o registo.' })
    };
  }
};