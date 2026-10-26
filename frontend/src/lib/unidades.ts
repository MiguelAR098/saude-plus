import type { Unidade } from "./types";

/**
 * Unidades SIMULADAS ao redor da posição do cliente.
 * Em produção, este módulo é trocado por uma chamada à API de lojas da rede (mesma interface Unidade).
 */
const BAIRROS = ["Centro", "Boa Vista", "Graças", "Espinheiro", "Casa Forte", "Madalena", "Torre"];
const DESLOCAMENTOS_KM: [number, number][] = [[0.55, 0.3], [-0.9, 0.7], [1.4, -1.1], [-1.9, -0.5], [2.4, 1.6], [-0.4, -2.6], [3.2, -0.4]];

export const CENTRO_PADRAO = { lat: -8.0631, lng: -34.8711 }; // Recife, usado quando o cliente não libera a localização

export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function unidadesProximas(c: { lat: number; lng: number }): Unidade[] {
  const kLat = 1 / 110.6;
  const kLng = 1 / (111.3 * Math.cos((c.lat * Math.PI) / 180));
  return DESLOCAMENTOS_KM.map(([dx, dy], i) => {
    const u = { id: `u${i}`, nome: `Unidade ${BAIRROS[i]}`, lat: c.lat + dy * kLat, lng: c.lng + dx * kLng, dx, dy, h24: i % 3 === 0, km: 0 };
    u.km = distanciaKm(c, u);
    return u;
  }).sort((a, b) => a.km - b.km);
}

export function obterPosicao(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });
}
