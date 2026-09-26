#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
PAGES=("configuracoes.html","biblioteca.html")
errors=[]
report={}

for name in PAGES:
    text=(ROOT/name).read_text("utf-8",errors="replace")
    uses_context="assets/js/pa-contest-context-v01.js" in text
    context_calls=len(re.findall(r"PLANO_ARQ_CONTEST_CONTEXT|\bC\.(?:resolveId|contests|current)\b",text))
    duplicate_storage="JSON.parse(localStorage.getItem('planoarq:contests:v1')" in text
    duplicate_seed=bool(re.search(r"PLANO_ARQ_CONTESTS\?\.contests.*new Map",text))
    if not uses_context:
        errors.append(f"{name}: módulo pa-contest-context-v01.js ausente")
    if context_calls<1:
        errors.append(f"{name}: módulo de contexto carregado mas não utilizado")
    if duplicate_storage or duplicate_seed:
        errors.append(f"{name}: reimplementa mesclagem de concursos já fornecida por pa-contest-context-v01.js")
    inline=sum(len(m.group(2)) for m in re.finditer(r"<script\b([^>]*)>([\s\S]*?)</script>",text,re.I) if not re.search(r"\bsrc\s*=",m.group(1) or ""))
    report[name]={
        "contextCalls":context_calls,
        "duplicateContestMerge":duplicate_storage or duplicate_seed,
        "inlineJsChars":inline,
    }

shell=(ROOT/"assets/js/pa-shell-v16.js").read_text("utf-8",errors="replace")
shell_delegates="PLANO_ARQ_CONTEST_CONTEXT?.contests?.()" in shell
report["pa-shell-v16.js"]={"shellDelegatesContestContext":shell_delegates}
if not shell_delegates:
    errors.append("pa-shell-v16.js: deve delegar contests() ao módulo de contexto quando disponível")

print("portal-inline-audit",report)
if errors:
    for e in errors:
        print("ERRO:",e)
    raise SystemExit(1)
