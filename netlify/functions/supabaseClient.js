import { createClient } from '@supabase/supabase-js';

// Garantir compatibilidade com diferentes contextos de build do Netlify
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    // Vamos fazer um console.error em vez de crashar a aplicação com throw, para o Netlify não dar 502
    console.error('❌ ERRO: Chaves do Supabase em falta nas variáveis de ambiente.');
}

const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export { supabase };