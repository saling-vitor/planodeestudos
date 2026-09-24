#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
PAGES=[
    "planejamento.html","edital.html","biblioteca.html","revisoes.html",
    "questoes.html","simulados.html","erros.html","desempenho.html",
    "diagnostico.html","historico.html","arquivos.html","configuracoes.html"
]
REQUIRED=[
    'assets/css/pa-tokens-v01.css',
    'assets/css/pa-shell-v16.css',
    'assets/css/pa-components-v01.css',
    'assets/js/pa-shell-v16.js',
    'class="pa-main"',
    'class="pa-content"',
    'class="pa-topbar"',
]
FORBIDDEN_INLINE=[
    re.compile(r'\.pa-content\s*\{'),
    re.compile(r'\.pa-topbar\s*\{'),
    re.compile(r'\.pa-sidebar\s*\{'),
]
SHARED_COMPONENT_SELECTORS={
    ".eyebrow",".primary-btn",".ghost-btn",".icon-btn",
    ".section-head",".section-head h2",".section-head span",
    ".section-head>span",".empty",".empty strong"
}
errors=[]
page_keys={}
HERO_FAMILIES={
    "planning":("direct",3),"edital":("direct",3),"maps":("direct",3),
    "files":("direct",3),"settings":("direct",3),
    "reviews":("direct",4),"questions":("direct",4),"performance":("direct",4),
    "simulations":("nested",4),"errors":("nested",4),
    "diagnostic":("nested",4),"history":("nested",4),
}

for name in PAGES:
    path=ROOT/name
    if not path.is_file():
        errors.append(f"{name}: arquivo ausente")
        continue
    text=path.read_text("utf-8",errors="replace")
    for token in REQUIRED:
        if token not in text:
            errors.append(f"{name}: contrato do shell ausente: {token}")
    content_open=re.search(r'class=["\']pa-content["\'][^>]*>\s*<section\s+class=["\'](?:hero|page-hero)["\']',text,re.I)
    if not content_open:
        errors.append(
            f"{name}: hero deve ser filho direto de .pa-content; remova wrappers geométricos intermediários"
        )

    sidebar=re.search(r'<aside\s+class=["\']pa-sidebar["\'][^>]*>([\s\S]*?)</aside>',text,re.I)
    if not sidebar:
        errors.append(f"{name}: .pa-sidebar ausente")
    elif sidebar.group(1).strip():
        errors.append(
            f"{name}: sidebar hardcoded detectada; o menu deve ser gerado somente por pa-shell-v16.js"
        )

    topbar=re.search(r'<header\s+class=["\']pa-topbar["\']>([\s\S]*?)</header>',text,re.I)
    if not topbar:
        errors.append(f"{name}: .pa-topbar ausente")
    else:
        top=topbar.group(1)
        if len(re.findall(r'\bpa-menu-btn\b',top)) != 1:
            errors.append(f"{name}: topbar deve ter exatamente um pa-menu-btn")
        if len(re.findall(r'\bpa-top-title\b',top)) != 1:
            errors.append(f"{name}: topbar deve ter exatamente um pa-top-title")
        if len(re.findall(r'\bpa-top-actions\b',top)) != 1:
            errors.append(f"{name}: topbar deve ter exatamente uma pa-top-actions")
        dot=re.search(r'<button[^>]*class=["\']([^"\']*)["\'][^>]*>\s*•••\s*</button>',top,re.I)
        if not dot or "icon-btn" not in dot.group(1).split():
            errors.append(f"{name}: botão ••• da topbar deve usar icon-btn")

    body=re.search(r'<body[^>]*data-pa-page=["\']([^"\']+)["\']',text,re.I)
    if not body:
        errors.append(f"{name}: data-pa-page ausente")
    else:
        key=body.group(1)
        if key in page_keys:
            errors.append(f"{name}: data-pa-page duplicado com {page_keys[key]}: {key}")
        page_keys[key]=name

        family=HERO_FAMILIES.get(key)
        hero_match=re.search(r'<section\s+class=["\'](?:hero|page-hero)["\']>([\s\S]*?)</section>',text,re.I)
        if not hero_match:
            errors.append(f"{name}: bloco hero não encontrado")
        elif family:
            hero=hero_match.group(1)
            metric_count=len(re.findall(r'<article\s+class=["\'][^"\']*\b(?:metric|stat)\b[^"\']*["\']',hero,re.I))
            nested=bool(re.search(r'class=["\'](?:summary-grid|metric-grid|history-metrics)["\']',hero,re.I))
            expected_kind,expected_count=family
            if metric_count != expected_count:
                errors.append(
                    f"{name}: hero deveria ter {expected_count} métricas; encontrado {metric_count}"
                )
            if expected_kind=="nested" and not nested:
                errors.append(f"{name}: hero deveria usar wrapper de métricas aninhado")
            if expected_kind=="direct" and nested:
                errors.append(f"{name}: hero direto não deve usar wrapper de métricas aninhado")

    style_match=re.search(r'<style[^>]*>([\s\S]*?)</style>',text,re.I)
    inline=style_match.group(1) if style_match else ""
    for rx in FORBIDDEN_INLINE:
        if rx.search(inline):
            errors.append(
                f"{name}: geometria do shell redefinida inline ({rx.pattern}); use pa-shell-v16.css"
            )

    if re.search(r"querySelectorAll\(['\"]\.pa-nav-item",text):
        errors.append(f"{name}: navegação lateral manual duplicada; use pa-shell-v16.js")
    if re.search(r"(?:menuBtn|sidebar|backdrop).{0,80}(?:addEventListener|\.onclick)",text,re.S):
        errors.append(f"{name}: controlador local de drawer/menu detectado; use pa-shell-v16.js")

    base_css=inline.split("@media",1)[0]
    legacy_root=re.search(r':root\s*\{[^}]*--(?:bg|surface|text|muted|champ|blue|green|red|yellow|line|sans|cond|mono)\s*:',base_css,re.I)
    if legacy_root:
        errors.append(
            f"{name}: tokens visuais base redefinidos localmente; use pa-tokens-v01.css"
        )

    for selector in sorted(SHARED_COMPONENT_SELECTORS):
        rx=re.compile(re.escape(selector)+r"\s*\{")
        if rx.search(base_css):
            errors.append(
                f"{name}: componente compartilhado redefinido localmente: {selector}"
            )

