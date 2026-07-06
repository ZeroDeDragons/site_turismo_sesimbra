export const MapEvents = {
    PONTO_SELECIONADO: 'mapa:ponto-selecionado',
    FOCAR_PONTO: 'mapa:focar-ponto',
    ATUALIZAR_PONTO: 'mapa:atualizar-ponto',
    
    // Novos eventos para o ciclo de edição de pontos do Admin
    ADMIN_INICIAR_EDICAO: 'mapa:admin-iniciar-edicao',
    ADMIN_CANCELAR_EDICAO: 'mapa:admin-cancelar-edicao',
    ADMIN_PONTO_REPOSICIONADO: 'mapa:admin-ponto-reposicionado',

    // Eventos do sistema multimodal de rotas
    ROTA_SELECIONADA: 'mapa:rota-selecionada',
    FOCO_ROTA: 'mapa:focar-rota',
    MODO_TRANSPORTE_ALTERADO: 'mapa:modo-transporte-alterado',
    INVERTER_ROTA: 'mapa:inverter-rota'
};

export function dispararEvento(nome, dados) {
    const evento = new CustomEvent(nome, { detail: dados, bubbles: true });
    window.dispatchEvent(evento);
}