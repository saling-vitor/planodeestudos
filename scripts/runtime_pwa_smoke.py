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

def probe_with_retry(driver,attempts=6,timeout=30,delay=3):
    last=None
    for attempt in range(1,attempts+1):
        try:
            return wait_probe(driver,timeout)
        except Exception as exc:
            last=exc
            if attempt==attempts:
                raise
            print(f"probe tentativa {attempt}/{attempts}: {exc}")
            time.sleep(delay)
    raise last

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

def maintenance_assertions(data,expected_sha=""):
    manifest=data.get("manifest") or {}
    sw=data.get("serviceWorker") or {}
    icons=manifest.get("icons") or []
    errors=[]
    if not (data.get("maintenance") or (data.get("pwaStatus") or {}).get("maintenance")):
        errors.append("modo manutenção não está ativo no runtime")
    if not base.startswith("https://"): errors.append("deploy não usa HTTPS")
    if not manifest.get("ok"): errors.append("manifest não respondeu 200")
    if "manifest" not in manifest.get("mime","") and "json" not in manifest.get("mime",""): errors.append("MIME do manifest inesperado")
    mdata=manifest.get("data") or {}
    for key in ("id","name","short_name","start_url","scope","display"):
        if not mdata.get(key): errors.append(f"manifest sem {key}")
    if not icons or any(not i.get("ok") for i in icons): errors.append("ícone do manifest indisponível")
    if sw.get("registered"): errors.append("Service Worker permaneceu registrado em manutenção")
    if sw.get("active"): errors.append("Service Worker permaneceu ativo em manutenção")
    if sw.get("controller"): errors.append("Service Worker ainda controla a página em manutenção")
    technical=[c for c in (data.get("caches") or []) if (c.get("name") or "").startswith("plano-arq-")]
    if technical: errors.append(f"caches técnicos permaneceram ativos: {[c.get('name') for c in technical]}")
    version=((data.get("serviceWorkerFile") or {}).get("version") or "")
    if expected_sha and expected_sha not in version: errors.append(f"arquivo worker publicado {version!r} não corresponde ao SHA {expected_sha}")
    return errors

