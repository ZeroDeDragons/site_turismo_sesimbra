// mapa.js
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
        // 1. BUSCAR LOCAIS (Mantido, incluindo a tabela associativa correta)
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

        // 2. BUSCAR ROTAS (Adaptado para a nova lógica onde Segmento aponta para Rota)
        const { data: dadosRotas, error: erroRotas } = await supabase
            .from('Rotas')
            .select(`
                id, nome, descricao, criado_em, is_public, cor,
                Rota_Categoria (
                    Categorias (id, nome, cor, simbolo)
                ),
                Segmento (
                    id,
                    ordem,
                    id_local1 (id, nome, posicao),
                    id_local2 (id, nome, posicao)
                )
            `)
            .eq('is_public', true);

        if (erroRotas) {
            console.error('❌ Erro ao buscar rotas:', erroRotas);
            throw erroRotas;
        }

        // --- FORMATAR LOCAIS ---
        const locaisFormatados = (dadosLocais || []).map((local) => {
            const categoriaRel = local.Local_Categoria?.[0]?.Categorias;
            
            let categoria = null;
            if (categoriaRel) {
                categoria = {
                    id: categoriaRel.id,
                    nome: categoriaRel.nome || 'Geral',
                    cor: categoriaRel.cor || '#979d23',
                    simbolo: categoriaRel.simbolo || '📍'
                };
            } else {
                const ehPraia = local.nome?.toLowerCase().includes('praia') || 
                               local.nome?.toLowerCase().includes('califórnia');
                categoria = ehPraia 
                    ? { id: null, nome: 'Praias', cor: '#23769d', simbolo: '🏖️' }
                    : { id: null, nome: 'Monumentos', cor: '#979d23', simbolo: '🏰' };
            }

            let posicaoFormatada = null;
            if (local.posicao) {
                if (typeof local.posicao === 'object') {
                    posicaoFormatada = local.posicao;
                } else if (typeof local.posicao === 'string') {
                    try { posicaoFormatada = JSON.parse(local.posicao); } catch (e) {}
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

        // --- FORMATAR ROTAS COM SEGMENTOS REAIS ---
        const rotasFormatadas = (dadosRotas || []).map((rota) => {
            const categoriaRel = rota.Rota_Categoria?.[0]?.Categorias;
            
            let categoria = categoriaRel ? {
                id: categoriaRel.id,
                nome: categoriaRel.nome || 'Trilho',
                cor: categoriaRel.cor || '#23769d',
                simbolo: categoriaRel.simbolo || '🧭'
            } : { id: null, nome: 'Trilho', cor: '#23769d', simbolo: '🧭' };

            // Ordena os segmentos pela coluna 'ordem' definida no banco
            const segmentosOrdenados = (rota.Segmento || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

            // Extrai a linha geométrica real baseada nos locais que compõem os segmentos da rota
            const caminhos = segmentosOrdenados.map(seg => {
                const loc1 = seg.id_local1;
                const loc2 = seg.id_local2;

                const parsePosicao = (pos) => {
                    if (!pos) return [-9.1015, 38.4445];
                    if (typeof pos === 'string') {
                        try { return JSON.parse(pos).coordinates; } catch { return [-9.1015, 38.4445]; }
                    }
                    return pos.coordinates || [-9.1015, 38.4445];
                };

                return {
                    id_segmento: seg.id,
                    ordem: seg.ordem,
                    ponto_A: { id: loc1?.id, nome: loc1?.nome, coordinates: parsePosicao(loc1?.posicao) },
                    ponto_B: { id: loc2?.id, nome: loc2?.nome, coordinates: parsePosicao(loc2?.posicao) }
                };
            });

            return {
                id: rota.id,
                nome: rota.nome,
                descricao: rota.descricao,
                criado_em: rota.criado_em,
                is_public: rota.is_public,
                cor: rota.cor,
                categoria: categoria,
                trajeto: caminhos // Agora contém os pontos geográficos reais mapeados por segmento!
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