#!/usr/bin/env python3
import json
import os
from pathlib import Path
import shutil
import sys
import time
from urllib.parse import urljoin

from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

base=(sys.argv[1] if len(sys.argv)>1 else os.environ.get("PWA_URL","")).strip()
if not base:
    raise SystemExit("Informe a URL publicada do GitHub Pages")
if not base.endswith("/"):
    base+="/"

phase=os.environ.get("PWA_PHASE","after").strip().lower()
profile=Path(os.environ.get("PWA_PROFILE_DIR") or "/tmp/plano-arq-pwa-profile")
state_file=Path(os.environ.get("PWA_STATE_FILE") or "/tmp/plano-arq-pwa-before.json")
expected=(os.environ.get("GITHUB_SHA") or "")[:8]
probe_url=urljoin(base,"pwa-diagnostico.html")
config_url=urljoin(base,"configuracoes.html")

options=Options()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-gpu")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--window-size=1440,1000")
options.add_argument(f"--user-data-dir={profile}")
options.set_capability("goog:loggingPrefs",{"browser":"ALL"})

def new_driver():
    return webdriver.Chrome(options=options)

def wait_probe(driver,timeout=30):
    driver.get(probe_url)
    wait=WebDriverWait(driver,timeout)
    wait.until(lambda d:d.execute_script("return document.documentElement.dataset.pwaProbe") in ("done","error"))
    state=driver.execute_script("return document.documentElement.dataset.pwaProbe")
    raw=driver.execute_script("return document.getElementById('result')?.textContent || ''")
    if state!="done":
        raise RuntimeError(f"probe terminou em {state}: {raw}")
    return json.loads(raw)

def async_js(driver,script,timeout=120):
    driver.set_script_timeout(timeout)
    return driver.execute_async_script(script)

def cache_info(driver):
    return async_js(driver,"const done=arguments[0];window.PLANO_ARQ_PWA.cacheInfo().then(done).catch(e=>done({ok:false,error:String(e)}));",30)

def basic_assertions(data,expected_sha=""):
    manifest=data.get("manifest") or {}
    sw=data.get("serviceWorker") or {}
    assets=data.get("assets") or []
    icons=manifest.get("icons") or []
    errors=[]
    if not base.startswith("https://"): errors.append("deploy não usa HTTPS")
    if not manifest.get("ok"): errors.append("manifest não respondeu 200")
    if "manifest" not in manifest.get("mime","") and "json" not in manifest.get("mime",""): errors.append("MIME do manifest inesperado")
    mdata=manifest.get("data") or {}
    for key in ("id","name","short_name","start_url","scope","display"):
        if not mdata.get(key): errors.append(f"manifest sem {key}")
    sizes={i.get("sizes") for i in icons if i.get("ok")}
    if "192x192" not in sizes: errors.append("ícone 192x192 não validado")
    if "512x512" not in sizes: errors.append("ícone 512x512 não validado")
    if not any("maskable" in (i.get("purpose") or "") and i.get("ok") for i in icons): errors.append("ícone maskable não validado")
    if not sw.get("registered"): errors.append("Service Worker não registrado")
    if not sw.get("active"): errors.append("Service Worker não está ativo")
    if not sw.get("controller"): errors.append("Service Worker não controla a página")
    scope=(sw.get("scope") or "").lower()
    if "/planodeestudos/" not in scope: errors.append(f"scope inesperado: {scope}")
    if any(not x.get("ok") for x in assets): errors.append("asset publicado retornou erro")
    caches=data.get("caches") or []
    if not any((c.get("name") or "").startswith("plano-arq-core-") for c in caches): errors.append("cache core não encontrado")
    if not any((c.get("name") or "").startswith("plano-arq-runtime-") for c in caches): errors.append("cache runtime não encontrado")
    version=((data.get("serviceWorkerFile") or {}).get("version") or "")
    if expected_sha and expected_sha not in version: errors.append(f"worker publicado {version!r} não corresponde ao SHA {expected_sha}")
    return errors

