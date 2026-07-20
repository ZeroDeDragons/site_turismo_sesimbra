// Importa a função genérica de chamada ao servidor do seu arquivo api.js
import { ChamarServidor } from './api.js';

// Estende EventTarget para permitir o sistema de sinais/eventos nativos
class DataManager extends EventTarget {
    constructor() {
        super();
        this.cache = this._inicializarCache();
    }

    _inicializarCache() {
        return {
            // Memória local (Cache) para buscas rápidas por ID O(1)
            locais: new Map(),           // id_local -> dados do local
            rotas: new Map(),            // id_route -> dados da rota
            categorias: new Map(),       // id_categoria -> dados da categoria
            segmentosPorRota: new Map(), // id_rota -> array de segmentos
            perfis: new Map(),           // id (uuid) -> dados do perfil [ADICIONADO]

            // Tabelas pivô mapeadas de forma genérica
            relacionamentos: {
                categoriaLocais: new Map(),  // id_categoria -> Set([id_local1, id_local2...])
                categoriaRotas: new Map(),   // id_categoria -> Set([id_rota1, id_rota2...])
                localRotas: new Map()        // id_local -> Set([id_rota1, id_rota2...])
            },

            // Controla se a carga inicial otimizada já foi feita
            dadosIniciaisCarregados: false
        };
    }

    /**
     * Dispara um sinal (evento) para que outros componentes saibam das mudanças.
     */
    _emitirSinal(nomeDoSinal, dados) {
        this.dispatchEvent(new CustomEvent(nomeDoSinal, { detail: dados }));
    }

    /**
     * Garante de forma otimizada os dados base estruturais (Locais, Rotas e Categorias).
     * Faz apenas UMA requisição para a Netlify Function unificada (obterDadosBase).
     */
    async _garantirDadosIniciais() {
        if (this.cache.dadosIniciaisCarregados) return;

        try {
            
             const dadosBase = await ChamarServidor('obter-dados-base', { method: 'GET' });

            if (dadosBase) {
                if (Array.isArray(dadosBase.locais)) {
                    dadosBase.locais.forEach(local => this.cache.locais.set(local.id, local));
                }
                if (Array.isArray(dadosBase.rotas)) {
                    dadosBase.rotas.forEach(rota => this.cache.rotas.set(rota.id, rota));
                }
                if (Array.isArray(dadosBase.categorias)) {
                    dadosBase.categorias.forEach(cat => this.cache.categorias.set(cat.id, cat));
                }
            }

            this.cache.dadosIniciaisCarregados = true;
        } catch (error) {
            console.error('[DataManager] Erro crítico ao carregar dados iniciais:', error);
            throw error;
        }
    }

    async getLocal(idLocal) { await this._garantirDadosIniciais(); return this.cache.locais.get(idLocal) || null; }
    async getRota(idRota) { await this._garantirDadosIniciais(); return this.cache.rotas.get(idRota) || null; }
    async getCategoria(idCategoria) { await this._garantirDadosIniciais(); return this.cache.categorias.get(idCategoria) || null; }

    /**
     * Busca o perfil pelo ID (UUID). Se não estiver no cache, busca no servidor. [ADICIONADO]
     */
    async getPerfil(idPerfil) {
        if (this.cache.perfis.has(idPerfil)) {
            return this.cache.perfis.get(idPerfil);
        }
        try {
            // Endpoint fictício/adecuado para obter um perfil específico
            const perfil = await ChamarServidor(`obterPerfil?id=${idPerfil}`, { method: 'GET' });
            if (perfil) {
                this.cache.perfis.set(idPerfil, perfil);
                return perfil;
            }
            return null;
        } catch (error) {
            console.error(`[DataManager] Erro ao buscar perfil ${idPerfil}:`, error);
            return null;
        }
    }

    // --- Getters de Listagem Global ---
    async getTodosLocais() { await this._garantirDadosIniciais(); return Array.from(this.cache.locais.values()); }
    async getTodasRotas() { await this._garantirDadosIniciais(); return Array.from(this.cache.rotas.values()); }
    async getTodasCategorias() { await this._garantirDadosIniciais(); return Array.from(this.cache.categorias.values()); }

    /**
     * Abstração genérica privada para buscar relacionamentos nas Netlify Functions.
     */
    async _buscarRelacionamento({ nomeRelacionamento, idValor, mapaAlvo }) {
        await this._garantirDadosIniciais();

        const mapaRelacionamento = this.cache.relacionamentos[nomeRelacionamento];

        if (mapaRelacionamento.has(idValor)) {
            const idsAlvo = mapaRelacionamento.get(idValor);
            return Array.from(idsAlvo).map(id => mapaAlvo.get(id)).filter(Boolean);
        }

        const endpoint = `obter-relacionamento?tipo=${nomeRelacionamento}&id=${idValor}`;
        const dados = await ChamarServidor(endpoint, { method: 'GET' });
        const conjuntoIds = new Set();

        if (Array.isArray(dados) && dados.length > 0) {
            const campoIdRetorno = Object.keys(dados[0])[0];
            dados.forEach(item => conjuntoIds.add(item[campoIdRetorno]));
        }

        mapaRelacionamento.set(idValor, conjuntoIds);
        return Array.from(conjuntoIds).map(id => mapaAlvo.get(id)).filter(Boolean);
    }