def verify_maintenance_persistence(driver):
    sentinel="maintenance-preserve-"+str(int(time.time()*1000))
    driver.get(config_url)
    WebDriverWait(driver,25).until(lambda d:d.execute_script("return !!window.PLANO_ARQ_DATA && window.PLANO_ARQ_DATA.isMaintenanceMode()===true"))
    driver.execute_script("""
      localStorage.setItem('planoarq:maintenance-test:v1',arguments[0]);
      localStorage.setItem('mindmap_state::maintenance-smoke',JSON.stringify({topicStates:{sentinel:'done'}}));
      localStorage.setItem('planoarq:planning::maintenance-smoke',JSON.stringify({sentinel:true}));
      localStorage.setItem('planoarq:settings-lock:v1',JSON.stringify({v:1,sentinel:true}));
      localStorage.setItem('planoarq:supabase-config:v1',JSON.stringify({url:'https://sentinel.supabase.co',key:'sb_publishable_maintenance_sentinel_123456789'}));
      localStorage.setItem('planoarq:drive-config:v1',JSON.stringify({clientId:'sentinel.apps.googleusercontent.com',folderId:'sentinel-folder'}));
    """,sentinel)
    idb_write=async_js(driver,"""
      const done=arguments[0],req=indexedDB.open('planoarq-maintenance-smoke',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('state');
      req.onerror=()=>done({ok:false,error:String(req.error)});
      req.onsuccess=()=>{const db=req.result,tx=db.transaction('state','readwrite');tx.objectStore('state').put('preserved','sentinel');tx.oncomplete=()=>{db.close();done({ok:true})};tx.onerror=()=>done({ok:false,error:String(tx.error)})};
    """,20)
    before_sync=driver.execute_script("return localStorage.getItem('planoarq:last-sync-at')")
    before_snapshot=driver.execute_script("return localStorage.getItem('planoarq:last-drive-snapshot')")
    driver.refresh()
    WebDriverWait(driver,25).until(lambda d:d.execute_script("return !!window.PLANO_ARQ_DATA && window.PLANO_ARQ_DATA.isMaintenanceMode()===true"))
    WebDriverWait(driver,25).until(lambda d:(d.find_element(By.ID,"maintenanceState").text or "").strip()=="ATIVO")
    try:
        WebDriverWait(driver,25).until(lambda d:"DESATIVADO" in (d.find_element(By.ID,"pwaSwState").text or ""))
    except Exception:
        pass
    preserved=driver.execute_script("""
      return {
        sentinel:localStorage.getItem('planoarq:maintenance-test:v1'),
        map:localStorage.getItem('mindmap_state::maintenance-smoke'),
        planning:localStorage.getItem('planoarq:planning::maintenance-smoke'),
        pin:localStorage.getItem('planoarq:settings-lock:v1'),
        supabase:localStorage.getItem('planoarq:supabase-config:v1'),
        drive:localStorage.getItem('planoarq:drive-config:v1'),
        runtime:window.PLANO_ARQ_DATA.runtimeFlags()
      }
    """)
    idb_read=async_js(driver,"""
      const done=arguments[0],req=indexedDB.open('planoarq-maintenance-smoke',1);
      req.onerror=()=>done({ok:false,error:String(req.error)});
      req.onsuccess=()=>{const db=req.result,tx=db.transaction('state','readonly'),get=tx.objectStore('state').get('sentinel');get.onsuccess=()=>{done({ok:get.result==='preserved',value:get.result});db.close()};get.onerror=()=>done({ok:false,error:String(get.error)})};
    """,20)
    guards=async_js(driver,"""
      const done=arguments[0];
      Promise.all([
        Promise.resolve(window.PLANO_ARQ_SYNC?.syncNow?.({reason:'maintenance-smoke'})),
        Promise.resolve(window.PLANO_ARQ_DRIVE?.maybeAutoSnapshot?.('maintenance-smoke')),
        Promise.resolve(window.PLANO_ARQ_PWA?.checkUpdate?.())
      ]).then(([sync,drive,pwa])=>done({
        sync,drive,pwa,
        automation:window.PlanoARQActions?.build?.('maintenance-smoke')||[],
        syncStatus:window.PLANO_ARQ_SYNC?.status?.(),
        driveStatus:window.PLANO_ARQ_DRIVE?.status?.(),
        automationStatus:window.PlanoARQActions?.settings?.(),
        pwaStatus:window.PLANO_ARQ_PWA?.status?.()
      })).catch(e=>done({error:String(e)}));
    """,30)
    regs=driver.execute_script("return navigator.serviceWorker.getRegistrations().then(rs=>rs.map(r=>r.scope))")
    controller=driver.execute_script("return navigator.serviceWorker.controller?.scriptURL || null")
    caches_now=driver.execute_script("return caches.keys()")
    after_sync=driver.execute_script("return localStorage.getItem('planoarq:last-sync-at')")
    after_snapshot=driver.execute_script("return localStorage.getItem('planoarq:last-drive-snapshot')")
    remote_resources=driver.execute_script("""
      return performance.getEntriesByType('resource').map(x=>x.name).filter(x=>/supabase\.co|googleapis\.com|accounts\.google\.com/i.test(x))
    """)
    ui={i:driver.execute_script("return document.getElementById(arguments[0])?.textContent?.trim() || ''",i) for i in (
        "maintenanceState","supabaseStatus","driveStatus","automationLayerStatus","pwaLayerStatus",
        "pwaInstallState","pwaOfflineState","pwaUpdateState","pwaSwState","pwaControlState"
    )}
    driver.execute_script("""
      ['planoarq:maintenance-test:v1','mindmap_state::maintenance-smoke','planoarq:planning::maintenance-smoke',
       'planoarq:settings-lock:v1','planoarq:supabase-config:v1','planoarq:drive-config:v1'].forEach(k=>localStorage.removeItem(k));
    """)
    async_js(driver,"""
      const done=arguments[0],req=indexedDB.deleteDatabase('planoarq-maintenance-smoke');
      req.onsuccess=()=>done(true);req.onerror=()=>done(false);req.onblocked=()=>done(false);
    """,10)
    return {
        "sentinelPreserved":preserved.get("sentinel")==sentinel,
        "mapPreserved":'"sentinel":"done"' in (preserved.get("map") or ""),
        "planningPreserved":'"sentinel":true' in (preserved.get("planning") or ""),
        "pinPreserved":'"sentinel":true' in (preserved.get("pin") or ""),
        "supabaseConfigPreserved":"sentinel.supabase.co" in (preserved.get("supabase") or ""),
        "driveConfigPreserved":"sentinel-folder" in (preserved.get("drive") or ""),
        "indexedDbWrite":idb_write,
        "indexedDbPreserved":bool(idb_read.get("ok")),
        "runtime":preserved.get("runtime"),
        "guards":guards,
        "registrations":regs,
        "controller":controller,
        "caches":caches_now,
        "lastSyncUnchanged":before_sync==after_sync,
        "lastSnapshotUnchanged":before_snapshot==after_snapshot,
        "remoteResources":remote_resources,
        "ui":ui,
    }


