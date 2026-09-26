#!/usr/bin/env python3
from pathlib import Path
import json, os, sys, tempfile, time
from urllib.parse import urljoin
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE=(sys.argv[1] if len(sys.argv)>1 else os.getenv("PWA_URL") or "http://127.0.0.1:8765/").rstrip("/")+"/"
profile=Path(tempfile.mkdtemp(prefix="plano-arq-offline-profile-"))
opts=Options()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1280,900")
opts.add_argument(f"--user-data-dir={profile}")
opts.set_capability("goog:loggingPrefs",{"browser":"ALL"})
driver=webdriver.Chrome(options=opts)
driver.set_script_timeout(180)
errors=[]
report={}

def wait_app(timeout=30):
    WebDriverWait(driver,timeout).until(lambda d:d.execute_script(
        "return document.readyState==='complete' && !!window.PLANO_ARQ_PWA && !!navigator.serviceWorker"
    ))

def async_js(code,timeout=180):
    driver.set_script_timeout(timeout)
    return driver.execute_async_script(code)

try:
    # Fresh profile = clean installation. First load registers the worker; reload gains control.
    driver.get(urljoin(BASE,"configuracoes.html"))
    wait_app()
    async_js("""
      const done=arguments[0];
      navigator.serviceWorker.ready.then(r=>done({ok:true,scope:r.scope,active:r.active?.state||''})).catch(e=>done({ok:false,error:String(e)}));
    """,30)
    driver.refresh();wait_app()
    WebDriverWait(driver,30).until(lambda d:d.execute_script("return !!navigator.serviceWorker.controller"))

    before=driver.execute_script("""
      return Promise.all([caches.keys(),navigator.serviceWorker.getRegistrations().then(rs=>rs.map(r=>r.scope))]).then(([caches,regs])=>({
        caches,regs,controller:navigator.serviceWorker.controller?.scriptURL||null
      }))
    """)
    report["cleanInstall"]=before

    pack=async_js("""
      const done=arguments[0];
      window.PLANO_ARQ_PWA.pack('full').then(done).catch(e=>done({ok:false,error:String(e)}));
    """,180)
    report["pack"]=pack
    if not pack.get("ok"):
        errors.append("download do pacote offline falhou: "+str(pack))

    manifest=async_js("""
      const done=arguments[0];
      fetch('data/offline-pack.json',{cache:'no-store'}).then(r=>r.json()).then(done).catch(e=>done({error:String(e)}));
    """,30)
    full=manifest.get("full") or []
    external=[x.get("path") for x in full if isinstance(x,dict) and str(x.get("path") or "").startswith(("https://","http://"))]
    local=[x.get("path") for x in full if isinstance(x,dict) and not str(x.get("path") or "").startswith(("https://","http://"))]
    report["manifest"]={"schema":manifest.get("schema"),"version":manifest.get("version"),"total":len(full),"external":len(external),"externalCount":manifest.get("externalCount")}
    if not external:
        errors.append("manifesto offline não contém recursos externos")
    if manifest.get("externalCount")!=len(external):
        errors.append("externalCount divergente do manifesto")

    info=async_js("const done=arguments[0];window.PLANO_ARQ_PWA.cacheInfo().then(done).catch(e=>done({ok:false,error:String(e)}));",30)
    report["cacheInfoAfterPack"]=info
    if info.get("offlineCount")!=len(full):
        errors.append(f"cache offline contém {info.get('offlineCount')} de {len(full)} recursos")

    cached_external=async_js("""
      const urls=arguments[0],done=arguments[arguments.length-1];
      Promise.all(urls.map(async u=>{const r=await caches.match(u);return{url:u,hit:!!r,type:r?.type||'',status:r?.status??null}})).then(done).catch(e=>done([{error:String(e)}]));
    """.replace("arguments[0]","arguments[0]"),30) if False else None
    # Selenium arguments need a separate call with URL array.
    driver.set_script_timeout(30)
    cached_external=driver.execute_async_script("""
      const urls=arguments[0],done=arguments[arguments.length-1];
      Promise.all(urls.map(async u=>{const r=await caches.match(u);return{url:u,hit:!!r,type:r?.type||'',status:r?.status??null}})).then(done).catch(e=>done([{error:String(e)}]));
    """,external)
    report["externalCache"]=cached_external
    misses=[x for x in cached_external if not x.get("hit")]
    if misses:
        errors.append(f"{len(misses)} recurso(s) externo(s) não entraram no CacheStorage")

    # Pick concrete local resources for the cold-offline navigation test.
    map_path=next((p for p in local if str(p).startswith("materials/") and str(p).endswith(".html")),None)
    sim_path=next((p for p in local if str(p).startswith("simulados/") and str(p).endswith(".html")),None)
    edital_path=next((p for p in local if str(p).startswith("edital/") and str(p).lower().endswith(".pdf")),None)
    if not all((map_path,sim_path,edital_path)):
        errors.append("pacote completo não contém mapa, simulado e PDF de edital")

    # Truly disable the network after package preparation.
    driver.execute_cdp_cmd("Network.enable",{})
    driver.execute_cdp_cmd("Network.emulateNetworkConditions",{
      "offline":True,"latency":0,"downloadThroughput":0,"uploadThroughput":0
    })

    routes={}
    for rel in ["index.html","biblioteca.html",map_path,sim_path]:
        if not rel: continue
        try:
            driver.get(urljoin(BASE,rel))
            WebDriverWait(driver,25).until(lambda d:d.execute_script("return document.readyState") in ("interactive","complete"))
            body=len(driver.find_element("tag name","body").text)
            current=driver.current_url
            routes[rel]={"ok":not current.startswith("chrome-error://") and body>20,"body":body,"url":current}
            if not routes[rel]["ok"]:
                errors.append("navegação offline falhou: "+rel)
        except Exception as exc:
            routes[rel]={"ok":False,"error":str(exc)}
            errors.append("navegação offline falhou: "+rel)
    report["routes"]=routes

    # External icons are requested as actual <img>, so the SW sees destination=image.
    if external:
        icon_result=driver.execute_async_script("""
          const urls=arguments[0],done=arguments[arguments.length-1],rows=[];
          let pending=urls.length;
          if(!pending){done([]);return}
          urls.forEach(u=>{
            const img=new Image();
            const finish=ok=>{rows.push({url:u,ok,naturalWidth:img.naturalWidth||0});if(--pending===0)done(rows)};
            img.onload=()=>finish(true);img.onerror=()=>finish(false);img.src=u;
          });
          setTimeout(()=>{if(pending>0)done(rows.concat([{timeout:true,pending}]))},15000);
        """,external)
        report["offlineIcons"]=icon_result
        failed_icons=[x for x in icon_result if x.get("timeout") or not x.get("ok")]
        if failed_icons:
            errors.append(f"{len(failed_icons)} ícone(s) externo(s) falharam sem rede")

    if edital_path:
        pdf=driver.execute_async_script("""
          const url=arguments[0],done=arguments[arguments.length-1];
          fetch(url).then(async r=>done({ok:r.ok,status:r.status,bytes:(await r.arrayBuffer()).byteLength})).catch(e=>done({ok:false,error:String(e)}));
        """,urljoin(BASE,edital_path))
        report["offlinePdf"]=pdf
        if not pdf.get("ok") or pdf.get("bytes",0)<1000:
            errors.append("PDF do edital não abriu pelo cache offline")

    severe=[x for x in driver.get_log("browser") if x.get("level")=="SEVERE" and "favicon" not in x.get("message","").lower()]
    report["browserSevere"]=severe
    # Network failures for intentionally blocked online probes are acceptable only if app content succeeded.
    app_severe=[x for x in severe if "ERR_INTERNET_DISCONNECTED" not in x.get("message","")]
    if app_severe:
        errors.append(f"console contém {len(app_severe)} erro(s) SEVERE não relacionados ao desligamento de rede")

    driver.execute_cdp_cmd("Network.emulateNetworkConditions",{
      "offline":False,"latency":0,"downloadThroughput":-1,"uploadThroughput":-1
    })
finally:
    try: driver.quit()
    except Exception: pass

summary={"ok":not errors,"errors":errors,"report":report}
print(json.dumps(summary,ensure_ascii=False,indent=2))
if errors:
    raise SystemExit(1)