def relevant_severe(logs):
    ignored=("favicon.ico",)
    out=[]
    for item in logs:
        if item.get("level")!="SEVERE":
            continue
        msg=item.get("message","")
        if any(x in msg for x in ignored):
            continue
        out.append(item)
    return out

if phase=="before":
    if profile.exists():
        shutil.rmtree(profile,ignore_errors=True)
    profile.mkdir(parents=True,exist_ok=True)
    driver=new_driver()
    try:
        first=wait_probe(driver)
        driver.refresh()
        WebDriverWait(driver,25).until(lambda d:d.execute_script("return document.documentElement.dataset.pwaProbe")=="done")
        second=json.loads(driver.execute_script("return document.getElementById('result').textContent"))
        errors=basic_assertions(second)
        ci=cache_info(driver)
        baseline={
            "serviceWorkerVersion":ci.get("version") or (second.get("serviceWorkerFile") or {}).get("version"),
            "caches":second.get("caches") or [],
            "timestamp":time.time()
        }
        state_file.parent.mkdir(parents=True,exist_ok=True)
        state_file.write_text(json.dumps(baseline,ensure_ascii=False,indent=2),encoding="utf-8")
        severe=relevant_severe(driver.get_log("browser"))
        if severe: errors.append(f"console pré-deploy contém {len(severe)} erro(s) SEVERE")
        print(json.dumps({"phase":"before","baseline":baseline,"pwaStatus":second.get("pwaStatus"),"severe":severe},ensure_ascii=False,indent=2))
        if errors:
            for e in errors: print("ERRO:",e,file=sys.stderr)
            raise SystemExit(1)
        print("BASELINE PWA OK: versão anterior registrada e controlando o navegador real.")
    finally:
        driver.quit()
    raise SystemExit(0)

baseline={}
if state_file.exists():
    baseline=json.loads(state_file.read_text(encoding="utf-8"))

