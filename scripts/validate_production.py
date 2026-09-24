#!/usr/bin/env python3
from __future__ import annotations
import argparse,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

REQUIRED_ROOT={
 "index.html","biblioteca.html","planejamento.html","edital.html","revisoes.html",
 "questoes.html","desempenho.html","arquivos.html","simulados.html","erros.html",
 "diagnostico.html","historico.html","configuracoes.html","creditos.html",
 "offline.html","404.html","manifest.webmanifest","service-worker.js",".nojekyll"
}

SOURCE_REQUIRED={
 "data/contests.json","data/navigation.json","data/exam-schemas.json",
 "data/cloud-config.json","data/files-meta.json",
 "scripts/build_static_data.py","scripts/build_materials_manifest.py",
 "scripts/build_topic_catalogs.py","scripts/build_simulations_manifest.py",
 "scripts/build_files_manifest.py","scripts/build_offline_pack.py",
 "assets/css/pa-tokens-v01.css","assets/css/pa-components-v01.css",
 "assets/css/pa-shell-v16.css","assets/css/study-map-shared-v01.css",
 "assets/css/simulation-shared-v01.css",
 "assets/js/pa-pwa-v01.js","assets/js/pa-shell-v16.js",
 "assets/js/pa-data-v03.js","assets/js/pa-sync-v03.js",
 "assets/js/pa-drive-v01.js","assets/js/pa-actions-v01.js",
 "assets/js/pa-history-v01.js","assets/js/study-map-bootstrap-v01.js",
 "assets/js/simulation-runtime-v01.js",
 "assets/js/study-map-preconfig-v01.js","assets/js/study-map-runtime-v01.js",
 "assets/img/study-map-bg.png","assets/img/study-map-hero.jpg"
}

GENERATED={
 "data/contests.js","data/navigation.js","data/exam-schemas.js",
 "data/cloud-config.js","data/materials.js","data/materials.json",
 "data/question-catalog.js","data/question-catalog.json",
 "data/review-catalog.js","data/review-catalog.json",
 "data/simulations.js","data/simulations.json","data/files.js",
 "data/files.json","data/offline-pack.js","data/offline-pack.json"
}

REF_RE=re.compile(
 r'''["'`](?!https?:|//|data:|mailto:|tel:|#)((?:\.{0,2}/)?[A-Za-z0-9_./-]+\.(?:html|js|css|webmanifest|json|md|pdf|png|jpg|jpeg|webp))(?:[?#][^"'`]*)?["'`]''',
 re.I
)
ID_RE=re.compile(r'''(?<![\\w-])id=["']([^"']+)["']''',re.I)
TOPIC_ID_RE=re.compile(r'''(?<![\\w-])data-topic-id=["']([^"']+)["']''',re.I)
SECRET_PATTERNS={
 "Google API key":re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
 "Google OAuth client":re.compile(r"[0-9]{8,}-[0-9A-Za-z_-]+\.apps\.googleusercontent\.com"),
 "Supabase publishable key":re.compile(r"sb_publishable_[A-Za-z0-9._-]{10,}"),
 "JWT":re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}")
}
PLACEHOLDER_ALLOW=(
 "https://seu-projeto.supabase.co","sb_publishable_",
 "AIza...","...apps.googleusercontent.com"
)

MATERIAL_META_ALLOWED={
 "mindmap-storage-id","mindmap-storage-aliases",
 "plano-arq-bridge-version","plano-arq-contest-id",
 "plano-arq-legacy-storage-id","plano-arq-source-template",
 "study-display-title","study-short-title","study-short-code",
 "study-title-emoji","study-file-version","study-exam-board",
 "study-exam-contest","study-exam-date","study-library-group",
 "study-library-order"
}
MATERIAL_META_REQUIRED={
 "mindmap-storage-id","plano-arq-bridge-version","plano-arq-contest-id",
 "plano-arq-source-template","study-display-title","study-short-title",
 "study-short-code","study-title-emoji","study-file-version",
 "study-exam-board","study-exam-contest","study-exam-date",
 "study-library-group","study-library-order"
}
CUSTOM_META_PREFIXES=(
 "mindmap-","study-","plano-arq-","template-","touch-",
 "storage-","branch-","memory-","didactic-","cover-"
)

