import { limparBackup } from './adminEvents.js';

export const LocalPlugin = {
    async criar(payload) { /* ... */ },
    async inserir(payload) {
        limparBackup('local', payload.id);
    },
    reverter(payload, dadosOriginais) {
        if (!dadosOriginais) {
            console.warn("⚠️ Nenhum backup encontrado para este local.");
            return null;
        }
        console.log('🔄 [Plugin Local] Restaurando dados originais:', dadosOriginais);
        limparBackup('local', payload.id);
        return dadosOriginais;
    }
};

export const PluginsAdmin = {
    local: LocalPlugin,
};