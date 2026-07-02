import './mapa.css';

/**
 * Converte diferentes formatos de coordenadas para o padrão do Leaflet [lat, lng]
 * Suporta GeoJSON Point, objetos com chaves lat/lng ou Arrays simples.
 */
export function converterCoordenadas(pos) {
    if (!pos) return null;
    
    // Suporte ao padrão GeoJSON Point vindo do Supabase ([longitude, latitude])
    if (pos.type === 'Point' && Array.isArray(pos.coordinates)) {
        return [pos.coordinates[1], pos.coordinates[0]]; // Inverte para [latitude, longitude]
    }
    
    // Suporte a objetos com lat/lng, latitude/longitude ou Array direto [lat, lng]
    const lat = pos.lat ?? pos.latitude ?? (Array.isArray(pos) ? pos[0] : null);
    const lng = pos.lng ?? pos.longitude ?? (Array.isArray(pos) ? pos[1] : null);
    
    return (lat !== null && lng !== null) ? [Number(lat), Number(lng)] : null;
}

/**
 * Gera um ícone HTML customizado para o marcador do Leaflet usando a cor e símbolo da categoria
 */
export function gerarIconeLeaflet(cor, simbolo) {
    return L.divIcon({
        className: '',
        html: `<div class="marcador-mapa" style="background:${cor}">
                <span style="display: inline-block; transform: rotate(45deg);">${simbolo}</span>
            </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
    });
}