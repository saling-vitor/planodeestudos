#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
sw=(ROOT/"service-worker.js").read_text("utf-8",errors="replace")
pwa=(ROOT/"assets/js/pa-pwa-v01.js").read_text("utf-8",errors="replace")
errors=[]

checks=[
    ("service worker: skipWaiting no install", "await self.skipWaiting()" in sw),
    ("service worker: clients.claim ausente", "await self.clients.claim()" in sw),
    ("service worker: fetch online não usa no-store", "fetch(req,{cache:'no-store'})" in sw),
    ("service worker: cache offline estável ausente", "const OFFLINE='plano-arq-offline-user-v1'" in sw),
    ("service worker: mapas/simulados/edital não entram no network-first", "/(materials|simulados|edital)/" in sw or "/\\/(materials|simulados|edital)\\//" in sw),
    ("service worker: CSS/JS/data não entram no network-first", "['style','script','font'].includes(req.destination)" in sw and "/data/" in sw),
    ("service worker: imagens locais não entram no network-first", "if(req.destination==='image')" in sw and "event.respondWith(networkFirst(req))" in sw),
    ("service worker: estratégia stale-while-revalidate antiga ainda existe", "staleWhileRevalidate" not in sw),
    ("PWA: registro não ignora cache HTTP do SW", "updateViaCache:'none'" in pwa),
    ("PWA: mudança de controller não recarrega versão existente", "controllerchange" in pwa and "location.reload()" in pwa),
]
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

if errors:
    for error in errors:
        print("ERRO:",error)
    raise SystemExit(1)

print("PWA/cache OK: rede prioritária online, fallback offline e atualização previsível.")
