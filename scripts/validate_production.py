#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,re
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
 "plano-arq-bridge-version","plano-arq-contest-id","plano-arq-map-id","plano-arq-blueprint-signature",
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

def meta_content(text,name):
    for tag in re.findall(r"<meta\b[^>]*>",text,re.I):
        n=re.search(r"\bname=['\"]([^'\"]+)['\"]",tag,re.I)
        if not n or n.group(1)!=name:
            continue
        c=re.search(r"\bcontent=['\"]([^'\"]*)['\"]",tag,re.I)
        return c.group(1).strip() if c else ""
    return ""

def head_text_residue(text):
    m=re.search(r"<head\b[^>]*>([\s\S]*?)</head>",text,re.I)
    if not m:
        return "__HEAD_AUSENTE__"
    head=m.group(1)
    head=re.sub(r"<title\b[^>]*>[\s\S]*?</title>","",head,flags=re.I)
    head=re.sub(r"<script\b[^>]*>[\s\S]*?</script>","",head,flags=re.I)
    head=re.sub(r"<style\b[^>]*>[\s\S]*?</style>","",head,flags=re.I)
    head=re.sub(r"<!--[\s\S]*?-->","",head)
    head=re.sub(r"<[^>]+>","",head)
    return " ".join(head.split())


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
                rel=p.relative_to(ROOT).as_posix()
                if any(x in token for x in PLACEHOLDER_ALLOW):
                    continue
                if label=="Google OAuth client" and rel in {"data/cloud-config.json","data/cloud-config.js"}:
                    continue
                if label=="Supabase publishable key" and rel in {"data/cloud-config.json","data/cloud-config.js"}:
                    continue
                errors.append(
                    f"{p.relative_to(ROOT)}: possível segredo ({label})"
                )
                break

    maps=list((ROOT/"materials").glob("*.html")) if (ROOT/"materials").is_dir() else []
    sims=list((ROOT/"simulados").glob("*.html")) if (ROOT/"simulados").is_dir() else []

    cloud_path=ROOT/"data/cloud-config.json"
    if cloud_path.is_file():
        try:
            cloud=json.loads(cloud_path.read_text("utf-8"))
            drive=cloud.get("drive") or {}
            if not re.fullmatch(r"[0-9]{8,}-[0-9A-Za-z_-]+\.apps\.googleusercontent\.com",str(drive.get("oauthClientId") or "")):
                errors.append("cloud-config: OAuth Client ID público do Drive ausente ou inválido")
            if not str(drive.get("appId") or "").isdigit():
                errors.append("cloud-config: Project number/App ID do Drive ausente ou inválido")
            if not str(drive.get("folderId") or "").strip():
                errors.append("cloud-config: pasta padrão do Drive ausente")
            if str(drive.get("apiKey") or "").strip():
                errors.append("cloud-config: API key do Picker não deve ser versionada no fonte")
            supabase=cloud.get("supabase") or {}
            if supabase.get("enabled") and not re.fullmatch(r"https://[a-z0-9]+\.supabase\.co",str(supabase.get("url") or "")):
                errors.append("cloud-config: Project URL do Supabase ausente ou inválida")
            pub=str(supabase.get("publishableKey") or "")
            if pub and not pub.startswith("sb_publishable_"):
                errors.append("cloud-config: Publishable key do Supabase inválida")
        except (OSError,ValueError,TypeError) as exc:
            errors.append(f"cloud-config inválido ({exc})")

    if args.strict:
        if len(maps)!=14:
            errors.append(
                f"esperados 14 mapas; encontrados {len(maps)}"
            )
        if len(sims)!=3:
            errors.append(
                f"esperados 3 simulados; encontrados {len(sims)}"
            )

        storage_ids={}
        for p in maps:
            text=p.read_text("utf-8",errors="ignore")
            residue=head_text_residue(text)
            if residue=="__HEAD_AUSENTE__":
                errors.append(f"{p.name}: elemento <head> ausente")
            elif residue:
                errors.append(
                    f"{p.name}: texto solto inválido dentro de <head>: {residue[:120]}"
                )
            storage_id=meta_content(text,"mindmap-storage-id")
            if storage_id:
                storage_ids.setdefault(storage_id,[]).append(p.name)
            meta_names=set(re.findall(
                r"<meta\b[^>]*\bname=['\"]([^'\"]+)['\"][^>]*>",
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

        for storage_id,names in sorted(storage_ids.items()):
            if len(names)>1:
                errors.append(
                    f"mindmap-storage-id duplicado ({storage_id}): {', '.join(names)}"
                )

        data_js=(ROOT/"assets/js/pa-data-v03.js").read_text("utf-8",errors="ignore")
        sync_js=(ROOT/"assets/js/pa-sync-v03.js").read_text("utf-8",errors="ignore")
        drive_js=(ROOT/"assets/js/pa-drive-v01.js").read_text("utf-8",errors="ignore")
        if "mindmap_notes::" not in data_js:
            errors.append("pa-data-v03.js: anotações dos mapas não entram em backup/reset")
        if "mindmap_notes::" not in sync_js:
            errors.append("pa-sync-v03.js: anotações dos mapas não entram na sincronização")
        if "planoarq:active-contest:v1" not in data_js or "planoarq:active-contest:v1" not in sync_js:
            errors.append("dados/sync: chave canônica de concurso ativo sem isolamento")
        if "planoarq:active-contest:v1" not in drive_js:
            errors.append("pa-drive-v01.js: snapshot automático não usa a chave canônica do concurso ativo")
        if "Backup contém registros inválidos" not in data_js:
            errors.append("pa-data-v03.js: importação não rejeita registros de backup inválidos")
        for token in ("examSchemaForContest","saveExamSchema","contestFiles","upsertContestFile","saveImportDraft","contestBundle"):
            if token not in data_js:
                errors.append(f"pa-data-v03.js: contrato Novo Concurso ausente: {token}")
        for path in ("assets/js/pa-edict-pdf-v01.js","assets/js/pa-edict-parser-v01.js","assets/js/pa-edict-flow-v01.js","assets/js/pa-contest-import-v01.js"):
            if not (ROOT/path).exists():
                errors.append(f"Novo Concurso: arquivo obrigatório ausente: {path}")
        import_js=(ROOT/"assets/js/pa-contest-import-v01.js").read_text("utf-8",errors="ignore")
        for token in ("renderExamReview","data-review-section","data-review-event","renderContentReview"):
            if token not in import_js:
                errors.append(f"Novo Concurso: revisão estruturada ausente: {token}")
        for token in ("saveExamSchema","upsertContestFile","storeContestBlob","examSchemaId","importedEdict"):
            if token not in import_js and token not in data_js:
                errors.append(f"Novo Concurso Etapa E: persistência ausente: {token}")
        edital_text=(ROOT/"edital.html").read_text("utf-8",errors="ignore")
        planning_text=(ROOT/"planejamento.html").read_text("utf-8",errors="ignore")
        arquivos_text=(ROOT/"arquivos.html").read_text("utf-8",errors="ignore")
        if "planoarq:exam-schema::'+contestId" not in edital_text:
            errors.append("Central do Edital: schema dinâmico do concurso não é consumido")
        if "planoarq:exam-schema::'+contestId" not in planning_text:
            errors.append("Planejamento: schema dinâmico do concurso não é consumido")
        if "planoarq:contest-files::'+contestId" not in arquivos_text or "contestBlob" not in arquivos_text:
            errors.append("Arquivos: edital local do concurso não é consumido")
        cloud_cfg=json.loads((ROOT/"data/cloud-config.json").read_text("utf-8"))
        storage_cfg=(cloud_cfg.get("supabase") or {}).get("storage") or {}
        if storage_cfg.get("bucket")!="plano-arq-contest-files" or storage_cfg.get("private") is not True:
            errors.append("Etapa F: bucket privado do Supabase Storage não está configurado")
        storage_sql=(ROOT/"cloud/supabase_schema_V1.sql").read_text("utf-8",errors="ignore")
        for token in ("plano-arq-contest-files","plano_arq_files_select_own","plano_arq_files_insert_own","plano_arq_files_update_own","plano_arq_files_delete_own"):
            if token not in storage_sql:
                errors.append(f"Etapa F: SQL Storage ausente: {token}")
        for token in ("storageUpload","storageDownload","ensureContestFileLocal","reconcileContestFiles","cloudPathFor"):
            if token not in sync_js:
                errors.append(f"Etapa F: sincronização binária ausente: {token}")
        if "Supabase Storage" not in (ROOT/"configuracoes.html").read_text("utf-8",errors="ignore"):
            errors.append("Etapa F: status do Supabase Storage não está visível em Configurações")
        index_text=(ROOT/"index.html").read_text("utf-8",errors="ignore")
        for token in ("pa-edict-pdf-v01.js","pa-edict-parser-v01.js","pa-edict-flow-v01.js","pa-study-blueprint-v01.js","pa-contest-import-v01.js"):
            if token not in index_text:
                errors.append(f"Novo Concurso: index não carrega {token}")
        blueprint_path=ROOT/"assets/js/pa-study-blueprint-v01.js"
        blueprint_js=blueprint_path.read_text("utf-8",errors="ignore") if blueprint_path.exists() else ""
        for token in ("study-blueprint::","buildAndSave","splitTopics","mapsForSection","createdFrom:'programa-do-edital'"):
            if token not in blueprint_js:
                errors.append(f"Etapa G: contrato de pós-importação ausente: {token}")
        biblioteca_text=(ROOT/"biblioteca.html").read_text("utf-8",errors="ignore")
        if "data-planned-map" not in biblioteca_text or "Estrutura preparada pelo edital" not in biblioteca_text:
            errors.append("Etapa G: Biblioteca não exibe a estrutura preparada")
        if "data-study-blueprint-note" not in planning_text:
            errors.append("Etapa G: Planejamento não reconhece mapas preparados")
        for token in ("GENERATION_CONTRACT='H1'","generationPackage","generationCommand","markCommandCopied","plano-arq-map-id","plano-arq-blueprint-signature"):
            if token not in blueprint_js:
                errors.append(f"Etapa H1: contrato de geração ausente: {token}")
        for token in ("data-copy-command","Copiar comando","PRONTO PARA GERAR"):
            if token not in biblioteca_text:
                errors.append(f"Etapa H1: Biblioteca sem ação de geração: {token}")
        for token in ("IMPORT_CONTRACT='H2'","inspectGeneratedHtml","importGeneratedHtml","imported-pending-audit","study-map-html::"):
            if token not in blueprint_js:
                errors.append(f"Etapa H2: contrato de importação ausente: {token}")
        for token in ("mapHtmlInput","data-import-html","Importar HTML gerado","AGUARDANDO AUDITORIA"):
            if token not in biblioteca_text:
                errors.append(f"Etapa H2: Biblioteca sem importação de HTML: {token}")
        if "planoarq:contests:v1" not in sync_js or "Array.isArray(local)?local:[]" not in sync_js:
            errors.append("pa-sync-v03.js: concursos dinâmicos não entram no isolamento de sincronização")

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
