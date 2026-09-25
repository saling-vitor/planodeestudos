#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[1]
sw=(ROOT/"service-worker.js").read_text("utf-8",errors="replace")
pwa=(ROOT/"assets/js/pa-pwa-v01.js").read_text("utf-8",errors="replace")
errors=[]

def declared_version(text):
    m=re.search(r"const VERSION=['\"]([^'\"]+)['\"];",text)
    return m.group(1) if m else ""

pwa_version=declared_version(pwa)
sw_version=declared_version(sw)
if not pwa_version:
    errors.append("PWA: versão lógica ausente em pa-pwa-v01.js")
if not sw_version:
    errors.append("PWA: versão fonte ausente em service-worker.js")
if pwa_version and sw_version and sw_version!=f"{pwa_version}-source":
    errors.append(f"PWA: versões divergentes entre runtime ({pwa_version}) e Service Worker ({sw_version})")

workflow=(ROOT/".github/workflows/pages.yml").read_text("utf-8",errors="replace")
workflow_version=re.search(r'version=f"([0-9]+\.[0-9]+)-\{sys\.argv\[1\]\}"',workflow)
if pwa_version and (not workflow_version or workflow_version.group(1)!=pwa_version):
    found=workflow_version.group(1) if workflow_version else "ausente"
    errors.append(f"PWA: versionamento do workflow ({found}) diverge do runtime ({pwa_version})")

maintenance="const MAINTENANCE_MODE=true;" in sw
common_checks=[
    ("service worker: fetch online não usa no-store", "fetch(req,{cache:'no-store'})" in sw),
    ("service worker: cache offline estável ausente", "const OFFLINE='plano-arq-offline-user-v1'" in sw),
    ("service worker: mapas/simulados/edital não entram no network-first", "/(materials|simulados|edital)/" in sw or "/\\/(materials|simulados|edital)\\//" in sw),
    ("service worker: CSS/JS/data não entram no network-first", "['style','script','font'].includes(req.destination)" in sw and "/data/" in sw),
    ("service worker: imagens locais não entram no network-first", "if(req.destination==='image')" in sw and "event.respondWith(networkFirst(req))" in sw),
    ("service worker: estratégia stale-while-revalidate antiga ainda existe", "staleWhileRevalidate" not in sw),
    ("PWA: registro não ignora cache HTTP do SW", "updateViaCache:'none'" in pwa),
    ("PWA: mudança de controller não recarrega versão existente", "controllerchange" in pwa and "location.reload()" in pwa),
]
if maintenance:
    install_block=sw[sw.find("self.addEventListener('install'"):sw.find("self.addEventListener('activate'")]
    checks=[
        ("service worker manutenção: skipWaiting ausente", "self.skipWaiting()" in install_block),
        ("service worker manutenção: unregister ausente", "self.registration.unregister()" in sw),
        ("service worker manutenção: limpeza de caches ausente", "if(isPlanoCache(name))await caches.delete(name)" in sw),
        ("service worker manutenção: navegação dos clientes não força saída do controller", "client.navigate(client.url)" in sw),
    ]+common_checks
else:
    checks=[
        ("service worker: install não deve forçar skipWaiting", "self.addEventListener('install'" in sw and "await self.skipWaiting()" not in sw[sw.find("self.addEventListener('install'"):sw.find("self.addEventListener('activate'")]),
        ("service worker: mensagem SKIP_WAITING ausente", "msg.type==='SKIP_WAITING'" in sw and "self.skipWaiting()" in sw),
        ("service worker: clients.claim ausente", "await self.clients.claim()" in sw),
    ]+common_checks
for label,ok in checks:
    if not ok:
        errors.append(label)

# Evita regressões explícitas para cache-first em conteúdo mutável.
mutable_blocks=[
    r"materials",
    r"simulados",
    r"edital",
]
fetch_handler=sw[sw.find("self.addEventListener('fetch'"):]
for token in mutable_blocks:
    if re.search(rf"{token}[^\n]{{0,220}}cacheFirst",fetch_handler,re.I):
        errors.append(f"service worker: {token} voltou a cache-first")

# O pacote offline deve ser substituído apenas após download completo.
if "if(failed)" not in sw or "await caches.delete(temp)" not in sw:
    errors.append("service worker: atualização offline não é transacional")

# O pacote offline completo deve refletir integralmente o conteúdo publicado.
pack_path=ROOT/"data/offline-pack.json"
if not pack_path.is_file():
    errors.append("PWA: manifesto offline gerado ausente")
else:
    try:
        pack=json.loads(pack_path.read_text("utf-8"))
        expected_pack_version=f"{pwa_version}-production" if pwa_version else ""
        if expected_pack_version and pack.get("version")!=expected_pack_version:
            errors.append(
                f"PWA: versão do pacote offline ({pack.get('version')}) diverge do runtime ({expected_pack_version})"
            )
        full=pack.get("full") or []
        full_paths=[x.get("path","") for x in full if isinstance(x,dict)]
        full_set=set(full_paths)
        if len(full_paths)!=len(full_set):
            errors.append("PWA: manifesto offline contém caminhos duplicados")
        required=[]
        for folder in ("materials","simulados","edital"):
            base=ROOT/folder
            if base.is_dir():
                required.extend(
                    p.relative_to(ROOT).as_posix()
                    for p in base.rglob("*") if p.is_file()
                )
        required.extend([
            "assets/css/study-map-shared-v01.css",
            "assets/css/simulation-shared-v01.css",
            "assets/js/study-map-bootstrap-v01.js",
            "assets/js/study-map-preconfig-v01.js",
            "assets/js/study-map-runtime-v01.js",
            "assets/js/simulation-runtime-v01.js",
            "assets/img/study-map-hero.jpg",
        ])
        missing=sorted(set(required)-full_set)
        if missing:
            errors.append(
                "PWA: pacote offline completo não inclui: "
                + ", ".join(missing[:8])
                + (f" +{len(missing)-8}" if len(missing)>8 else "")
            )
        broken=sorted(
            p for p in full_set
            if p and not (ROOT/p).is_file()
        )
        if broken:
            errors.append(
                "PWA: manifesto offline referencia arquivo ausente: "
                + ", ".join(broken[:8])
                + (f" +{len(broken)-8}" if len(broken)>8 else "")
            )
    except (OSError,ValueError,TypeError) as exc:
        errors.append(f"PWA: manifesto offline inválido ({exc})")

if errors:
    for error in errors:
        print("ERRO:",error)
    raise SystemExit(1)

print("PWA/cache OK: rede prioritária online, fallback offline e atualização previsível.")
