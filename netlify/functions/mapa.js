import { supabase } from './supabaseClient.js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Método não permitido.' })
        };
    }

    try {
        const { data: dadosLocais, error: erroLocais } = await supabase
            .from('Local')
            .select(`
                id, nome, descricao, criado_em, is_public, posicao,
                Local_Categoria (
                    Categorias (id, nome, cor, simbolo)
                )
            `)
            .eq('is_public', true);

        if (erroLocais) {
            console.error('❌ Erro ao buscar locais:', erroLocais);
            throw erroLocais;
        }

        const { data: dadosRotas, error: erroRotas } = await supabase
            .from('Rotas')
            .select(`
                id, nome, descricao, criado_em, is_public, id_segmento,
                Rota_Categoria (
                    Categorias (id, nome, cor, simbolo)
                )
            `)
            .eq('is_public', true);

        if (erroRotas) {
            console.error('❌ Erro ao buscar rotas:', erroRotas);
            throw erroRotas;
        }

        const locaisFormatados = (dadosLocais || []).map((local) => {
            const categoriaRel = local.Local_Categoria?.[0]?.Categorias;
            
            let categoria = null;
            if (categoriaRel) {
                categoria = {
                    nome: categoriaRel.nome || 'Geral',
                    cor: categoriaRel.cor || '#979d23',
                    simbolo: categoriaRel.simbolo || '📍'
                };
            } else {
                const ehPraia = local.nome?.toLowerCase().includes('praia') || 
                               local.nome?.toLowerCase().includes('califórnia');
                categoria = ehPraia 
                    ? { nome: 'Praias', cor: '#23769d', simbolo: '🏖️' }
                    : { nome: 'Monumentos', cor: '#979d23', simbolo: '🏰' };
            }

            let posicaoFormatada = null;
            if (local.posicao) {
                if (typeof local.posicao === 'object') {
                    posicaoFormatada = local.posicao;
                } else if (typeof local.posicao === 'string') {
                    try {
                        posicaoFormatada = JSON.parse(local.posicao);
                    } catch (e) {
                        console.warn(`⚠️ Não foi possível parsear posicao de "${local.nome}"`);
                    }
                }
            }

            if (!posicaoFormatada) {
                posicaoFormatada = { type: 'Point', coordinates: [-9.1015, 38.4445] };
            }

            return {
                id: local.id,
                nome: local.nome,
                descricao: local.descricao,
                criado_em: local.criado_em,
                is_public: local.is_public,
                posicao: posicaoFormatada,
                categoria: categoria
            };
        });

        const rotasFormatadas = (dadosRotas || []).map((rota) => {
            const categoriaRel = rota.Rota_Categoria?.[0]?.Categorias;
            
            let categoria = categoriaRel ? {
                nome: categoriaRel.nome || 'Trilho',
                cor: categoriaRel.cor || '#23769d',
                simbolo: categoriaRel.simbolo || '🧭'
            } : { nome: 'Trilho', cor: '#23769d', simbolo: '🧭' };

            const coordenadas = [
                { type: 'Point', coordinates: [-9.1015, 38.4445] },
                { type: 'Point', coordinates: [-9.0915, 38.4545] }
            ];

            return {
                id: rota.id,
                nome: rota.nome,
                descricao: rota.descricao,
                criado_em: rota.criado_em,
                is_public: rota.is_public,
                coordenadas: coordenadas,
                categoria: categoria
            };
        });

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ locais: locaisFormatados, rotas: rotasFormatadas })
        };

    } catch (erroCritico) {
        console.error('❌ Erro interno no back-end mapa.js:', erroCritico);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Erro no servidor: ${erroCritico.message}` })
        };
    }
};