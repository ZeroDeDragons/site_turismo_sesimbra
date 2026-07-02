<<<<<<< HEAD
import { limparBackup } from './adminEvents.js';

export const LocalPlugin = {
    async criar(payload) { },
    async inserir(payload) {
        limparBackup('local', payload.id);
    },
    reverter(payload, dadosOriginais) {
        if (!dadosOriginais) {
            console.warn(" Nenhum backup encontrado para este local.");
            return null;
        }
        console.log(' Restaurando dados originais:', dadosOriginais);
        limparBackup('local', payload.id);
        return dadosOriginais;
    }
};

export const PluginsAdmin = {
    local: LocalPlugin,
=======
import { limparBackup } from './adminEvents.js';

export const LocalPlugin = {
    async criar(payload) { },
    async inserir(payload) {
        limparBackup('local', payload.id);
    },
    reverter(payload, dadosOriginais) {
        if (!dadosOriginais) {
            console.warn(" Nenhum backup encontrado para este local.");
            return null;
        }
        console.log(' Restaurando dados originais:', dadosOriginais);
        limparBackup('local', payload.id);
        return dadosOriginais;
    }
};

export const PluginsAdmin = {
    local: LocalPlugin,
>>>>>>> ab6c34930675a2be95c5cba4fbea6f5316e191bf
};