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
    "pwa": capture("assets/js/pa-pwa-v01.js",r"const VERSION=['\"]([^'\"]+)['\"]","PWA"),
    "serviceWorker": capture("service-worker.js",r"const VERSION=['\"]([^'\"]+)['\"]","Service Worker"),
    "studyPreconfig": capture("assets/js/study-map-preconfig-v01.js",r"const VERSION=['\"]([^'\"]+)['\"]","Study preconfig"),
}
expected={
    "productBaseline":contract.get("productBaseline"),
    "dataApi":tech.get("dataApi"),
    "sync":tech.get("sync"),
    "pwa":tech.get("pwa"),
    "serviceWorker":tech.get("serviceWorker"),
    "studyPreconfig":tech.get("studyPreconfig"),
}
for key,value in checks.items():
    if value!=expected.get(key):
        errors.append(f"{key}: runtime={value!r} contrato={expected.get(key)!r}")

builder=text("scripts/build_offline_pack.py")
offline=tech.get("offlinePack") or ""
if offline and f"'version':'{offline}'" not in builder and f'"version":"{offline}"' not in builder:
    errors.append(f"Offline Pack: versão {offline!r} não encontrada no builder")

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

bridge=str(tech.get("studyBridge") or "")
if bridge and f"bridgeVersion:'{bridge}'" not in runtime and f'bridgeVersion:"{bridge}"' not in runtime:
    errors.append(f"bridge runtime divergente: esperado {bridge}")

materials=sorted((ROOT/"materials").glob("*.html"))
bridge_bad=[]
for path in materials:
    t=path.read_text("utf-8",errors="replace")
    m=re.search(r'<meta\s+name=["\']plano-arq-bridge-version["\']\s+content=["\']([^"\']+)["\']',t,re.I)
    if not m or m.group(1)!=bridge:
        bridge_bad.append(path.name)
if bridge_bad:
    errors.append("bridge divergente nos materiais: "+", ".join(bridge_bad[:6])+(f" +{len(bridge_bad)-6}" if len(bridge_bad)>6 else ""))

docs=text("docs/VERSIONING.md")
for token in (contract.get("targetRelease"),contract.get("productBaseline"),tech.get("pwa"),canonical):
    if token and str(token) not in docs:
        errors.append(f"VERSIONING.md não documenta {token}")

if errors:
    for e in errors: print("ERRO:",e)
    raise SystemExit(1)

print(json.dumps({
    "ok":True,
    "targetRelease":contract.get("targetRelease"),
    "productBaseline":contract.get("productBaseline"),
    "technical":tech,
    "aliases":contract.get("compatibilityAliases"),
    "materialsBridgeValidated":len(materials)
},ensure_ascii=False,indent=2))
