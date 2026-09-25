#!/usr/bin/env python3
import json
import os
import sys
import tempfile
import time
from urllib.parse import urljoin

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

base=(sys.argv[1] if len(sys.argv)>1 else os.environ.get("PWA_URL","")).strip()
if not base:
    raise SystemExit("Informe a URL publicada do GitHub Pages")
if not base.endswith("/"):
    base+="/"
url=urljoin(base,"pwa-diagnostico.html")
expected=(os.environ.get("GITHUB_SHA") or "")[:8]

options=Options()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-gpu")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--window-size=1440,1000")
options.add_argument(f"--user-data-dir={tempfile.mkdtemp(prefix='plano-arq-pwa-')}")
options.set_capability("goog:loggingPrefs",{"browser":"ALL"})

driver=webdriver.Chrome(options=options)
wait=WebDriverWait(driver,25)

def probe():
    driver.get(url)
    wait.until(lambda d:d.execute_script("return document.documentElement.dataset.pwaProbe") in ("done","error"))
    state=driver.execute_script("return document.documentElement.dataset.pwaProbe")
    raw=driver.execute_script("return document.getElementById('result')?.textContent || ''")
    if state!="done":
        raise RuntimeError(f"probe terminou em {state}: {raw}")
    return json.loads(raw)

try:
    last=None
    for attempt in range(1,7):
        try:
            first=probe()
            driver.refresh()
            wait.until(lambda d:d.execute_script("return document.documentElement.dataset.pwaProbe")=="done")
            raw=driver.execute_script("return document.getElementById('result')?.textContent || ''")
            last=json.loads(raw)
            version=((last.get("serviceWorkerFile") or {}).get("version") or "")
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
    if not base.startswith("https://"): errors.append("deploy não usa HTTPS")
    if not manifest.get("ok"): errors.append("manifest não respondeu 200")
    if "manifest" not in manifest.get("mime","") and "json" not in manifest.get("mime",""): errors.append("MIME do manifest inesperado")
    mdata=manifest.get("data") or {}
    for key in ("name","short_name","start_url","scope","display"):
        if not mdata.get(key): errors.append(f"manifest sem {key}")
    if not icons or any(not i.get("ok") for i in icons): errors.append("ícone do manifest indisponível")
    if not sw.get("registered"): errors.append("Service Worker não registrado")
    if not sw.get("active"): errors.append("Service Worker não está ativo")
    if not sw.get("controller"): errors.append("Service Worker não controla a página no segundo carregamento")
    scope=(sw.get("scope") or "").lower()
    if "/planodeestudos/" not in scope: errors.append(f"scope inesperado: {scope}")
    if any(not x.get("ok") for x in assets): errors.append("asset publicado retornou erro")
    if not any((c.get("name") or "").startswith("plano-arq-core-") for c in last.get("caches") or []): errors.append("cache core não encontrado")
    if not any((c.get("name") or "").startswith("plano-arq-runtime-") for c in last.get("caches") or []): errors.append("cache runtime não encontrado")

    browser_logs=driver.get_log("browser")
    severe=[x for x in browser_logs if x.get("level")=="SEVERE"]

    print(json.dumps({
        "url":url,
        "serviceWorkerVersion":(last.get("serviceWorkerFile") or {}).get("version"),
        "manifest":manifest,
        "serviceWorker":sw,
        "caches":last.get("caches"),
        "assets":assets,
        "pwaStatus":last.get("pwaStatus"),
        "browserSevere":severe,
    },ensure_ascii=False,indent=2))

    if severe:
        errors.append(f"console contém {len(severe)} erro(s) SEVERE")
    if errors:
        for error in errors:
            print("ERRO:",error,file=sys.stderr)
        raise SystemExit(1)
    print("RUNTIME PWA OK: deploy real respondeu e o navegador confirmou manifest, SW, controle, cache e assets.")
finally:
    driver.quit()