def verify_settings_pin_gate(driver):
    key="planoarq:settings-lock:v1"
    attempts="planoarq:settings-pin-attempts:v1"
    legacy="planoarq:settings-unlocked:v1"
    result={}
    driver.get(config_url)
    WebDriverWait(driver,25).until(lambda d:d.execute_script("return !!document.getElementById('settingsPinNew') && !!window.crypto?.subtle"))
    driver.execute_script("localStorage.removeItem(arguments[0]);sessionStorage.removeItem(arguments[1]);sessionStorage.removeItem(arguments[2]);",key,attempts,legacy)
    driver.refresh()
    WebDriverWait(driver,25).until(lambda d:d.execute_script("return !!document.getElementById('settingsPinNew')"))

    def setv(id_,value):
        driver.execute_script("document.getElementById(arguments[0]).value=arguments[1]",id_,value)

    setv("settingsPinNew","1234");setv("settingsPinConfirm","1234")
    driver.find_element(By.ID,"saveSettingsPin").click();time.sleep(.25)
    result["rejectsShort"]=driver.execute_script("return localStorage.getItem(arguments[0])===null",key)

    pin1="246810";pin2="135790"
    setv("settingsPinNew",pin1);setv("settingsPinConfirm",pin1)
    driver.find_element(By.ID,"saveSettingsPin").click()
    WebDriverWait(driver,10).until(lambda d:d.execute_script("return !!localStorage.getItem(arguments[0])",key))
    raw=driver.execute_script("return localStorage.getItem(arguments[0])",key)
    saved=json.loads(raw)
    result["hashedOnly"]=bool(saved.get("salt") and saved.get("hash") and pin1 not in raw)
    result["sixDigitV2"]=saved.get("v")==2
    result["autoLockDefault"]=saved.get("autoLockMinutes")==15

    driver.find_element(By.ID,"lockSettingsNow").click()
    WebDriverWait(driver,5).until(lambda d:d.execute_script("return document.getElementById('settingsLock').hidden===false"))
    result["lockNow"]=True
    for _ in range(5):
        setv("settingsUnlockPin","000000")
        driver.find_element(By.ID,"settingsUnlockBtn").click()
        time.sleep(.35)
    state=driver.execute_script("return JSON.parse(sessionStorage.getItem(arguments[0])||'{}')",attempts)
    result["progressiveLock"]=int(state.get("count") or 0)>=5 and int(state.get("lockedUntil") or 0)>int(time.time()*1000)
    state["lockedUntil"]=int(time.time()*1000)-1
    driver.execute_script("sessionStorage.setItem(arguments[0],JSON.stringify(arguments[1]))",attempts,state)
    setv("settingsUnlockPin",pin1)
    driver.find_element(By.ID,"settingsUnlockBtn").click()
    WebDriverWait(driver,10).until(lambda d:d.execute_script("return document.getElementById('settingsLock').hidden===true"))

    driver.refresh()
    WebDriverWait(driver,10).until(lambda d:d.execute_script("return document.getElementById('settingsLock').hidden===false"))
    result["reloadLocked"]=True

    original=driver.current_window_handle
    driver.execute_script("window.open(arguments[0],'_blank')",config_url)
    WebDriverWait(driver,10).until(lambda d:len(d.window_handles)>1)
    h=[x for x in driver.window_handles if x!=original][0]
    driver.switch_to.window(h)
    WebDriverWait(driver,10).until(lambda d:d.execute_script("return document.getElementById('settingsLock')?.hidden===false"))
    result["newTabLocked"]=True
    driver.close();driver.switch_to.window(original)

    setv("settingsUnlockPin",pin1)
    driver.find_element(By.ID,"settingsUnlockBtn").click()
    WebDriverWait(driver,10).until(lambda d:d.execute_script("return document.getElementById('settingsLock').hidden===true"))

    # Runtime autolock: use a short injected interval; UI only exposes 0/5/15/30/60.
    driver.execute_script("const k=arguments[0],c=JSON.parse(localStorage.getItem(k));c.autoLockMinutes=.002;localStorage.setItem(k,JSON.stringify(c));document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))",key)
    WebDriverWait(driver,5).until(lambda d:d.execute_script("return document.getElementById('settingsLock').hidden===false"))
    result["autoLockWorks"]=True
    driver.execute_script("const k=arguments[0],c=JSON.parse(localStorage.getItem(k));c.autoLockMinutes=15;localStorage.setItem(k,JSON.stringify(c));",key)
    setv("settingsUnlockPin",pin1);driver.find_element(By.ID,"settingsUnlockBtn").click()
    WebDriverWait(driver,10).until(lambda d:d.execute_script("return document.getElementById('settingsLock').hidden===true"))

    before=driver.execute_script("return JSON.parse(localStorage.getItem(arguments[0])).hash",key)
    setv("settingsPinCurrent","");setv("settingsPinNew",pin2);setv("settingsPinConfirm",pin2)
    driver.find_element(By.ID,"saveSettingsPin").click();time.sleep(.35)
    after_blank=driver.execute_script("return JSON.parse(localStorage.getItem(arguments[0])).hash",key)
    result["changeNeedsCurrent"]=before==after_blank
    setv("settingsPinCurrent",pin1);setv("settingsPinNew",pin2);setv("settingsPinConfirm",pin2)
    driver.find_element(By.ID,"saveSettingsPin").click()
    WebDriverWait(driver,10).until(lambda d:d.execute_script("return JSON.parse(localStorage.getItem(arguments[0])).hash!==arguments[1]",key,before))
    result["changedWithCurrent"]=True

    driver.find_element(By.ID,"lockSettingsNow").click()
    setv("settingsUnlockPin",pin1);driver.find_element(By.ID,"settingsUnlockBtn").click();time.sleep(.35)
    result["oldPinRejected"]=driver.execute_script("return document.getElementById('settingsLock').hidden===false")
    setv("settingsUnlockPin",pin2);driver.find_element(By.ID,"settingsUnlockBtn").click()
    WebDriverWait(driver,10).until(lambda d:d.execute_script("return document.getElementById('settingsLock').hidden===true"))
    result["newPinAccepted"]=True

    setv("settingsPinCurrent","")
    driver.find_element(By.ID,"removeSettingsPin").click();time.sleep(.25)
    result["removalNeedsCurrent"]=driver.execute_script("return !!localStorage.getItem(arguments[0]) && !document.getElementById('dialog').classList.contains('open')",key)
    setv("settingsPinCurrent",pin2);driver.find_element(By.ID,"removeSettingsPin").click()
    WebDriverWait(driver,10).until(lambda d:d.execute_script("return document.getElementById('dialog').classList.contains('open')"))
    setv("dialogInput","REMOVER");driver.find_element(By.ID,"dialogConfirm").click()
    WebDriverWait(driver,10).until(lambda d:d.execute_script("return localStorage.getItem(arguments[0])===null",key))
    result["removedWithCurrent"]=True
    result["legacySessionUnlockUnused"]=driver.execute_script("return sessionStorage.getItem(arguments[0])===null",legacy)
    driver.execute_script("localStorage.removeItem(arguments[0]);sessionStorage.removeItem(arguments[1]);sessionStorage.removeItem(arguments[2]);",key,attempts,legacy)
    return result

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
        first=probe_with_retry(driver)
        second=probe_with_retry(driver)
        maintenance=bool(second.get("maintenance") or (second.get("pwaStatus") or {}).get("maintenance"))
        if maintenance:
            errors=maintenance_assertions(second)
            ci={"version":(second.get("serviceWorkerFile") or {}).get("version")}
        else:
            errors=basic_assertions(second)
            ci=cache_info(driver)
        baseline={
            "maintenance":maintenance,
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
        print("BASELINE MANUTENÇÃO OK: Service Worker e caches técnicos isolados." if maintenance else "BASELINE PWA OK: versão anterior registrada e controlando o navegador real.")
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

    maintenance=bool(last.get("maintenance") or (last.get("pwaStatus") or {}).get("maintenance"))
    if maintenance:
        errors=maintenance_assertions(last,expected)
        persistence=verify_maintenance_persistence(driver)
        pin_gate=verify_settings_pin_gate(driver)
        for key,label in {
            "rejectsShort":"PIN curto foi aceito",
            "hashedOnly":"PIN foi persistido sem salt/hash ou em texto",
            "sixDigitV2":"novo PIN não usa contrato v2 de 6 dígitos",
            "autoLockDefault":"autolock padrão não é 15 min",
            "lockNow":"bloqueio manual falhou",
            "progressiveLock":"5 tentativas não acionaram atraso progressivo",
            "reloadLocked":"reload manteve Configurações desbloqueadas",
            "newTabLocked":"nova aba burlou o PIN",
            "autoLockWorks":"bloqueio automático por inatividade falhou",
            "changeNeedsCurrent":"PIN pôde ser alterado sem PIN atual",
            "changedWithCurrent":"troca de PIN com PIN atual falhou",
            "oldPinRejected":"PIN antigo continuou válido após troca",
            "newPinAccepted":"novo PIN não desbloqueou",
            "removalNeedsCurrent":"PIN pôde ser removido sem PIN atual",
            "removedWithCurrent":"remoção autenticada do PIN falhou",
            "legacySessionUnlockUnused":"estado legado de desbloqueio ficou persistido"
        }.items():
            if not pin_gate.get(key): errors.append(label)
        if not persistence.get("sentinelPreserved"): errors.append("localStorage genérico não foi preservado após reload em manutenção")
        if not persistence.get("mapPreserved"): errors.append("estado de mapa local não foi preservado")
        if not persistence.get("planningPreserved"): errors.append("planejamento local não foi preservado")
        if not persistence.get("pinPreserved"): errors.append("PIN/configuração local não foi preservado")
        if not persistence.get("supabaseConfigPreserved"): errors.append("configuração Supabase local não foi preservada")
        if not persistence.get("driveConfigPreserved"): errors.append("configuração Drive local não foi preservada")
        if not persistence.get("indexedDbPreserved"): errors.append("IndexedDB não foi preservado")
        if not (persistence.get("runtime") or {}).get("maintenanceMode"): errors.append("flag de manutenção não persistiu após reload")
        if persistence.get("registrations"): errors.append(f"há Service Worker registrado após reload: {persistence.get('registrations')}")
        if persistence.get("controller"): errors.append(f"há Service Worker controlador após reload: {persistence.get('controller')}")
        tech=[x for x in persistence.get("caches") or [] if str(x).startswith("plano-arq-")]
        if tech: errors.append(f"caches técnicos reapareceram após reload: {tech}")
        guards=persistence.get("guards") or {}
        if (guards.get("sync") or {}).get("reason")!="maintenance": errors.append("syncNow não foi bloqueado pelo guard de manutenção")
        if (guards.get("drive") or {}).get("reason")!="maintenance": errors.append("snapshot automático não foi bloqueado pelo guard de manutenção")
        if not (guards.get("pwa") or {}).get("maintenance"): errors.append("atualização PWA não foi bloqueada pelo guard de manutenção")
        if guards.get("automation"): errors.append("automação retornou ações durante manutenção")
        if not ((guards.get("syncStatus") or {}).get("maintenance")): errors.append("status Supabase não informa manutenção")
        if not ((guards.get("driveStatus") or {}).get("maintenance")): errors.append("status Drive não informa manutenção")
        if (guards.get("automationStatus") or {}).get("effectiveEnabled") is not False: errors.append("automação efetiva não está OFF")
        if not ((guards.get("pwaStatus") or {}).get("maintenance")): errors.append("status PWA não informa manutenção")
        if not persistence.get("lastSyncUnchanged"): errors.append("timestamp de sync mudou durante manutenção")
        if not persistence.get("lastSnapshotUnchanged"): errors.append("snapshot foi alterado durante manutenção")
        if persistence.get("remoteResources"): errors.append(f"requisições remotas automáticas detectadas: {persistence.get('remoteResources')}")
        ui=persistence.get("ui") or {}
        expected_ui={"maintenanceState":"ATIVO","supabaseStatus":"Pausado","driveStatus":"Pausado","automationLayerStatus":"PAUSADA","pwaLayerStatus":"PAUSADO","pwaInstallState":"PAUSADO","pwaOfflineState":"PAUSADO","pwaUpdateState":"PAUSADO","pwaControlState":"NÃO"}
        for key,value in expected_ui.items():
            if ui.get(key)!=value: errors.append(f"UI de manutenção divergente em {key}: {ui.get(key)!r} != {value!r}")
        if "DESATIVADO" not in (ui.get("pwaSwState") or ""): errors.append("UI não mostra Service Worker desativado")
        assets=driver.execute_async_script("""
          const done=arguments[0];
          Promise.all(['configuracoes.html','assets/js/pa-data-v03.js','assets/js/pa-sync-v03.js','assets/js/pa-drive-v01.js','assets/js/pa-pwa-v01.js'].map(async p=>{
            try{const r=await fetch(p,{cache:'no-store'});return{path:p,ok:r.ok,status:r.status}}catch(e){return{path:p,ok:false,error:String(e)}}
          })).then(done)
        """)
        if any(not x.get("ok") for x in assets): errors.append("asset atual do GitHub Pages falhou em manutenção")
        routes={}
        for rel in (
            "index.html",
            "biblioteca.html?contest=demhab-poa-arquiteto-2026",
            "planejamento.html?contest=demhab-poa-arquiteto-2026",
            "simulados.html?contest=demhab-poa-arquiteto-2026",
            "materials/CF88_Constituicao_Federal_Estudo_V02.html",
        ):
            driver.get(urljoin(base,rel))
            WebDriverWait(driver,25).until(lambda d:d.execute_script("return document.readyState") in ("interactive","complete"))
            # Uma navegação ainda pode chegar inicialmente sob o controller antigo.
            # O bootstrap de manutenção o remove e, quando necessário, faz um único reload.
            # A validação só considera a rota estável quando registro e controller desapareceram.
            try:
                WebDriverWait(driver,25).until(lambda d:d.execute_script("""
                    return Promise.all([
                      navigator.serviceWorker.getRegistrations().then(rs=>rs.length),
                      Promise.resolve(navigator.serviceWorker.controller?.scriptURL || null)
                    ]).then(([count,controller])=>count===0 && controller===null)
                """))
            except Exception:
                pass
            body_len=len(driver.find_element(By.TAG_NAME,"body").text)
            registrations=driver.execute_script("return navigator.serviceWorker.getRegistrations().then(rs=>rs.map(r=>r.scope))")
            controller=driver.execute_script("return navigator.serviceWorker.controller?.scriptURL || null")
            external=driver.execute_script(r"return performance.getEntriesByType('resource').map(x=>x.name).filter(x=>/supabase\.co|googleapis\.com|accounts\.google\.com/i.test(x))")
            routes[rel]={"body":body_len,"registrations":registrations,"controller":controller,"remoteResources":external}
            if body_len<20: errors.append(f"página local não carregou em manutenção: {rel}")
            if registrations: errors.append(f"Service Worker voltou a registrar na rota local: {rel} -> {registrations}")
            if controller: errors.append(f"Service Worker continuou controlando rota local após estabilização: {rel}")
            if external: errors.append(f"rota iniciou comunicação externa em manutenção: {rel} -> {external}")
        driver.get(config_url)
        WebDriverWait(driver,25).until(lambda d:d.execute_script("return !!window.PLANO_ARQ_DATA && window.PLANO_ARQ_DATA.isMaintenanceMode()===true"))
        original=driver.current_window_handle
        driver.execute_script("window.open(arguments[0],'_blank')",config_url)
        WebDriverWait(driver,10).until(lambda d:len(d.window_handles)>1)
        new_handle=[h for h in driver.window_handles if h!=original][0]
        driver.switch_to.window(new_handle)
        WebDriverWait(driver,25).until(lambda d:d.execute_script("return !!window.PLANO_ARQ_DATA && window.PLANO_ARQ_DATA.isMaintenanceMode()===true"))
        new_tab_maintenance=driver.execute_script("return window.PLANO_ARQ_DATA.isMaintenanceMode()===true")
        new_tab_controller=driver.execute_script("return navigator.serviceWorker.controller?.scriptURL || null")
        driver.close();driver.switch_to.window(original)
        if not new_tab_maintenance: errors.append("modo manutenção não persistiu em nova aba")
        if new_tab_controller: errors.append("nova aba voltou a ser controlada por Service Worker")
        if baseline and baseline.get("maintenance") is not True: errors.append("perfil do navegador não preservou manutenção entre processos before/after")
        severe=relevant_severe(driver.get_log("browser"))
        if severe: errors.append(f"console contém {len(severe)} erro(s) SEVERE em manutenção")
        report={
            "phase":"after",
            "maintenance":True,
            "url":base,
            "serviceWorkerFile":last.get("serviceWorkerFile"),
            "manifest":last.get("manifest"),
            "serviceWorker":last.get("serviceWorker"),
            "caches":last.get("caches"),
            "pwaStatus":last.get("pwaStatus"),
            "persistence":persistence,
            "pinGate":pin_gate,
            "assets":assets,
            "routes":routes,
            "newTab":{"maintenance":new_tab_maintenance,"controller":new_tab_controller},
            "browserRestartBaselineMaintenance":baseline.get("maintenance") if baseline else None,
            "browserSevere":severe,
        }
        print(json.dumps(report,ensure_ascii=False,indent=2))
        if errors:
            for e in errors: print("ERRO:",e,file=sys.stderr)
            raise SystemExit(1)
        print("RUNTIME MANUTENÇÃO OK: flag persistiu, dados locais foram preservados, Service Worker ficou sem registro/controle e caches técnicos permaneceram limpos.")
        raise SystemExit(0)

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
