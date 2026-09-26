#!/usr/bin/env python3
from pathlib import Path
import json, os, sys, time
from urllib.parse import quote
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

ROOT=Path(__file__).resolve().parents[1]
BASE=(sys.argv[1] if len(sys.argv)>1 else os.getenv("PWA_URL") or "http://127.0.0.1:8765/").rstrip("/")+"/"
OUT=Path(os.getenv("STUDY_MAP_AUDIT_DIR") or "/tmp/plano-arq-study-map-audit")
OUT.mkdir(parents=True,exist_ok=True)
materials=sorted(p.relative_to(ROOT).as_posix() for p in (ROOT/"materials").glob("*.html"))
viewports=[
    ("desktop",1440,1000,False),
    ("desktop-compact",1280,800,False),
    ("ipad-landscape",1180,820,True),
    ("ipad-portrait",834,1112,True),
    ("phone",430,932,True),
    ("phone-landscape",844,390,True),
]

opts=Options()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.set_capability("goog:loggingPrefs",{"browser":"ALL"})
driver=webdriver.Chrome(options=opts)
driver.set_script_timeout(15)
errors=[]
rows=[]

def wait_ready():
    end=time.time()+15
    while time.time()<end:
        try:
            ok=driver.execute_script("""
              return document.readyState==='complete' &&
                document.body?.classList.contains('mindmap-app') &&
                !!document.querySelector('.toolbar-dock') &&
                !!document.querySelector('.topic-card') &&
                !!document.getElementById('reviewBtn');
            """)
            if ok:
                time.sleep(.18)
                return
        except Exception:
            pass
        time.sleep(.12)
    raise RuntimeError("mapa não inicializou")

def inside(r,vw,vh,tol=3):
    if not r:return False
    return r["left"]>=-tol and r["right"]<=vw+tol and r["top"]>=-tol and r["bottom"]<=vh+tol

def measure():
    return driver.execute_script("""
      const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1};
      const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      const vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
      const controls=[...document.querySelectorAll('.toolbar button,.toolbar input,.touch-more-btn,.branch-index-toggle')].filter(visible).map(e=>({tag:e.tagName.toLowerCase(),id:e.id||'',cls:e.className||'',view:e.dataset?.view||'',rect:rect(e)}));
      const offenders=[...document.querySelectorAll('body *')].filter(visible).map(e=>({e,r:e.getBoundingClientRect()})).filter(x=>x.r.right>vw+2||x.r.left<-2).filter(x=>!x.e.closest('.table-scroll')).slice(0,20).map(x=>({tag:x.e.tagName.toLowerCase(),id:x.e.id||'',cls:String(x.e.className||'').slice(0,180),text:(x.e.textContent||'').replace(/\s+/g,' ').trim().slice(0,120),rect:{left:x.r.left,right:x.r.right,width:x.r.width}}));
      const duplicateIds=[...document.querySelectorAll('[id]')].map(x=>x.id).filter((id,i,a)=>id&&a.indexOf(id)!==i);
      const nonStudyViews=[...document.querySelectorAll('[data-view]')].filter(x=>x.dataset.view!=='detail').map(x=>x.dataset.view);
      const touch=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
      const more=document.querySelector('.touch-more-btn');
      return {
        vw,vh,touch,
        scrollWidth:document.documentElement.scrollWidth,
        bodyScrollWidth:document.body.scrollWidth,
        horizontalOverflow:document.documentElement.scrollWidth>vw+2||document.body.scrollWidth>vw+2,
        hero:rect(document.querySelector('.hero')),
        toolbar:rect(document.querySelector('.toolbar')),
        dock:rect(document.querySelector('.toolbar-dock')),
        mindmap:rect(document.getElementById('mindmap')),
        branches:document.querySelectorAll('#mindmap > .branch-card').length,
        ramos:document.querySelectorAll('main > .ramo').length,
        topics:document.querySelectorAll('.topic-card').length,
        reviewBoxes:document.querySelectorAll('.review-box').length,
        duplicateIds:[...new Set(duplicateIds)],
        nonStudyViews,
        controls,
        moreVisible:visible(more),
        moreRect:rect(more),
        branchIndexVisible:visible(document.querySelector('.branch-index-toggle')),
        offenders,
        title:document.querySelector('meta[name="study-display-title"]')?.content||document.title,
        storageId:document.querySelector('meta[name="mindmap-storage-id"]')?.content||''
      };
    """)

def interaction():
    return driver.execute_script("""
      const result={};
      const first=document.querySelector('.topic-card'),summary=first?.querySelector('summary');
      if(first&&summary){first.open=false;summary.click();result.topicOpen=first.open;summary.click();result.topicClosed=!first.open}else result.topicOpen=result.topicClosed=false;
      const review=document.getElementById('reviewBtn');
      if(review){review.click();result.reviewOn=document.body.classList.contains('review-mode');review.click();result.reviewOff=!document.body.classList.contains('review-mode')}else result.reviewOn=result.reviewOff=false;
      const searchToggle=document.getElementById('searchToggle'),search=document.getElementById('search');
      if(searchToggle&&search){searchToggle.click();result.searchOpen=document.body.classList.contains('search-open');search.value='a';search.dispatchEvent(new Event('input',{bubbles:true}));result.searchUsable=!!document.getElementById('searchInfo')?.textContent;search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));}else result.searchOpen=result.searchUsable=false;
      document.getElementById('clearBtn')?.click();
      return result;
    """)

