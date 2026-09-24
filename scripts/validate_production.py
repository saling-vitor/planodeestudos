#!/usr/bin/env python3
from __future__ import annotations
import argparse, re, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REQUIRED_ROOT={
 "index.html","biblioteca.html","planejamento.html","edital.html","revisoes.html",
 "questoes.html","desempenho.html","arquivos.html","simulados.html","erros.html",
 "diagnostico.html","historico.html","configuracoes.html","creditos.html",
 "offline.html","404.html","manifest.webmanifest","service-worker.js",".nojekyll"
}
REQUIRED_CORE={
 "assets/css/pa-tokens-v01.css","assets/css/pa-components-v01.css","assets/css/pa-shell-v16.css",
 "assets/js/pa-pwa-v01.js","assets/js/pa-shell-v16.js","assets/js/pa-data-v03.js",
 "assets/js/pa-sync-v03.js","assets/js/pa-drive-v01.js","assets/js/pa-actions-v01.js",
 "data/navigation.js","data/contests.js","data/materials.js","data/exam-schemas.js",
 "data/question-catalog.js","data/review-catalog.js","data/simulations.js","data/cloud-config.js"
}
REF_RE=re.compile(r'''["'`](?!https?:|//|data:|mailto:|tel:|#)((?:\.{0,2}/)?[A-Za-z0-9_./-]+\.(?:html|js|css|webmanifest|json|md|pdf))(?:[?#][^"'\`]*)?["'`]''',re.I)
ID_RE=re.compile(r'''\bid=["']([^"']+)["']''',re.I)
SECRET_PATTERNS={
 "Google API key":re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
 "Google OAuth client":re.compile(r"[0-9]{8,}-[0-9A-Za-z_-]+\.apps\.googleusercontent\.com"),
 "Supabase publishable key":re.compile(r"sb_publishable_[A-Za-z0-9._-]{10,}"),
 "JWT":re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}")
}
PLACEHOLDER_ALLOW=("https://seu-projeto.supabase.co","sb_publishable_","AIza...","...apps.googleusercontent.com")

def norm_ref(source:Path, ref:str)->Path:
    if ref.startswith("./"): ref=ref[2:]
    return (source.parent/ref).resolve()

def main()->int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--strict",action="store_true",help="falha se o pacote completo de produção estiver ausente")
    args=ap.parse_args()
    errors=[]; warnings=[]
    for rel in sorted(REQUIRED_ROOT):
        if not (ROOT/rel).is_file(): errors.append(f"arquivo raiz ausente: {rel}")
    for rel in sorted(REQUIRED_CORE):
        if not (ROOT/rel).is_file():
            (errors if args.strict else warnings).append(f"dependência ausente: {rel}")

    htmls=sorted(ROOT.glob("*.html"))
    missing_refs={}
    for p in htmls:
        text=p.read_text("utf-8",errors="replace")
        ids=ID_RE.findall(text)
        dup=sorted({x for x in ids if ids.count(x)>1})
        if dup: errors.append(f"{p.name}: IDs duplicados: {', '.join(dup[:10])}")
        for ref in sorted(set(REF_RE.findall(text))):
            target=norm_ref(p,ref)
            try: target.relative_to(ROOT.resolve())
            except ValueError:
                errors.append(f"{p.name}: referência escapa da raiz: {ref}"); continue
            if not target.exists():
                missing_refs.setdefault(ref,set()).add(p.name)

    core_missing={rel for rel in REQUIRED_CORE if not (ROOT/rel).is_file()}
    for ref,sources in sorted(missing_refs.items()):
        if ref in core_missing:
            continue
        sample=", ".join(sorted(sources)[:4])
        suffix=f" +{len(sources)-4}" if len(sources)>4 else ""
        msg=f"referência local ausente: {ref} (usada por {len(sources)} página(s): {sample}{suffix})"
        (errors if args.strict else warnings).append(msg)

    scan_files=[p for p in ROOT.rglob("*") if p.is_file() and p.suffix.lower() in {".html",".js",".json",".md",".yml",".yaml",".css"}]
    for p in scan_files:
        text=p.read_text("utf-8",errors="ignore")
        for label,pat in SECRET_PATTERNS.items():
            for m in pat.finditer(text):
                token=m.group(0)
                if any(x in token for x in PLACEHOLDER_ALLOW): continue
                errors.append(f"{p.relative_to(ROOT)}: possível segredo ({label})")
                break

    maps=list((ROOT/"materials").glob("*.html")) if (ROOT/"materials").is_dir() else []
    sims=list((ROOT/"simulados").glob("*.html")) if (ROOT/"simulados").is_dir() else []
    if args.strict:
        if len(maps)!=14: errors.append(f"esperados 14 mapas; encontrados {len(maps)}")
        if len(sims)!=3: errors.append(f"esperados 3 simulados; encontrados {len(sims)}")
        for rel in ("scripts/build_materials_manifest.py","scripts/build_simulations_manifest.py","scripts/build_files_manifest.py","scripts/build_offline_pack.py","data/offline-pack.json"):
            if not (ROOT/rel).is_file(): errors.append(f"produção ausente: {rel}")

    print(f"Plano ARQ preflight | HTMLs={len(htmls)} | mapas={len(maps)} | simulados={len(sims)}")
    for w in warnings: print("AVISO:",w)
    for e in errors: print("ERRO:",e)
    if errors: return 1
    print("OK: validação concluída sem erros.")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
