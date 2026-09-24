#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]

PAGES=[
    'index.html','planejamento.html','edital.html','biblioteca.html','revisoes.html',
    'questoes.html','simulados.html','erros.html','desempenho.html','diagnostico.html',
    'historico.html','arquivos.html','configuracoes.html','creditos.html','offline.html',
    'manifest.webmanifest'
]
CORE_ASSETS=[
    'assets/css/pa-tokens-v01.css','assets/css/pa-components-v01.css','assets/css/pa-shell-v16.css',
    'assets/js/pa-pwa-v01.js','assets/js/pa-shell-v16.js','assets/js/pa-data-v03.js',
    'assets/js/pa-sync-v03.js','assets/js/pa-drive-v01.js','assets/js/pa-actions-v01.js',
    'assets/js/pa-history-v01.js'
]
RUNTIME_DATA=[
    'data/navigation.js','data/contests.js','data/materials.js','data/exam-schemas.js',
    'data/question-catalog.js','data/review-catalog.js','data/simulations.js',
    'data/files.js','data/cloud-config.js'
]
FULL_DIRS=['materials','simulados','edital']
FULL_ASSET_DIRS=['assets/css','assets/js','assets/img']
EXCLUDE={'data/offline-pack.json','data/offline-pack.js'}

def entries(paths):
    out=[]
    for rel in sorted(dict.fromkeys(paths)):
        if rel in EXCLUDE:
            continue
        p=ROOT/rel
        if p.is_file():
            out.append({'path':rel,'bytes':p.stat().st_size})
    return out

def add_tree(paths,folder):
    base=ROOT/folder
    if not base.exists():
        return
    for p in base.rglob('*'):
        if p.is_file():
            paths.append(p.relative_to(ROOT).as_posix())

essential=PAGES+CORE_ASSETS+RUNTIME_DATA
full=list(essential)
for d in FULL_ASSET_DIRS+FULL_DIRS:
    add_tree(full,d)

payload={'schema':1,'version':'19.1-production','essential':entries(essential),'full':entries(full)}
payload['essentialBytes']=sum(x['bytes'] for x in payload['essential'])
payload['fullBytes']=sum(x['bytes'] for x in payload['full'])

(ROOT/'data/offline-pack.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'data/offline-pack.js').write_text('window.PLANO_ARQ_OFFLINE_PACK='+json.dumps(payload,ensure_ascii=False)+';\n',encoding='utf-8')
print(f"essential={len(payload['essential'])} ({payload['essentialBytes']} bytes) full={len(payload['full'])} ({payload['fullBytes']} bytes)")