try:
    for label,w,h,touch in viewports:
        driver.execute_cdp_cmd("Emulation.clearDeviceMetricsOverride",{})
        driver.set_window_size(w,h)
        driver.execute_cdp_cmd("Emulation.setTouchEmulationEnabled",{"enabled":touch,"maxTouchPoints":5 if touch else 1})
        if touch:
            driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride",{"width":w,"height":h,"deviceScaleFactor":1,"mobile":False})
        for path in materials:
            url=BASE+quote(path,safe="/._-")
            try:
                driver.get(url);wait_ready()
                data=measure()
                inter=interaction()
                browser_errors=[x.get("message","") for x in driver.get_log("browser") if x.get("level")=="SEVERE" and "favicon" not in x.get("message","").lower()]
                row={"material":path,"viewport":{"name":label,"width":w,"height":h,"touch":touch},"diagnostics":data,"interaction":inter,"browserErrors":browser_errors}
                local=[]
                if data["horizontalOverflow"]:local.append("overflow horizontal")
                if data["branches"]<1 or data["ramos"]<1 or data["topics"]<1:local.append("estrutura principal ausente")
                if data["branches"]!=data["ramos"]:local.append("quantidade ramo/branch divergente")
                if data["duplicateIds"]:local.append("IDs duplicados: "+",".join(data["duplicateIds"][:5]))
                if data["nonStudyViews"]:local.append("modo visual legado exposto")
                if not inter.get("topicOpen") or not inter.get("topicClosed"):local.append("details do tópico não responde")
                if not inter.get("reviewOn") or not inter.get("reviewOff"):local.append("fila de revisão não alterna")
                if not inter.get("searchOpen") or not inter.get("searchUsable"):local.append("busca não responde")
                if browser_errors:local.append("erro JavaScript no console")
                if touch and data["touch"]:
                    if not data["moreVisible"]:local.append("Mais touch não visível")
                    tiny=[x for x in data["controls"] if x["rect"] and (x["rect"]["width"]<44 or x["rect"]["height"]<44)]
                    if tiny:local.append("controle touch abaixo de 44px: "+",".join((x.get("id") or x.get("view") or x.get("cls") or x.get("tag") or "?") for x in tiny[:4]))
                if data["hero"] and data["hero"]["right"]>data["vw"]+3:local.append("hero fora da viewport")
                if local:
                    row["errors"]=local
                    errors.extend(f"{path} · {label}: {e}" for e in local)
                    driver.save_screenshot(str(OUT/(Path(path).stem+"-"+label+"-FAIL.png")))
                rows.append(row)
            except Exception as exc:
                errors.append(f"{path} · {label}: exceção: {exc}")
                try:driver.save_screenshot(str(OUT/(Path(path).stem+"-"+label+"-EXCEPTION.png")))
                except Exception:pass
                rows.append({"material":path,"viewport":{"name":label,"width":w,"height":h,"touch":touch},"exception":str(exc)})

    # Smoke específico do barramento único OK/REV/DIF.
    driver.execute_cdp_cmd("Emulation.setTouchEmulationEnabled",{"enabled":False,"maxTouchPoints":1})
    driver.execute_cdp_cmd("Emulation.clearDeviceMetricsOverride",{})
    driver.set_window_size(1280,800)
    driver.get(BASE+quote(materials[0],safe="/._-"));wait_ready()
    state_bus=driver.execute_async_script("""
      const done=arguments[arguments.length-1],bus=window.PLANO_ARQ_STUDY_STATE_BUS;
      const topic=document.querySelector('.topic-card'),btn=topic?.querySelector('.state-btn');
      if(!bus||!topic||!btn){done({ok:false,reason:'bus/topic/button ausente'});return}
      const before=Number(bus.stats?.batches||0),oldState=topic.dataset.studyState||'';
      let settled=false;
      const finish=result=>{if(settled)return;settled=true;done(result)};
      document.addEventListener('mindmap:study-state-changed',e=>{
        requestAnimationFrame(()=>finish({
          ok:Number(bus.stats?.batches||0)===before+1&&Array.isArray(e.detail?.topicIds)&&e.detail.topicIds.includes(topic.id)&&(topic.dataset.studyState||'')!==oldState,
          before,after:Number(bus.stats?.batches||0),oldState,newState:topic.dataset.studyState||'',topicIds:e.detail?.topicIds||[]
        }));
      },{once:true});
      btn.click();
      setTimeout(()=>finish({ok:false,reason:'evento não emitido',before,after:Number(bus.stats?.batches||0),oldState,newState:topic.dataset.studyState||''}),1200);
    """)
    if not state_bus.get("ok"):
        errors.append("barramento único de estado falhou: "+str(state_bus))
finally:
    try:driver.execute_cdp_cmd("Emulation.setTouchEmulationEnabled",{"enabled":False,"maxTouchPoints":1})
    except Exception:pass
    try:driver.execute_cdp_cmd("Emulation.clearDeviceMetricsOverride",{})
    except Exception:pass
    driver.quit()

summary={
    "ok":not errors,
    "materials":len(materials),
    "viewports":len(viewports),
    "cases":len(rows),
    "stateBus":state_bus if 'state_bus' in locals() else {"ok":False,"reason":"não executado"},
    "failures":len(errors),
    "errors":errors,
}
(OUT/"report.json").write_text(json.dumps({"summary":summary,"rows":rows},ensure_ascii=False,indent=2),"utf-8")
(OUT/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),"utf-8")
print(json.dumps(summary,ensure_ascii=False,indent=2))
if errors:raise SystemExit(1)
