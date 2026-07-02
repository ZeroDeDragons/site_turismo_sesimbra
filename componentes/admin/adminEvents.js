const backupDadosOriginais = {
    local: new Map(),
    rota: new Map(),
    categoria: new Map()
};

export function dispararEventoAdmin(acao, entidade, dados) {
    const nomeEvento = `admin:${entidade}:${acao}`;

    if (acao === 'editar' && dados.id) {
        backupDadosOriginais[entidade].set(dados.id, JSON.parse(JSON.stringify(dados)));
        console.log(` Backup criado para ${entidade} ID ${dados.id}`);
    }

    const evento = new CustomEvent(nomeEvento, {
        detail: {
            entidade,
            acao,
            payload: dados,
            original: acao === 'reverter' ? backupDadosOriginais[entidade].get(dados.id) : null,
            timestamp: new Date()
        },
        bubbles: true
    });

    window.dispatchEvent(evento);
}

export function ouvirEventoAdmin(entidade, acao, callback) {
    window.addEventListener(`admin:${entidade}:${acao}`, (e) => callback(e.detail));
}

export function limparBackup(entidade, id) {
    backupDadosOriginais[entidade].delete(id);
    console.log(` Backup de ${entidade} ID ${id} liberado da memória.`);
}