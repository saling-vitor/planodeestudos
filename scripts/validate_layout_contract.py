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

for name in PAGES:
    path=ROOT/name
    if not path.is_file():
        errors.append(f"{name}: arquivo ausente")
        continue
    text=path.read_text("utf-8",errors="replace")
    for token in REQUIRED:
        if token not in text:
            errors.append(f"{name}: contrato do shell ausente: {token}")
    body=re.search(r'<body[^>]*data-pa-page=["\']([^"\']+)["\']',text,re.I)
    if not body:
        errors.append(f"{name}: data-pa-page ausente")
    else:
        key=body.group(1)
        if key in page_keys:
            errors.append(f"{name}: data-pa-page duplicado com {page_keys[key]}: {key}")
        page_keys[key]=name

    style_match=re.search(r'<style[^>]*>([\s\S]*?)</style>',text,re.I)
    inline=style_match.group(1) if style_match else ""
    for rx in FORBIDDEN_INLINE:
        if rx.search(inline):
            errors.append(
                f"{name}: geometria do shell redefinida inline ({rx.pattern}); use pa-shell-v16.css"
            )

    base_css=inline.split("@media",1)[0]
    for selector in sorted(SHARED_COMPONENT_SELECTORS):
        rx=re.compile(re.escape(selector)+r"\s*\{")
        if rx.search(base_css):
            errors.append(
                f"{name}: componente compartilhado redefinido localmente: {selector}"
            )

shell=(ROOT/"assets/css/pa-shell-v16.css")
if shell.is_file():
    css=shell.read_text("utf-8",errors="replace")
    for marker in (
        "PLANO ARQ · RÉGUA GRÁFICA MESTRE V01",
        "PLANO ARQ · RÉGUA GRÁFICA MESTRE V02",
        "PLANO ARQ · RÉGUA GRÁFICA MESTRE V03",
        "@media(max-width:900px)",
    ):
        if marker not in css:
            errors.append(f"pa-shell-v16.css: marcador do contrato ausente: {marker}")
else:
    errors.append("assets/css/pa-shell-v16.css ausente")

if errors:
    for e in errors:
        print("ERRO:",e)
    raise SystemExit(1)

print(f"Layout OK: {len(PAGES)} páginas internas seguem o shell compartilhado.")
