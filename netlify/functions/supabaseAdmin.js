import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Força o Netlify a carregar as variáveis de ambiente para o process.env
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ERRO crítico: Chave Service Role do Supabase em falta.');
}

const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || '');

export { supabaseAdmin };