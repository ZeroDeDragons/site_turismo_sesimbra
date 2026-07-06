// adminEvents.js
import { ChamarServidor } from '../../serviços/api.js';

const backupDadosOriginais = {
    local: new Map(),
    rota: new Map(),
    categoria: new Map()
};

// Mapeamento de entidades para nomes das funções Netlify
const MAPEAMENTO_FUNCOES = {
    local: 'local-gerenciar',
    rota: 'rota-gerenciar',
    categoria: 'categoria-gerenciar'
};

// adminEvents.js - Modificar a função dispararEventoAdmin

export function dispararEventoAdmin(acao, entidade, operacao = null, dadosAtualizados = {}, dadosOriginais = null) {
    const nomeEvento = `admin:${entidade}:${acao}`;
    
    // 🔥 MELHOR: Tenta obter o ID de várias fontes
    let id = dadosAtualizados?.id || dadosOriginais?.id;
    
    // Se ainda não tem ID, tenta buscar do backup
    if (!id && acao === 'confirmar') {
        // Para confirmação, tenta encontrar o primeiro backup da entidade
        const backups = backupDadosOriginais[entidade];
        if (backups && backups.size > 0) {
            const primeiroBackup = backups.values().next().value;
            if (primeiroBackup) {
                id = primeiroBackup.atualizado?.id || primeiroBackup.original?.id;
                console.warn(`[AdminEvents] Usando ID do backup para ${entidade}: ${id}`);
            }
        }
    }

    if (!id) {
        console.error(`[AdminEvents] ID não fornecido para a entidade ${entidade}`, { acao, entidade, dadosAtualizados, dadosOriginais });
        // 🔥 Para operações de confirmação, tenta obter o ID do backup armazenado
        if (acao === 'confirmar') {
            const backup = backupDadosOriginais[entidade];
            if (backup && backup.size > 0) {
                const keys = Array.from(backup.keys());
                if (keys.length > 0) {
                    id = keys[0];
                    console.log(`[AdminEvents] Recuperado ID do backup: ${id}`);
                }
            }
        }
        
        if (!id) {
            return;
        }
    }

    // Fase de Preparação
    if (acao === 'preparar') {
        backupDadosOriginais[entidade].set(id, {
            operacao,
            original: dadosOriginais ? JSON.parse(JSON.stringify(dadosOriginais)) : null,
            atualizado: dadosAtualizados ? JSON.parse(JSON.stringify(dadosAtualizados)) : null
        });
        console.log(`[Stage] Alteração preparada para ${entidade} ID ${id} (${operacao})`);
    }

    // Fase de Confirmação - Chama a API
    if (acao === 'confirmar') {
        const backup = backupDadosOriginais[entidade].get(id);
        if (!backup) {
            console.error(`[AdminEvents] Nenhum backup encontrado para ${entidade} ID ${id}`);
            return;
        }

        // Chama a função Netlify correspondente
        chamarApiConfirmar(entidade, backup, id);
    }

    // Recupera os dados guardados para enviar no evento
    const backup = backupDadosOriginais[entidade].get(id) || {};

    const evento = new CustomEvent(nomeEvento, {
        detail: {
            entidade,
            acao,
            id,
            operacao: backup.operacao || operacao,
            dadosOriginais: backup.original,
            dadosAtualizados: backup.atualizado,
            timestamp: new Date()
        },
        bubbles: true
    });

    window.dispatchEvent(evento);
}

// 🔥 NOVO: Função que chama a API
async function chamarApiConfirmar(entidade, backup, id) {
    const userId = localStorage.getItem('user_id') || localStorage.getItem('userId');
    
    if (!userId) {
        console.error('[AdminEvents] Usuário não autenticado!');
        alert('⚠️ Você precisa estar logado como administrador para salvar.');
        return;
    }

    const funcao = MAPEAMENTO_FUNCOES[entidade];
    if (!funcao) {
        console.error(`[AdminEvents] Nenhuma função mapeada para ${entidade}`);
        return;
    }

    const { operacao, original, atualizado } = backup;
    
    let payload = { userId };
    let method = 'POST';

    switch (operacao) {
        case 'inserir':
            payload = { ...payload, ...atualizado };
            method = 'POST';
            break;
        case 'atualizar':
            payload = { ...payload, ...atualizado };
            method = 'PUT';
            break;
        case 'deletar':
            payload = { ...payload, id: id };
            method = 'DELETE';
            break;
        default:
            console.error(`[AdminEvents] Operação desconhecida: ${operacao}`);
            return;
    }

    try {
        console.log(`[AdminEvents] Salvando ${entidade} via ${funcao} (${method})`, payload);
        
        const resultado = await ChamarServidor(funcao, {
            method: method,
            body: payload,
            comAutenticacao: true
        });

        console.log(`[AdminEvents] ✅ ${entidade} salvo com sucesso!`, resultado);
        
        // Dispara evento de sucesso
        const sucessoEvent = new CustomEvent(`admin:${entidade}:salvo`, {
            detail: {
                entidade,
                id,
                operacao,
                dados: resultado.data || atualizado
            }
        });
        window.dispatchEvent(sucessoEvent);

        // Limpa o backup após salvar com sucesso
        limparBackup(entidade, id);

        // Mostra feedback visual
        mostrarFeedback(`✅ ${entidade} salvo com sucesso!`, 'success');

    } catch (error) {
        console.error(`[AdminEvents] ❌ Erro ao salvar ${entidade}:`, error);
        mostrarFeedback(`❌ Erro ao salvar: ${error.message}`, 'error');
        
        // Dispara evento de erro
        const erroEvent = new CustomEvent(`admin:${entidade}:erro`, {
            detail: {
                entidade,
                id,
                operacao,
                erro: error.message
            }
        });
        window.dispatchEvent(erroEvent);
    }
}

// 🔥 NOVO: Feedback visual
function mostrarFeedback(mensagem, tipo = 'success') {
    const cores = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b'
    };

    const feedback = document.createElement('div');
    feedback.textContent = mensagem;
    feedback.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${cores[tipo] || '#10b981'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        font-weight: 500;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.style.opacity = '0';
        feedback.style.transition = 'opacity 0.3s ease';
        setTimeout(() => feedback.remove(), 300);
    }, 3000);
}

export function ouvirEventoAdmin(entidade, acao, callback) {
    window.addEventListener(`admin:${entidade}:${acao}`, (e) => callback(e.detail));
}

export function limparBackup(entidade, id) {
    if (backupDadosOriginais[entidade].has(id)) {
        backupDadosOriginais[entidade].delete(id);
        console.log(`[Memória] Backup de ${entidade} ID ${id} liberado.`);
    }
}

// 🔥 NOVO: Função para confirmar explicitamente (chamada pelos botões "Aplicar" nas categorias)
export function confirmarAlteracao(entidade, id) {
    // Verifica se existe backup para este ID
    const backup = backupDadosOriginais[entidade]?.get(id);
    if (!backup) {
        console.warn(`[AdminEvents] Nenhum backup encontrado para ${entidade} ID ${id}`);
        alert('⚠️ Nenhuma alteração pendente para salvar.');
        return;
    }

    // Dispara evento de confirmação
    dispararEventoAdmin('confirmar', entidade);
}