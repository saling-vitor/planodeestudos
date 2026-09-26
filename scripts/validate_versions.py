#!/usr/bin/env python3
from pathlib import Path
import json,re

ROOT=Path(__file__).resolve().parents[1]
contract=json.loads((ROOT/"data/version-contract.json").read_text("utf-8"))
errors=[]

def text(path):
    return (ROOT/path).read_text("utf-8",errors="replace")

def capture(path,pattern,label):
    m=re.search(pattern,text(path))
    if not m:
        errors.append(f"{label}: identificador ausente")
        return ""
    return m.group(1)

tech=contract.get("technical") or {}
checks={
    "productBaseline": capture("assets/js/pa-data-v03.js",r"const RELEASE=['\"]([^'\"]+)['\"]","Produto"),
    "dataApi": capture("assets/js/pa-data-v03.js",r"const API=\{version:['\"]([^'\"]+)['\"]","Data API"),
    "sync": capture("assets/js/pa-sync-v03.js",r"const VERSION=['\"]([^'\"]+)['\"]","Sync"),
    "studyPreconfig": capture("assets/js/study-map-preconfig-v01.js",r"const VERSION=['\"]([^'\"]+)['\"]","Study preconfig"),
    "automation": capture("assets/js/pa-actions-v01.js",r"const VERSION=['\"]([^'\"]+)['\"]","Automation"),
}
expected={
    "productBaseline":contract.get("productBaseline"),
    "dataApi":tech.get("dataApi"),
    "sync":tech.get("sync"),
    "studyPreconfig":tech.get("studyPreconfig"),
    "automation":tech.get("automation"),
}
for key,value in checks.items():
    if value!=expected.get(key):
        errors.append(f"{key}: runtime={value!r} contrato={expected.get(key)!r}")


pwa_source=str(tech.get("pwaSource") or "")
if pwa_source!="assets/js/pa-pwa-v01.js":
    errors.append(f"PWA: fonte canônica inesperada {pwa_source!r}")
pwa_version=capture("assets/js/pa-pwa-v01.js",r"const VERSION=['\"]([^'\"]+)['\"]","PWA canônico")
service_worker_version=capture("service-worker.js",r"const VERSION=['\"]([^'\"]+)['\"]","Service Worker")
expected_sw=f"{pwa_version}-source" if pwa_version else ""
if expected_sw and service_worker_version!=expected_sw:
    errors.append(f"PWA: Service Worker={service_worker_version!r} esperado={expected_sw!r}")

pack_path=ROOT/"data/offline-pack.json"
if pack_path.is_file():
    try:
        pack=json.loads(pack_path.read_text("utf-8"))
        expected_pack=f"{pwa_version}-production" if pwa_version else ""
        if expected_pack and pack.get("version")!=expected_pack:
            errors.append(f"PWA: Offline Pack={pack.get('version')!r} esperado={expected_pack!r}")
    except (OSError,ValueError,TypeError) as exc:
        errors.append(f"PWA: offline-pack inválido ({exc})")

pages=text(".github/workflows/pages.yml")
if pwa_version and pwa_version in pages:
    errors.append("PWA: workflow de Pages não pode conter a versão-base hardcoded")
if "scripts/sync_pwa_version.py --deploy-sha" not in pages:
    errors.append("PWA: workflow de Pages não deriva a versão de deploy da fonte canônica")

builder=text("scripts/build_offline_pack.py")
if pwa_version and pwa_version in builder:
    errors.append("PWA: build_offline_pack não pode conter a versão-base hardcoded")
if "assets/js/pa-pwa-v01.js" not in builder:
    errors.append("PWA: build_offline_pack não referencia a fonte canônica")

cloud=json.loads((ROOT/"data/cloud-config.json").read_text("utf-8"))
if cloud.get("version")!=contract.get("productBaseline"):
    errors.append(f"cloud-config: version={cloud.get('version')!r} contrato={contract.get('productBaseline')!r}")

release_status=str(contract.get("releaseStatus") or "")
if release_status in {"final-preparation","released"} and contract.get("productBaseline")!=contract.get("targetRelease"):
    errors.append("release final: productBaseline deve coincidir com targetRelease")

