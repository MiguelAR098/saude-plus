"""Gera uma imagem de embalagem ilustrada para cada produto do catálogo.

Os produtos são sintéticos (marcas fictícias), então não há foto real: cada item
ganha uma embalagem desenhada conforme o tipo (frasco, bisnaga, pote, spray...),
com marca, nome e tamanho no rótulo. Saída: public/assets/produtos/<id>.png,
o mesmo caminho do campo "imagem" em data/produtos.json.

Uso (na pasta frontend/):
    pip install playwright && python -m playwright install chromium
    python scripts/gerar_imagens.py ../data/produtos.json
"""
import asyncio
import hashlib
import html
import json
import re
import sys
from pathlib import Path

SAIDA = Path(__file__).resolve().parents[1] / "public" / "assets" / "produtos"
W = H = 480

# Cor do rótulo por marca (marcas fictícias; Dauf com a cor de marca própria do design system)
MARCAS = {
    "Dauf": "#7A3FC2", "Aurora Derm": "#C0577E", "Vitalle": "#2E8B57", "Naturalis": "#6B8E23", "HidraMais": "#1E88E5",
    "Brisa": "#00A3B4", "Lumina": "#E0A100", "ClearSkin": "#3F7FBF", "DermaVida": "#8E6CC0", "Solare": "#F57C00",
    "Verdi": "#4E9A47", "Sorriso Pleno": "#0097A7", "Cuide+": "#0054A5", "Kidz Care": "#EC6A9A", "Nuvem": "#7FA7D9",
    "FlexCare": "#D84343", "Equilibra": "#5C6BC0", "Ondas": "#26A69A",
}
FUNDO = {
    "pele": ("#EAF2FF", "#D6E5FF"), "cabelo": ("#F4EDFC", "#E6D9F7"), "bucal": ("#E6F7F0", "#CFEFE2"),
    "corpo": ("#FFF3E8", "#FFE4CC"), "infantil": ("#FFF0F6", "#FFDCEB"), "cuidados": ("#FFEEF1", "#FFD9DF"),
    "bem": ("#EEF0FF", "#DCE0FF"), "kits": ("#F1F3F8", "#E2E6F1"),
}


def grupo(p: dict) -> str:
    sub = p["subcategoria"]
    if sub.startswith("kit-"):
        return "kits"
    if p.get("faixa_etaria") == "infantil":
        return "infantil"
    if re.search(r"shampoo|condicionador|mascara-capilar|cachos|leave-in", sub):
        return "cabelo"
    if re.search(r"dental|fio|enxaguante", sub):
        return "bucal"
    if re.search(r"sabonete|desodorante|depilacao|absorvente|hastes", sub):
        return "corpo"
    if re.search(r"repelente|curativo|algodao|alcool|termometro", sub):
        return "cuidados"
    if re.search(r"sono|bolsa", sub):
        return "bem"
    return "pele"


def formato(p: dict) -> str:
    n, sub = p["nome"].lower(), p["subcategoria"]
    if sub.startswith("kit-"):
        return "caixa"
    if "roll-on" in n:
        return "rollon"
    if "aerossol" in n or "spray" in n or ("desodorante" in sub and "antitranspirante" in n):
        return "spray"
    if sub == "protetor-labial":
        return "bastao"
    if sub == "serum" or "sérum" in n:
        return "conta_gotas"
    if sub == "sabonete-barra":
        return "barra"
    if sub == "termometro":
        return "termometro"
    if sub == "bolsa-termica":
        return "bolsa"
    if sub == "escova-dental":
        return "escova"
    if sub in ("curativos", "absorvente", "hastes-flexiveis", "algodao-gaze", "fio-dental", "conforto-sono"):
        return "caixa"
    if sub == "lenco-umedecido" or "lenços" in n:
        return "pacote"
    if sub == "depilacao" and ("lâmina" in n or "aparelho" in n):
        return "caixa"
    if sub in ("mascara-capilar",) or re.search(r"\b(pote|creme pele sensível|cera fria)\b", n) or p["tamanho"].endswith(" g") and sub in ("hidratante-infantil", "depilacao"):
        return "pote"
    if sub in ("hidratante-facial", "protetor-solar-facial", "limpeza-facial", "creme-dental", "creme-dental-infantil",
               "hidratante-maos", "cachos") and not "água" in n:
        return "bisnaga"
    if sub in ("hidratante-corporal-seca", "hidratante-corporal-diario", "sabonete-liquido", "shampoo-diario",
               "shampoo-anticaspa", "condicionador", "sabonete-infantil", "shampoo-infantil", "hidratante-infantil"):
        return "valvula"
    return "frasco"


def linhas(texto: str, largura: int, maximo: int) -> list:
    palavras, out, atual = texto.split(), [], ""
    for p in palavras:
        if len(atual) + len(p) + 1 <= largura or not atual:
            atual = (atual + " " + p).strip()
        else:
            out.append(atual)
            atual = p
    if atual:
        out.append(atual)
    if len(out) > maximo:
        out = out[:maximo]
        out[-1] = out[-1].rstrip(".,") + "…"
    return out


