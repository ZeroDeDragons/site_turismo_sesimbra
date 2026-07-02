// netlify/functions/registro-criar-conta.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Método não permitido' }) };
  }

  try {
    const { email, password, primeiroNome, ultimoNome, dataNascimento } = JSON.parse(event.body);

    if (!email || !password || !primeiroNome || !ultimoNome || !dataNascimento) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Faltam dados obrigatórios.' })
      };
    }

    // Criar o utilizador com email_confirm: true bypassa a verificação por OTP.
    const { data: novoUsuario, error: erroCriacao } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (erroCriacao) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: erroCriacao.message })
      };
    }

    // Guarda os dados no perfil
    const { error: erroPerfil } = await supabase
      .from('Perfil')
      .insert({
        id: novoUsuario.user.id,
        primeiro_nome: primeiroNome,
        ultimo_nome: ultimoNome,
        data_de_nascimento: dataNascimento
      });

    if (erroPerfil) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: erroPerfil.message })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Conta criada com sucesso.' })
    };
  } catch (erro) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Erro interno ao criar conta.' })
    };
  }
}