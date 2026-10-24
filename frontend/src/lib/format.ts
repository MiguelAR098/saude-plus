export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const km = (v: number) => v.toFixed(1).replace(".", ",");

export const nota = (v: number) => v.toFixed(1).replace(".", ",");

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Caminho público de um arquivo de /public, respeitando o basePath (GitHub Pages). */
const RELATIVO = process.env.NEXT_PUBLIC_RELATIVE_ASSETS === "1";
export const publico = (caminho: string) => (RELATIVO ? "" : `${BASE}/`) + caminho.replace(/^\/+/, "");

export type Grupo = "pele" | "cabelo" | "bucal" | "corpo" | "infantil" | "cuidados" | "bem";

export function grupo(sub: string): Grupo {
  if (/infantil|lenco|kit-cuidados/.test(sub)) return "infantil";
  if (/shampoo|condicionador|mascara-capilar|cachos|leave-in/.test(sub)) return "cabelo";
  if (/dental|fio|enxaguante|bucal/.test(sub)) return "bucal";
  if (/sabonete|desodorante|depilacao|absorvente|banho|hastes/.test(sub)) return "corpo";
  if (/repelente|curativo|algodao|alcool|termometro|socorros|viagem/.test(sub)) return "cuidados";
  if (/sono|bolsa/.test(sub)) return "bem";
  return "pele";
}

export const SUBLABEL: Record<string, string> = {
  "hidratante-corporal-seca": "pele seca no corpo", "hidratante-corporal-diario": "hidratação diária",
  "hidratante-facial": "hidratação do rosto", "protetor-solar-facial": "proteção solar no rosto",
  "protetor-solar-corporal": "proteção solar no corpo", "limpeza-facial": "limpeza do rosto",
  demaquilante: "remover maquiagem", serum: "manchas leves", "protetor-labial": "lábios ressecados",
  "hidratante-maos": "mãos ressecadas", "pos-sol": "pós-sol", "shampoo-diario": "limpeza dos cabelos",
  "shampoo-anticaspa": "caspa", condicionador: "condicionamento", "mascara-capilar": "hidratação capilar",
  cachos: "cachos", "leave-in": "finalização", "creme-dental": "higiene bucal", "escova-dental": "escovação",
  "fio-dental": "limpeza entre os dentes", "enxaguante-bucal": "hálito fresco", "sabonete-liquido": "banho",
  "sabonete-barra": "banho", desodorante: "desodorante", depilacao: "depilação", absorvente: "higiene íntima",
  "sabonete-infantil": "banho do bebê", "shampoo-infantil": "cabelo infantil", "hidratante-infantil": "hidratação infantil",
  "lenco-umedecido": "troca de fraldas", "protetor-solar-infantil": "proteção solar infantil",
  "hastes-flexiveis": "higiene das orelhas", "creme-dental-infantil": "higiene bucal infantil", repelente: "repelente",
  curativos: "pequenos ferimentos", "algodao-gaze": "primeiros socorros", alcool: "higienização",
  termometro: "medir temperatura", "conforto-sono": "dormir melhor", "bolsa-termica": "conforto muscular",
};

export const rotuloSub = (sub: string) => SUBLABEL[sub] || (sub.startsWith("kit-") ? "kit" : sub.replace(/-/g, " "));
