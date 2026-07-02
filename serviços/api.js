let cacheDadosTurismo = null;

function obterHeaderAutenticacao() {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function ChamarServidor(functionName, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const comAutenticacao = options.comAutenticacao !== false;

    try {
        const response = await fetch(`/.netlify/functions/${functionName}`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...(comAutenticacao ? obterHeaderAutenticacao() : {}),
                ...options.headers
            },
            body: method !== 'GET' && options.body ? JSON.stringify(options.body) : undefined,
            credentials: 'include'
        });

        const responseText = await response.text();
        const data = responseText ? JSON.parse(responseText) : {};

        if (!response.ok) {
            throw new Error(data.message || `Erro no servidor (Status ${response.status})`);
        }

        return data;
    } catch (error) {
        console.error(`❌ Falha crítica em ${functionName}:`, error.message);
        throw error;
    }
}

export async function obterDadosTurismo(forcarAtualizacao = false) {
    if (cacheDadosTurismo && !forcarAtualizacao) {
        return cacheDadosTurismo;
    }

    try {
        const dados = await ChamarServidor('mapa', { method: 'GET' });

        // Estrutura padronizada dos dados
        cacheDadosTurismo = {
            locais: dados.locais || [],
            rotas: dados.rotas || []
        };

        // Substitua a linha do seu console.log por isso:
        console.log(" --- LOCAIS RECEBIDOS ---");
        console.table(cacheDadosTurismo.locais);

        console.log(" --- ROTAS RECEBIDAS ---");
        console.table(cacheDadosTurismo.rotas);
        return cacheDadosTurismo;
    } catch (erro) {
        throw erro;
    }
}

export function limparCacheTurismo() {
    cacheDadosTurismo = null;
    console.log(' API: Cache de dados turísticos limpo');
}