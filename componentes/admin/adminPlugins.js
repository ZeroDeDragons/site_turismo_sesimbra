// adminPlugins.js
import { limparBackup } from './adminEvents.js';

// Função utilitária interna para evitar repetição de código
const processarPlugin = {
    preparar({ operacao, id, dadosAtualizados }, lista) {
        if (operacao === 'inserir') return [...lista, { ...dadosAtualizados, _status: 'pendente_inserir' }];
        
        return lista.map(item => item.id === id 
            ? { ...(operacao === 'atualizar' ? dadosAtualizados : item), _status: `pendente_${operacao}` } 
            : item
        );
    },

    confirmar({ operacao, id, dadosAtualizados }, lista, entidade) {
        limparBackup(entidade, id);
        if (operacao === 'deletar') return lista.filter(item => item.id !== id);
        
        return lista.map(item => item.id === id ? { ...dadosAtualizados } : item);
    },

    reverter({ operacao, id, dadosOriginais }, lista, entidade) {
        limparBackup(entidade, id);
        if (operacao === 'inserir') return lista.filter(item => item.id !== id);
        if (operacao === 'atualizar') return lista.map(item => item.id === id ? { ...dadosOriginais } : item);
        
        // Deletar: remove apenas a propriedade _status
        return lista.map(item => {
            if (item.id !== id) return item;
            const { _status, ...resto } = item;
            return resto;
        });
    }
};

// Gerador dinâmico para as três entidades (local, rota, categoria)
const criarPluginPara = (entidade) => ({
    preparar: (detalhes, lista) => processarPlugin.preparar(detalhes, lista),
    confirmar: (detalhes, lista) => processarPlugin.confirmar(detalhes, lista, entidade),
    reverter: (detalhes, lista) => processarPlugin.reverter(detalhes, lista, entidade)
});

export const PluginsAdmin = {
    local: criarPluginPara('local'),
    rota: criarPluginPara('rota'),
    categoria: criarPluginPara('categoria')
};