    // --- Métodos de Relacionamento ---
    async getLocaisPorCategoria(idCategoria) {
        return this._buscarRelacionamento({
            nomeRelacionamento: 'categoriaLocais',
            idValor: idCategoria,
            mapaAlvo: this.cache.locais
        });
    }

    async getRotasPorCategoria(idCategoria) {
        return this._buscarRelacionamento({
            nomeRelacionamento: 'categoriaRotas',
            idValor: idCategoria,
            mapaAlvo: this.cache.rotas
        });
    }

    async getRotasPorLocal(idLocal) {
        return this._buscarRelacionamento({
            nomeRelacionamento: 'localRotas',
            idValor: idLocal,
            mapaAlvo: this.cache.rotas
        });
    }

    async getSegmentosPorRota(idRota) {
        if (this.cache.segmentosPorRota.has(idRota)) {
            return this.cache.segmentosPorRota.get(idRota);
        }

        try {
            const segmentos = await ChamarServidor(`obter-segmentos?id_rota=${idRota}`, { method: 'GET' });
            this.cache.segmentosPorRota.set(idRota, segmentos);
            return segmentos;
        } catch (error) {
            console.error(`[DataManager] Erro ao buscar segmentos da rota ${idRota}:`, error);
            throw error;
        }
    }

    // --- SISTEMA DE ATUALIZAÇÃO REALTIME (Fire & Forget Otimista) ---

    removerDadoLocal(entidade, id) {
        if (this.cache[entidade]?.has(id)) {
            this.cache[entidade].delete(id);
            this._limparRelacionamentosDaEntidade(entidade);

            this._emitirSinal(`${entidade}:deletado`, { id });
            this._emitirSinal('cache:atualizado', { motivo: `Remoção de ${entidade}` });
        }
    }

    _limparRelacionamentosDaEntidade(entidade) {
        if (entidade === 'locais') {
            this.cache.relacionamentos.categoriaLocais.clear();
            this.cache.relacionamentos.localRotas.clear();
        } else if (entidade === 'rotas') {
            this.cache.relacionamentos.categoriaRotas.clear();
            this.cache.relacionamentos.localRotas.clear();
            this.cache.segmentosPorRota.clear();
        } else if (entidade === 'categorias') {
            this.cache.relacionamentos.categoriaLocais.clear();
            this.cache.relacionamentos.categoriaRotas.clear();
        } else if (entidade === 'perfis') {
            
        }
    }

    limparCache() {
        this.cache = this._inicializarCache();
        this.perfilLogado = null;
    }

    async salvarDado(mapaEntidade, tabelaBanco, dadoAlterado) {
        try {
            const dadoSalvo = await ChamarServidor('ed-salvar', {
                method: 'POST',
                body: {
                    entidade: tabelaBanco,
                    dado: dadoAlterado
                }
            });

            if (dadoSalvo && dadoSalvo.id) {
                this.cache[mapaEntidade].set(dadoSalvo.id, dadoSalvo);
                this._limparRelacionamentosDaEntidade(mapaEntidade);

                this._emitirSinal(`${mapaEntidade}:atualizado`, dadoSalvo);
                return dadoSalvo;
            }

            throw new Error("Resposta inválida do servidor ao salvar o registro.");
        } catch (error) {
            console.error(`[DataManager] Erro ao salvar na entidade ${mapaEntidade}:`, error);
            throw error;
        }
    }

    async deletarDado(mapaEntidade, tabelaBanco, id) {
        try {
            await ChamarServidor('ed-deletar', {
                method: 'POST',
                body: {
                    entidade: tabelaBanco,
                    id: id
                }
            });

            this.removerDadoLocal(mapaEntidade, id);
            return true;
        } catch (error) {
            console.error(`[DataManager] Erro ao deletar no servidor a entidade ${mapaEntidade}:`, error);
            throw error;
        }
    }

    async salvarRelacionamento({ mapaEntidade, tabelaPivo, campoPai, idPai, campoFilho, idsFilhos }) {
        try {
         await ChamarServidor('ed-salvar-relacionamento', {
                method: 'POST',
                body: { tabelaPivo, campoPai, idPai, campoFilho, idsFilhos }
            });

            if (this.cache.relacionamentos[mapaEntidade]) {
                this.cache.relacionamentos[mapaEntidade].delete(idPai);
            }

            this._emitirSinal(`${mapaEntidade}:atualizado`, { idPai, idsFilhos });
            return true;
        } catch (error) {
            console.error(`[DataManager] Erro ao salvar relacionamento pivô para ${mapaEntidade}:`, error);
            throw error;
        }
    }
}

const dataManager = new DataManager();
export default dataManager;