def norm_ref(source,ref):
    if ref.startswith("./"):
        ref=ref[2:]
    return (source.parent/ref).resolve()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--strict",action="store_true")
    args=ap.parse_args()
    errors=[]
    warnings=[]

    for rel in sorted(REQUIRED_ROOT):
        if not (ROOT/rel).is_file():
            errors.append(f"arquivo raiz ausente: {rel}")

    for rel in sorted(SOURCE_REQUIRED):
        if not (ROOT/rel).is_file():
            (errors if args.strict else warnings).append(
                f"fonte de produção ausente: {rel}"
            )

    for rel in sorted(GENERATED):
        if args.strict and not (ROOT/rel).is_file():
            errors.append(f"saída gerada ausente: {rel}")

    htmls=sorted(ROOT.glob("*.html"))
    missing={}

    for p in htmls:
        text=p.read_text("utf-8",errors="replace")
        ids=ID_RE.findall(text)
        dup=sorted({x for x in ids if ids.count(x)>1})
        if dup:
            errors.append(
                f"{p.name}: IDs duplicados: {', '.join(dup[:10])}"
            )

        for ref in sorted(set(REF_RE.findall(text))):
            target=norm_ref(p,ref)
            try:
                target.relative_to(ROOT.resolve())
            except ValueError:
                errors.append(
                    f"{p.name}: referência escapa da raiz: {ref}"
                )
                continue

            rel=target.relative_to(ROOT.resolve()).as_posix()
            if not target.exists() and not (
                not args.strict and rel in GENERATED
            ):
                missing.setdefault(rel,set()).add(p.name)

    for ref,sources in sorted(missing.items()):
        sample=", ".join(sorted(sources)[:4])
        suffix=f" +{len(sources)-4}" if len(sources)>4 else ""
        msg=(
            f"referência local ausente: {ref} "
            f"(usada por {len(sources)} página(s): {sample}{suffix})"
        )
        (errors if args.strict else warnings).append(msg)

    scan=[
        p for p in ROOT.rglob("*")
        if p.is_file()
        and p.suffix.lower() in {
            ".html",".js",".json",".md",".yml",".yaml",".css"
        }
    ]
    for p in scan:
        text=p.read_text("utf-8",errors="ignore")
        for label,pat in SECRET_PATTERNS.items():
            for m in pat.finditer(text):
                token=m.group(0)
                if any(x in token for x in PLACEHOLDER_ALLOW):
                    continue
                errors.append(
                    f"{p.relative_to(ROOT)}: possível segredo ({label})"
                )
                break

    maps=list((ROOT/"materials").glob("*.html")) if (ROOT/"materials").is_dir() else []
    sims=list((ROOT/"simulados").glob("*.html")) if (ROOT/"simulados").is_dir() else []

    if args.strict:
        if len(maps)!=14:
            errors.append(
                f"esperados 14 mapas; encontrados {len(maps)}"
            )
        if len(sims)!=3:
            errors.append(
                f"esperados 3 simulados; encontrados {len(sims)}"
            )

        for p in maps:
            text=p.read_text("utf-8",errors="ignore")
            meta_names=set(re.findall(
                r'<meta\\b[^>]*\\bname=["\\']([^"\\']+)["\\'][^>]*>',
                text,re.I
            ))
            missing_meta=sorted(MATERIAL_META_REQUIRED-meta_names)
            if missing_meta:
                errors.append(
                    f"{p.name}: metadados obrigatórios ausentes: {', '.join(missing_meta)}"
                )
            obsolete_meta=sorted(
                name for name in meta_names
                if name.startswith(CUSTOM_META_PREFIXES)
                and name not in MATERIAL_META_ALLOWED
            )
            if obsolete_meta:
                errors.append(
                    f"{p.name}: metadados de geração/legado ainda presentes: "
                    f"{', '.join(obsolete_meta[:8])}"
                    + (f" +{len(obsolete_meta)-8}" if len(obsolete_meta)>8 else "")
                )
            html_ids=ID_RE.findall(text)
            dup_html=sorted({x for x in html_ids if html_ids.count(x)>1})
            if dup_html:
                errors.append(
                    f"{p.name}: IDs HTML duplicados: {', '.join(dup_html[:10])}"
                )
            topic_ids=TOPIC_ID_RE.findall(text)
            dup_topics=sorted({x for x in topic_ids if topic_ids.count(x)>1})
            if dup_topics:
                errors.append(
                    f"{p.name}: data-topic-id duplicados: {', '.join(dup_topics[:10])}"
                )
            if not topic_ids:
                errors.append(f"{p.name}: nenhum data-topic-id encontrado")
            if "../assets/css/study-map-shared-v01.css" not in text:
                errors.append(
                    f"{p.name}: CSS compartilhado dos mapas não referenciado"
                )
            if "../assets/js/study-map-runtime-v01.js" not in text:
                errors.append(
                    f"{p.name}: runtime compartilhado dos mapas não referenciado"
                )
            if "data:image/jpeg;base64," in text:
                errors.append(
                    f"{p.name}: imagem hero ainda embutida em base64"
                )

        for p in sims:
            text=p.read_text("utf-8",errors="ignore")
            if "../assets/css/simulation-shared-v01.css" not in text:
                errors.append(
                    f"{p.name}: CSS compartilhado dos simulados não referenciado"
                )
            if "../assets/js/simulation-runtime-v01.js" not in text:
                errors.append(
                    f"{p.name}: runtime compartilhado dos simulados não referenciado"
                )
            if "FIM — ÁREA EDITÁVEL PELO GERADOR" in text:
                errors.append(
                    f"{p.name}: instruções internas do gerador ainda embarcadas"
                )

    print(
        f"Plano ARQ preflight | HTMLs={len(htmls)} | "
        f"mapas={len(maps)} | simulados={len(sims)}"
    )
    for w in warnings:
        print("AVISO:",w)
    for e in errors:
        print("ERRO:",e)

    if errors:
        return 1

    print("OK: validação concluída sem erros.")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