def titulo(p: dict) -> str:
    t = p["nome"]
    t = re.sub(r"\s*\(.*?\)", "", t)  # kits: remove a lista de itens
    t = t.replace(p["tamanho"], "").strip()
    t = re.sub(r"^(Depilação|Conforto para Dormir)\s+", "", t)
    return t


def rotulo(cx: float, y: float, w: float, h: float, p: dict, cor: str, escala: float = 1.0) -> str:
    """Rótulo branco com marca, nome e tamanho, centralizado em cx."""
    marca = html.escape(p["marca"])
    fs = 15 * escala
    largura_chars = max(8, int(w / (fs * 0.56)))
    nome = linhas(titulo(p), largura_chars, 3)
    t = [f'<rect x="{cx - w/2}" y="{y}" width="{w}" height="{h}" rx="{10*escala}" fill="#fff" opacity=".96"/>',
         f'<rect x="{cx - w/2}" y="{y}" width="{w}" height="{26*escala}" rx="{10*escala}" fill="{cor}"/>',
         f'<rect x="{cx - w/2}" y="{y + 16*escala}" width="{w}" height="{10*escala}" fill="{cor}"/>',
         f'<text x="{cx}" y="{y + 18*escala}" font-size="{12.5*escala}" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing=".5">{marca.upper()}</text>']
    ty = y + 26 * escala + (h - 26 * escala - len(nome) * fs * 1.15 - 16 * escala) / 2 + fs
    for i, ln in enumerate(nome):
        t.append(f'<text x="{cx}" y="{ty + i*fs*1.15}" font-size="{fs}" font-weight="700" fill="#1B2140" text-anchor="middle">{html.escape(ln)}</text>')
    t.append(f'<text x="{cx}" y="{y + h - 8*escala}" font-size="{11*escala}" font-weight="700" fill="{cor}" text-anchor="middle">{html.escape(p["tamanho"])}</text>')
    return "".join(t)


