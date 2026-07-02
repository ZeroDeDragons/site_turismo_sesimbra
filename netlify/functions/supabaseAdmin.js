<<<<<<< HEAD
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ERRO: Chave Service Role do Supabase em falta.');
}

const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || '');

=======
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ERRO: Chave Service Role do Supabase em falta.');
}

const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || '');

>>>>>>> ab6c34930675a2be95c5cba4fbea6f5316e191bf
export { supabaseAdmin };   