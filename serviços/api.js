export async function ChamarServidor(functionName, options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    try {
        const response = await fetch(`/api/${functionName}`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
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
        console.error(` Falha crítica em ${functionName}:`, error.message);
        throw error;
    }
}