# Ordem canônica: CSS local primeiro; sistema compartilhado por último.
for name in PAGES:
    text=(ROOT/name).read_text("utf-8",errors="replace")
    style_end=text.lower().find("</style>")
    token_pos=text.find("assets/css/pa-tokens-v01.css")
    shell_pos=text.find("assets/css/pa-shell-v16.css")
    comp_pos=text.find("assets/css/pa-components-v01.css")
    if min(style_end,token_pos,shell_pos,comp_pos) < 0:
        errors.append(f"{name}: não foi possível validar a ordem da cascata CSS")
    elif not (style_end < token_pos < shell_pos < comp_pos):
        errors.append(
            f"{name}: ordem CSS inválida; esperado <style> local -> tokens -> shell -> components"
        )

# Hoje é renderizado dinamicamente, mas deve obedecer ao mesmo shell.
home=(ROOT/"index.html")
if home.is_file():
    home_text=home.read_text("utf-8",errors="replace")
    if '<aside class="pa-sidebar" id="paSidebar"></aside>' not in home_text:
        errors.append("index.html: Hoje deve renderizar sidebar vazia para o shell compartilhado")
    for legacy_id in (
        "sidePlan","sideEdital","sideMaps","sideReviews","sideQuestions",
        "sidePerformance","sideFiles","switchContest","settingsBtn"
    ):
        if legacy_id in home_text:
            errors.append(f"index.html: navegação legada detectada em Hoje: {legacy_id}")
    if re.search(r'openSide|closeSide|innerWidth\s*<=\s*820',home_text):
        errors.append("index.html: controlador de drawer legado detectado em Hoje")
    style_end=home_text.lower().find("</style>")
    token_pos=home_text.find("assets/css/pa-tokens-v01.css")
    shell_pos=home_text.find("assets/css/pa-shell-v16.css")
    comp_pos=home_text.find("assets/css/pa-components-v01.css")
    if min(style_end,token_pos,shell_pos,comp_pos)<0 or not (style_end < token_pos < shell_pos < comp_pos):
        errors.append("index.html: ordem CSS inválida; esperado <style> local -> tokens -> shell -> components")
else:
    errors.append("index.html ausente")

shell=(ROOT/"assets/css/pa-shell-v16.css")
if shell.is_file():
    css=shell.read_text("utf-8",errors="replace")
    required_shell=(
        "Shell canônico de produção",
        "--pa-shell-sidebar:276px",
        "--pa-shell-content-max:1420px",
        "@media(max-width:900px)",
        ".pa-mobile-more.open",
    )
    for marker in required_shell:
        if marker not in css:
            errors.append(f"pa-shell-v16.css: contrato canônico ausente: {marker}")
    if re.search(r"RÉGUA GRÁFICA MESTRE V\\d+",css,re.I):
        errors.append("pa-shell-v16.css: camada histórica Vxx detectada")
    if len(css) > 30000:
        errors.append(f"pa-shell-v16.css: tamanho excessivo ({len(css)} bytes); possível acúmulo de camadas")
else:
    errors.append("assets/css/pa-shell-v16.css ausente")

components=(ROOT/"assets/css/pa-components-v01.css")
if components.is_file():
    component_css=components.read_text("utf-8",errors="replace")
    if "Componentes canônicos de produção" not in component_css:
        errors.append("pa-components-v01.css: marcador canônico ausente")
    if re.search(r"COMPONENTES DE PRODUÇÃO V\\d+",component_css,re.I):
        errors.append("pa-components-v01.css: camada histórica Vxx detectada")
    if len(component_css) > 12000:
        errors.append(
            f"pa-components-v01.css: tamanho excessivo ({len(component_css)} bytes); possível acúmulo de camadas"
        )
else:
    errors.append("assets/css/pa-components-v01.css ausente")

if errors:
    for e in errors:
        print("ERRO:",e)
    raise SystemExit(1)

print(f"Layout OK: {len(PAGES)} páginas internas seguem o shell compartilhado.")
