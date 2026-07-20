import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ ERRO crítico: Chaves do Supabase em falta nas variáveis de ambiente.');
}

const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export { supabase };