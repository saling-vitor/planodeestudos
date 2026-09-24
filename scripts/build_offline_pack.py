#!/usr/bin/env python3
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
ESSENTIAL=[
"index.html","planejamento.html","edital.html","biblioteca.html","revisoes.html","questoes.html","simulados.html","erros.html","desempenho.html","diagnostico.html","historico.html","arquivos.html","configuracoes.html","creditos.html","offline.html","manifest.webmanifest"
]
PREFIXES=["assets/css/","assets/js/","data/"]
FULL_DIRS=["materials","simulados","edital"]
EXCLUDE={"data/offline-pack.json","data/offline-pack.js"}

def entries(paths):
    out=[]
    for rel in sorted(dict.fromkeys(paths)):
        p=ROOT/rel
        if not p.is_file() or rel in EXCLUDE: continue
        out.append({"path":rel,"bytes":p.stat().st_size})
    return out

essential=list(ESSENTIAL)
for pref in PREFIXES:
    base=ROOT/pref
    if base.exists():
        for p in base.rglob('*'):
            if p.is_file(): essential.append(p.relative_to(ROOT).as_posix())
full=list(essential)
for d in FULL_DIRS:
    base=ROOT/d
    if base.exists():
        for p in base.rglob('*'):
            if p.is_file(): full.append(p.relative_to(ROOT).as_posix())
payload={"schema":1,"version":"18.0-production","essential":entries(essential),"full":entries(full)}
payload["essentialBytes"]=sum(x["bytes"] for x in payload["essential"])
payload["fullBytes"]=sum(x["bytes"] for x in payload["full"])
(ROOT/'data/offline-pack.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'data/offline-pack.js').write_text('window.PLANO_ARQ_OFFLINE_PACK='+json.dumps(payload,ensure_ascii=False)+';\n',encoding='utf-8')
print(f"essential={len(payload['essential'])} ({payload['essentialBytes']} bytes) full={len(payload['full'])} ({payload['fullBytes']} bytes)")