if release_status=="released":
    release_sha=str(contract.get("releaseSha") or "")
    release_tag=str(contract.get("releaseTag") or "")
    if not re.fullmatch(r"[0-9a-f]{40}",release_sha):
        errors.append("release publicada: releaseSha inválido")
    if release_tag!=f"v{contract.get('targetRelease')}":
        errors.append(f"release publicada: tag {release_tag!r} diverge de v{contract.get('targetRelease')}")
    for label,key in (("releaseGate","releaseGate"),("productionDeploy","productionDeploy")):
        row=contract.get(key) or {}
        if row.get("status")!="success":
            errors.append(f"release publicada: {label} não está success")
        if row.get("sha")!=release_sha:
            errors.append(f"release publicada: {label} aponta para SHA diferente do releaseSha")
    if contract.get("candidateRelease") or contract.get("functionalFreezeSha") or contract.get("sourceCandidateSha"):
        errors.append("release publicada: metadados ativos de RC devem ficar apenas em releaseHistory")

pre=text("assets/js/study-map-preconfig-v01.js")
runtime=text("assets/js/study-map-runtime-v01.js")
for row in contract.get("compatibilityAliases") or []:
    alias=row.get("alias","")
    target=row.get("target","")
    source=pre if alias in ("MINDMAP_V133",) else runtime
    if f"window.{alias}=window.{target}" not in source:
        errors.append(f"alias obrigatório ausente: {alias} -> {target}")

canonical=tech.get("studyRuntimeCanonical") or ""
if canonical and f"window.{canonical}" not in runtime:
    errors.append(f"runtime canônico ausente: {canonical}")

runtime_bridge=str(tech.get("studyBridgeRuntime") or "")
bundled_bridge=str(tech.get("studyBridgeBundled") or "")
blueprint_version=str(tech.get("studyBlueprint") or "")
if runtime_bridge and f"bridgeVersion:'{runtime_bridge}'" not in runtime and f'bridgeVersion:"{runtime_bridge}"' not in runtime:
    errors.append(f"bridge runtime divergente: esperado {runtime_bridge}")
blueprint=text("assets/js/pa-study-blueprint-v01.js")
if blueprint_version and not re.search(rf"const VERSION=['\"]{re.escape(blueprint_version)}['\"]",blueprint):
    errors.append(f"Study Blueprint divergente: esperado {blueprint_version}")

materials=sorted((ROOT/"materials").glob("*.html"))
bridge_bad=[]
for path in materials:
    t=path.read_text("utf-8",errors="replace")
    tag=next((x for x in re.findall(r"<meta\b[^>]*>",t,re.I) if re.search(r"name=['\"]plano-arq-bridge-version['\"]",x,re.I)), "")
    m=re.search(r"content=['\"]([^'\"]+)['\"]",tag,re.I)
    if not m or m.group(1)!=bundled_bridge:
        bridge_bad.append(path.name)
if bridge_bad:
    errors.append("bridge empacotado divergente: "+", ".join(bridge_bad[:6])+(f" +{len(bridge_bad)-6}" if len(bridge_bad)>6 else ""))

docs=text("docs/VERSIONING.md")
for token in (contract.get("targetRelease"),contract.get("productBaseline"),pwa_version,expected_sw,f"{pwa_version}-production" if pwa_version else "",canonical,runtime_bridge,bundled_bridge):
    if token and str(token) not in docs:
        errors.append(f"VERSIONING.md não documenta {token}")

if errors:
    for e in errors: print("ERRO:",e)
    raise SystemExit(1)

print(json.dumps({
    "ok":True,
    "targetRelease":contract.get("targetRelease"),
    "productBaseline":contract.get("productBaseline"),
    "releaseStatus":contract.get("releaseStatus"),
    "releaseSha":contract.get("releaseSha"),
    "releaseTag":contract.get("releaseTag"),
    "pwaCanonical":pwa_version,
    "serviceWorkerDerived":expected_sw,
    "offlinePackDerived":f"{pwa_version}-production" if pwa_version else "",
    "technical":tech,
    "aliases":contract.get("compatibilityAliases"),
    "materialsBridgeValidated":len(materials),
    "bundledBridge":bundled_bridge,
    "runtimeBridge":runtime_bridge,
    "studyBlueprint":blueprint_version
},ensure_ascii=False,indent=2))