def corpo(fmt: str, p: dict, cor: str) -> str:
    c = cor
    claro = "#ffffff"
    sombra = '<ellipse cx="240" cy="430" rx="{rx}" ry="12" fill="#0E1430" opacity=".10"/>'
    if fmt == "valvula":
        return (sombra.format(rx=95) +
                f'<rect x="222" y="58" width="36" height="26" rx="5" fill="#2B2F45"/><rect x="232" y="44" width="70" height="16" rx="6" fill="#2B2F45"/>'
                f'<rect x="210" y="82" width="60" height="30" rx="8" fill="#3A3F5C"/>'
                f'<rect x="150" y="108" width="180" height="322" rx="40" fill="{c}"/>'
                f'<rect x="162" y="120" width="22" height="290" rx="11" fill="{claro}" opacity=".18"/>'
                + rotulo(240, 180, 150, 190, p, c))
    if fmt == "frasco":
        return (sombra.format(rx=85) +
                f'<rect x="200" y="62" width="80" height="54" rx="12" fill="#2B2F45"/>'
                f'<path d="M165 150 Q165 112 205 112 H275 Q315 112 315 150 V408 Q315 430 293 430 H187 Q165 430 165 408 Z" fill="{c}"/>'
                f'<rect x="176" y="130" width="18" height="280" rx="9" fill="{claro}" opacity=".18"/>'
                + rotulo(240, 190, 134, 180, p, c, .95))
    if fmt == "bisnaga":
        return (sombra.format(rx=80) +
                f'<path d="M168 70 H312 L300 360 Q298 372 286 372 H194 Q182 372 180 360 Z" fill="{c}"/>'
                f'<rect x="160" y="58" width="160" height="22" rx="4" fill="{c}" opacity=".75"/>'
                f'<rect x="206" y="372" width="68" height="58" rx="10" fill="#2B2F45"/>'
                f'<rect x="182" y="84" width="14" height="260" rx="7" fill="{claro}" opacity=".2"/>'
                + rotulo(240, 140, 112, 175, p, c, .85))
    if fmt == "pote":
        return (sombra.format(rx=120) +
                f'<rect x="120" y="170" width="240" height="70" rx="18" fill="#2B2F45"/>'
                f'<rect x="128" y="228" width="224" height="200" rx="28" fill="{c}"/>'
                f'<rect x="140" y="240" width="18" height="170" rx="9" fill="{claro}" opacity=".18"/>'
                + rotulo(240, 248, 180, 160, p, c, .9))
    if fmt == "conta_gotas":
        return (sombra.format(rx=70) +
                f'<rect x="222" y="60" width="36" height="70" rx="18" fill="#2B2F45"/>'
                f'<rect x="205" y="122" width="70" height="40" rx="8" fill="#C9A66B"/>'
                f'<rect x="170" y="158" width="140" height="272" rx="26" fill="{c}"/>'
                f'<rect x="180" y="170" width="14" height="240" rx="7" fill="{claro}" opacity=".2"/>'
                + rotulo(240, 210, 116, 170, p, c, .85))
    if fmt == "spray":
        return (sombra.format(rx=75) +
                f'<rect x="200" y="56" width="80" height="60" rx="18" fill="#2B2F45"/>'
                f'<rect x="174" y="110" width="132" height="320" rx="30" fill="{c}"/>'
                f'<rect x="186" y="124" width="14" height="290" rx="7" fill="{claro}" opacity=".22"/>'
                + rotulo(240, 180, 112, 190, p, c, .85))
    if fmt == "rollon":
        return (sombra.format(rx=70) +
                f'<rect x="190" y="70" width="100" height="110" rx="40" fill="#2B2F45"/>'
                f'<path d="M180 180 H300 V400 Q300 430 270 430 H210 Q180 430 180 400 Z" fill="{c}"/>'
                + rotulo(240, 210, 104, 170, p, c, .8))
    if fmt == "bastao":
        return (sombra.format(rx=55) +
                f'<rect x="200" y="90" width="80" height="120" rx="14" fill="#2B2F45"/>'
                f'<rect x="196" y="200" width="88" height="230" rx="14" fill="{c}"/>'
                + rotulo(240, 230, 76, 170, p, c, .62))
    if fmt == "barra":
        return (sombra.format(rx=150) +
                f'<rect x="90" y="190" width="300" height="200" rx="26" fill="{c}"/>'
                f'<rect x="90" y="190" width="300" height="200" rx="26" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="6"/>'
                + rotulo(240, 215, 230, 150, p, c, 1))
    if fmt == "pacote":
        return (sombra.format(rx=155) +
                f'<rect x="85" y="150" width="310" height="270" rx="40" fill="{c}"/>'
                f'<ellipse cx="240" cy="190" rx="80" ry="22" fill="#fff" opacity=".85"/>'
                + rotulo(240, 230, 230, 160, p, c, 1))
    if fmt == "escova":
        return (sombra.format(rx=110) +
                f'<rect x="120" y="80" width="240" height="350" rx="20" fill="{c}"/>'
                f'<rect x="150" y="100" width="180" height="120" rx="14" fill="#fff" opacity=".9"/>'
                f'<rect x="232" y="112" width="16" height="100" rx="8" fill="{c}"/><rect x="226" y="112" width="28" height="30" rx="6" fill="#9FD8FF"/>'
                + rotulo(240, 240, 190, 165, p, c, .9))
    if fmt == "termometro":
        return (sombra.format(rx=90) +
                f'<rect x="200" y="70" width="80" height="330" rx="40" fill="{c}"/>'
                f'<rect x="215" y="110" width="50" height="70" rx="10" fill="#DFF5FF"/>'
                f'<text x="240" y="155" font-size="22" font-weight="800" fill="#1B2140" text-anchor="middle">36,5</text>'
                f'<rect x="232" y="380" width="16" height="50" rx="8" fill="#9AA3BF"/>'
                + rotulo(240, 200, 74, 160, p, c, .6))
    if fmt == "bolsa":
        return (sombra.format(rx=140) +
                f'<rect x="100" y="120" width="280" height="300" rx="70" fill="{c}"/>'
                f'<rect x="210" y="80" width="60" height="50" rx="10" fill="#2B2F45"/>'
                + rotulo(240, 200, 200, 150, p, c, .95))
    # caixa (kits e itens embalados)
    return (sombra.format(rx=150) +
            f'<path d="M110 150 L240 110 L370 150 L240 190 Z" fill="{c}" opacity=".75"/>'
            f'<path d="M110 150 L240 190 V430 L110 390 Z" fill="{c}"/>'
            f'<path d="M370 150 L240 190 V430 L370 390 Z" fill="{c}" opacity=".85"/>'
            + rotulo(240, 220, 200, 165, p, c, .95))


def svg(p: dict) -> str:
    cor = MARCAS.get(p["marca"]) or "#" + hashlib.md5(p["marca"].encode()).hexdigest()[:6]
    a, b = FUNDO[grupo(p)]
    selo = ('<g><rect x="338" y="20" width="124" height="32" rx="16" fill="#7A3FC2"/>'
            '<text x="400" y="41" font-size="13" font-weight="800" fill="#fff" text-anchor="middle">Marca própria</text></g>'
            if p.get("marca_propria") else "")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
            f'font-family="Nunito Sans, DejaVu Sans, Arial, sans-serif">'
            f'<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></radialGradient></defs>'
            f'<rect width="{W}" height="{H}" fill="url(#g)"/>'
            f'{corpo(formato(p), p, cor)}{selo}</svg>')


async def main(caminho: str) -> None:
    from playwright.async_api import async_playwright
    produtos = json.loads(Path(caminho).read_text(encoding="utf-8"))
    SAIDA.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        nav = await pw.chromium.launch()
        pg = await nav.new_page(viewport={"width": W, "height": H})
        for p in produtos:
            await pg.set_content(f'<html><body style="margin:0">{svg(p)}</body></html>')
            await pg.screenshot(path=str(SAIDA / f'{p["id"]}.png'), clip={"x": 0, "y": 0, "width": W, "height": H})
        await nav.close()
    print(f"{len(produtos)} imagens em {SAIDA}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "../data/produtos.json"))
