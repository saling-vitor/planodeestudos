#!/usr/bin/env python3
import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.parse import urljoin

base=(sys.argv[1] if len(sys.argv)>1 else os.environ.get("PWA_URL","")).strip()
if not base:
    raise SystemExit("Informe a URL publicada do GitHub Pages")
if not base.endswith("/"):
    base+="/"
url=urljoin(base,"pwa-diagnostico.html")
expected=(os.environ.get("GITHUB_SHA") or "")[:8]

chrome=next((p for p in (
    shutil.which("google-chrome"),
    shutil.which("google-chrome-stable"),
    shutil.which("chromium"),
    shutil.which("chromium-browser"),
) if p),None)
if not chrome:
    raise SystemExit("Chrome/Chromium não encontrado no runner")

profile=Path(tempfile.mkdtemp(prefix="plano-arq-pwa-"))

def dump(extra=None):
    cmd=[
        chrome,"--headless=new","--no-sandbox","--disable-gpu",
        f"--user-data-dir={profile}",
        "--virtual-time-budget=12000",
        "--run-all-compositor-stages-before-draw",
    ]
    if extra:
        cmd.extend(extra)
    cmd.extend(["--dump-dom",url])
    proc=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=45)
    if proc.returncode:
        raise RuntimeError(proc.stderr[-3000:])
    m=re.search(r'<pre id="result">([\s\S]*?)</pre>',proc.stdout)
    if not m:
        raise RuntimeError("Resultado do probe não apareceu no DOM")
    raw=html.unescape(re.sub(r'<[^>]+>','',m.group(1))).strip()
    return json.loads(raw)

last=None
for attempt in range(1,7):
    try:
        first=dump()
        time.sleep(1)
        second=dump()
        last=second
        version=((second.get("serviceWorkerFile") or {}).get("version") or "")
        if expected and expected not in version:
            raise RuntimeError(f"deploy ainda não propagado: worker={version!r}, esperado SHA {expected}")
        break
    except Exception as exc:
        if attempt==6:
            raise
        print(f"tentativa {attempt}/6: {exc}")
        time.sleep(5)

manifest=last.get("manifest") or {}
sw=last.get("serviceWorker") or {}
assets=last.get("assets") or []
icons=manifest.get("icons") or []
errors=[]
if not (base.startswith("https://")): errors.append("deploy não usa HTTPS")
if not manifest.get("ok"): errors.append("manifest não respondeu 200")
if "manifest" not in manifest.get("mime","") and "json" not in manifest.get("mime",""): errors.append("MIME do manifest inesperado")
mdata=manifest.get("data") or {}
for key in ("name","short_name","start_url","scope","display"):
    if not mdata.get(key): errors.append(f"manifest sem {key}")
if not icons or any(not i.get("ok") for i in icons): errors.append("ícone do manifest indisponível")
if not sw.get("registered"): errors.append("Service Worker não registrado")
if not sw.get("active"): errors.append("Service Worker não está ativo")
if not sw.get("controller"): errors.append("Service Worker não controla a página no segundo carregamento")
scope=sw.get("scope") or ""
if "/planodeestudos/" not in scope.lower(): errors.append(f"scope inesperado: {scope}")
if any(not x.get("ok") for x in assets): errors.append("asset publicado retornou erro")
if not any((c.get("name") or "").startswith("plano-arq-core-") for c in last.get("caches") or []): errors.append("cache core não encontrado")
if not any((c.get("name") or "").startswith("plano-arq-runtime-") for c in last.get("caches") or []): errors.append("cache runtime não encontrado")

print(json.dumps({
    "url":url,
    "serviceWorkerVersion":(last.get("serviceWorkerFile") or {}).get("version"),
    "manifest":manifest,
    "serviceWorker":sw,
    "caches":last.get("caches"),
    "assets":assets,
    "pwaStatus":last.get("pwaStatus"),
},ensure_ascii=False,indent=2))

if errors:
    for error in errors:
        print("ERRO:",error,file=sys.stderr)
    raise SystemExit(1)
print("RUNTIME PWA OK: deploy real respondeu e o navegador confirmou manifest, SW, controle, cache e assets.")
