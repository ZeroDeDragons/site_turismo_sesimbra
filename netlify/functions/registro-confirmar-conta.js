// netlify/functions/registro-confirmar-conta.js
//
// Recebe o código de 6 dígitos que o utilizador escreveu na etapa 3
// e valida-o junto do Supabase, confirmando assim o email da conta.

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
    const { email, codigo } = JSON.parse(event.body);

    if (!email || !codigo) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Faltam dados obrigatórios.' })
      };
    }

    // "verifyOtp" confirma o código enviado por email (type: 'signup'
    // é o tipo usado para confirmação de registo no Supabase).
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: codigo,
      type: 'signup'
    });

    if (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Código inválido ou expirado.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Conta confirmada com sucesso.' })
    };
  } catch (erro) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Erro interno ao confirmar conta.' })
    };
  }
}