driver=new_driver()
try:
    last=None
    for attempt in range(1,9):
        try:
            last=wait_probe(driver)
            new_file_version=((last.get("serviceWorkerFile") or {}).get("version") or "")
            if expected and expected not in new_file_version:
                raise RuntimeError(f"deploy ainda não propagado: worker={new_file_version!r}, esperado SHA {expected}")
            break
        except Exception as exc:
            if attempt==8: raise
            print(f"tentativa {attempt}/8: {exc}")
            time.sleep(5)

    errors=basic_assertions(last,expected)
    old_version=baseline.get("serviceWorkerVersion") or ""
    active_before=cache_info(driver)
    waiting=driver.execute_script("return navigator.serviceWorker.getRegistration('./').then(r=>!!r?.waiting)")
    update_cycle={"baseline":old_version,"activeBefore":active_before.get("version"),"waitingBefore":bool(waiting)}

    if old_version and expected and expected not in old_version:
        if active_before.get("version")!=old_version:
            errors.append(f"worker anterior não permaneceu ativo antes da aplicação: {active_before.get('version')} != {old_version}")
        if not waiting:
            # Force a genuine registration.update and wait for the new worker to enter waiting.
            driver.execute_script("return navigator.serviceWorker.getRegistration('./').then(r=>r.update())")
            try:
                WebDriverWait(driver,25).until(lambda d:d.execute_script("return navigator.serviceWorker.getRegistration('./').then(r=>!!r?.waiting)"))
                waiting=True
            except Exception:
                waiting=False
        if not waiting:
            errors.append("nova versão não entrou em waiting antes da ativação")
        else:
            driver.get(config_url)
            WebDriverWait(driver,25).until(lambda d:d.execute_script("return !!window.PLANO_ARQ_PWA && !!navigator.serviceWorker.controller"))
            WebDriverWait(driver,25).until(lambda d:d.find_element(By.ID,"pwaUpdateState").text!="VERIFICANDO")
            driver.find_element(By.ID,"checkPwaUpdate").click()
            WebDriverWait(driver,25).until(lambda d:not d.find_element(By.ID,"applyPwaUpdate").get_attribute("hidden"))
            driver.find_element(By.ID,"applyPwaUpdate").click()
            time.sleep(2)
            # controllerchange triggers exactly one reload when activation was explicitly requested.
            for _ in range(6):
                try:
                    driver.get(probe_url)
                    WebDriverWait(driver,25).until(lambda d:d.execute_script("return document.documentElement.dataset.pwaProbe")=="done")
                    ci=cache_info(driver)
                    if expected in (ci.get("version") or ""):
                        break
                except WebDriverException:
                    pass
                time.sleep(2)
            active_after=cache_info(driver)
            update_cycle["activeAfter"]=active_after.get("version")
            update_cycle["waitingAfter"]=driver.execute_script("return navigator.serviceWorker.getRegistration('./').then(r=>!!r?.waiting)")
            if expected not in (active_after.get("version") or ""):
                errors.append(f"nova versão não assumiu controle: {active_after.get('version')}")
            if update_cycle["waitingAfter"]:
                errors.append("worker continuou em waiting após Atualizar agora")
            time_origin=driver.execute_script("return performance.timeOrigin")
            time.sleep(3)
            if driver.execute_script("return performance.timeOrigin")!=time_origin:
                errors.append("reload adicional detectado após estabilização do controller")

    # Validate UI state on the real published configuration page.
    driver.get(config_url)
    WebDriverWait(driver,25).until(lambda d:d.execute_script("return !!window.PLANO_ARQ_PWA && !!navigator.serviceWorker.controller"))
    WebDriverWait(driver,25).until(lambda d:d.find_element(By.ID,"pwaExecution").text!="VERIFICANDO")
    ui={i:driver.execute_script("return document.getElementById(arguments[0])?.textContent?.trim() || ''",i) for i in ("pwaExecution","pwaInstallState","pwaVersion","pwaOfflineState","pwaUpdateState","pwaManifestState","pwaSwState","pwaControlState","pwaHttpsState")}
    if ui["pwaExecution"] in ("—","VERIFICANDO",""): errors.append("UI de Execução não resolveu estado")
    if ui["pwaInstallState"] in ("—","VERIFICANDO",""): errors.append("UI de Instalação não resolveu estado")
    if expected and expected not in ui["pwaVersion"]: errors.append(f"UI mostra versão divergente: {ui['pwaVersion']}")
    if ui["pwaControlState"]!="SIM": errors.append("UI não reconhece controle real do Service Worker")
    if ui["pwaHttpsState"]!="OK": errors.append("UI não reconhece HTTPS")
    install_btn=driver.find_element(By.ID,"installPwa")
    pwa_status=driver.execute_script("return window.PLANO_ARQ_PWA.status()")
    if pwa_status.get("installable") and install_btn.get_attribute("disabled"):
        errors.append("navegador oferece instalação, mas botão está desabilitado")

    # Download the full package through the real UI button.
    driver.find_element(By.ID,"cacheOfflinePack").click()
    WebDriverWait(driver,120).until(lambda d:d.find_element(By.ID,"pwaOfflineState").text in ("PRONTO","PARCIAL"))
    offline_state=driver.find_element(By.ID,"pwaOfflineState").text
    if offline_state!="PRONTO": errors.append(f"download offline terminou em {offline_state}")
    pack=driver.execute_async_script("const done=arguments[0];fetch('data/offline-pack.json',{cache:'no-store'}).then(r=>r.json()).then(done).catch(e=>done({error:String(e)}));")
    ci_after_pack=cache_info(driver)
    total=len(pack.get("full") or [])
    if ci_after_pack.get("offlineCount")!=total:
        errors.append(f"cache offline contém {ci_after_pack.get('offlineCount')} de {total} arquivos")

    full_paths=[x.get("path") for x in pack.get("full") or [] if isinstance(x,dict)]
    map_path=next((p for p in full_paths if p.startswith("materials/") and p.endswith(".html")),None)
    sim_path=next((p for p in full_paths if p.startswith("simulados/") and p.endswith(".html")),None)
    edital_path=next((p for p in full_paths if p.startswith("edital/") and p.lower().endswith(".pdf")),None)
    if not all((map_path,sim_path,edital_path)): errors.append("pacote offline não expõe mapa, simulado e edital para teste")

    offline_results={}
    if not errors or all((map_path,sim_path,edital_path)):
        driver.execute_cdp_cmd("Network.enable",{})
        driver.execute_cdp_cmd("Network.emulateNetworkConditions",{"offline":True,"latency":0,"downloadThroughput":0,"uploadThroughput":0})
        for rel in ("index.html","biblioteca.html",map_path,sim_path):
            try:
                driver.get(urljoin(base,rel))
                WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState") in ("interactive","complete"))
                offline_results[rel]={"url":driver.current_url,"body":len(driver.find_element(By.TAG_NAME,"body").text)}
                if driver.current_url.startswith("chrome-error://") or offline_results[rel]["body"]<20:
                    errors.append(f"navegação offline falhou: {rel}")
            except Exception as exc:
                offline_results[rel]={"error":str(exc)}
                errors.append(f"navegação offline falhou: {rel}")
        if edital_path:
            driver.set_script_timeout(30)
            result=driver.execute_async_script("const url=arguments[0],done=arguments[arguments.length-1];fetch(url).then(async r=>done({ok:r.ok,status:r.status,bytes:(await r.arrayBuffer()).byteLength})).catch(e=>done({ok:false,error:String(e)}));",urljoin(base,edital_path))
            offline_results[edital_path]=result
            if not result.get("ok") or result.get("bytes",0)<1000: errors.append("edital não abriu via cache offline")
        driver.execute_cdp_cmd("Network.emulateNetworkConditions",{"offline":False,"latency":0,"downloadThroughput":-1,"uploadThroughput":-1})

    # Removal also executes the real underlying action and must zero the user offline cache.
    driver.get(config_url)
    WebDriverWait(driver,25).until(lambda d:d.execute_script("return !!window.PLANO_ARQ_PWA && !!navigator.serviceWorker.controller"))
    driver.find_element(By.ID,"clearOfflinePack").click()
    WebDriverWait(driver,10).until(lambda d:d.find_element(By.ID,"dialog").get_attribute("class").find("open")>=0)
    driver.find_element(By.ID,"dialogConfirm").click()
    WebDriverWait(driver,30).until(lambda d:d.find_element(By.ID,"pwaOfflineState").text=="NÃO BAIXADO")
    if cache_info(driver).get("offlineCount")!=0: errors.append("Remover pacote offline não zerou o cache do usuário")

    severe=relevant_severe(driver.get_log("browser"))
    if severe: errors.append(f"console contém {len(severe)} erro(s) SEVERE fora do teste offline")

    report={
        "phase":"after",
        "url":base,
        "serviceWorkerFile":last.get("serviceWorkerFile"),
        "manifest":last.get("manifest"),
        "serviceWorker":last.get("serviceWorker"),
        "caches":last.get("caches"),
        "pwaStatus":last.get("pwaStatus"),
        "updateCycle":update_cycle,
        "ui":ui,
        "offline":{"packTotal":total,"cacheAfterPack":ci_after_pack,"routes":offline_results},
        "browserSevere":severe
    }
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if errors:
        for e in errors: print("ERRO:",e,file=sys.stderr)
        raise SystemExit(1)
    print("RUNTIME PWA OK: deploy, atualização, controle, UI, pacote offline, navegação offline e remoção foram exercitados em navegador real.")
finally:
    driver.quit()
