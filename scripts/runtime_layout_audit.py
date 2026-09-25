#!/usr/bin/env python3
import json
import os
from pathlib import Path
import sys
import time
from urllib.parse import urljoin

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

base=(sys.argv[1] if len(sys.argv)>1 else os.environ.get("PWA_URL","")).strip()
if not base:
    raise SystemExit("Informe a URL publicada")
if not base.endswith("/"):
    base+="/"

out_dir=Path(os.environ.get("LAYOUT_AUDIT_DIR") or "/tmp/layout-audit")
out_dir.mkdir(parents=True,exist_ok=True)
strict=os.environ.get("LAYOUT_AUDIT_STRICT","0")=="1"
contest="demhab-poa-arquiteto-2026"

pages=[
    ("hoje","index.html#home"),
    ("planejamento",f"planejamento.html?contest={contest}"),
    ("edital",f"edital.html?contest={contest}"),
    ("mapas",f"biblioteca.html?contest={contest}"),
    ("revisoes",f"revisoes.html?contest={contest}"),
    ("questoes",f"questoes.html?contest={contest}"),
    ("simulados",f"simulados.html?contest={contest}"),
    ("erros",f"erros.html?contest={contest}"),
    ("desempenho",f"desempenho.html?contest={contest}"),
    ("diagnostico",f"diagnostico.html?contest={contest}"),
    ("historico",f"historico.html?contest={contest}"),
    ("arquivos",f"arquivos.html?contest={contest}"),
    ("configuracoes",f"configuracoes.html?contest={contest}"),
]

viewports=[
    (1920,1080),(1600,1000),(1440,1000),(1366,900),(1280,900),
    (1180,900),(1024,900),(834,1112),(820,1180),(768,1024),
    (430,932),(390,844),(375,812)
]
screenshot_widths={1920,1440,1024,834,430,375}
screenshot_pages={"mapas","configuracoes","hoje","planejamento","edital"}

options=Options()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-gpu")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--force-device-scale-factor=1")
options.set_capability("goog:loggingPrefs",{"browser":"ALL"})
driver=webdriver.Chrome(options=options)
driver.set_page_load_timeout(45)
driver.set_script_timeout(30)

def wait_ready():
    WebDriverWait(driver,25).until(lambda d:d.execute_script("return document.readyState") in ("interactive","complete"))
    WebDriverWait(driver,25).until(lambda d:d.execute_script("return !!document.body && document.body.getBoundingClientRect().height > 20"))
    time.sleep(.18)

def measure(page):
    return driver.execute_script(r"""
      const page=arguments[0],vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
      const visible=el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&r.width>1&&r.height>1;
      };
      const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
      const offenders=[];
      for(const el of document.querySelectorAll('body *')){
        if(!visible(el))continue;
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        if(s.position==='fixed'||s.position==='sticky')continue;
        if(r.right>vw+2||r.left<-2){
          offenders.push({tag:el.tagName.toLowerCase(),id:el.id||'',cls:String(el.className||'').slice(0,120),rect:rect(el),overflowX:s.overflowX});
          if(offenders.length>=12)break;
        }
      }
      const cardSel=page==='mapas'?'.library-card':null;
      const overlaps=[];
      if(cardSel){
        const cards=[...document.querySelectorAll(cardSel)].filter(visible);
        for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){
          const a=cards[i].getBoundingClientRect(),b=cards[j].getBoundingClientRect();
          const ix=Math.min(a.right,b.right)-Math.max(a.left,b.left);
          const iy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
          if(ix>1&&iy>1)overlaps.push({a:i,b:j,ix:Math.round(ix*10)/10,iy:Math.round(iy*10)/10,ra:rect(cards[i]),rb:rect(cards[j])});
        }
      }
      const topbar=document.querySelector('.pa-topbar');
      const content=document.querySelector('.pa-content');
      const sidebar=document.querySelector('.pa-sidebar');
      const h1=document.querySelector('.pa-top-title');
      const buttons=[...document.querySelectorAll('button')].filter(visible).map((el,i)=>({i,text:(el.textContent||'').trim().slice(0,80),rect:rect(el)})).filter(x=>x.rect.width<28||x.rect.height<28);
      const interactiveOverflow=[...document.querySelectorAll('button,input,select,a')].filter(visible).map(el=>({tag:el.tagName.toLowerCase(),text:(el.textContent||el.getAttribute('placeholder')||'').trim().slice(0,80),rect:rect(el)})).filter(x=>x.rect.right>vw+2||x.rect.left<-2);
      return{
        page,vw,vh,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
        horizontalOverflow:document.documentElement.scrollWidth>vw+2,
        offenders,overlaps,smallButtons:buttons.slice(0,20),interactiveOverflow:interactiveOverflow.slice(0,20),
        topbar:topbar?rect(topbar):null,content:content?rect(content):null,sidebar:sidebar?rect(sidebar):null,topTitle:h1?(h1.textContent||'').trim():'',
        map:{
          grid:document.querySelector('.library-grid')?rect(document.querySelector('.library-grid')):null,
          cards:[...document.querySelectorAll('.library-card')].filter(visible).slice(0,12).map(rect)
        }
      };
    """,page)

rows=[]
errors=[]
try:
    for width,height in viewports:
        driver.set_window_size(width,height)
        for page,rel in pages:
            driver.get(urljoin(base,rel))
            wait_ready()
            data=measure(page)
            data["requestedViewport"]={"width":width,"height":height}
            data["url"]=driver.current_url
            rows.append(data)
            if data["horizontalOverflow"]:
                errors.append(f"{page}@{width}: overflow horizontal {data['scrollWidth']}>{data['vw']}")
            if data["interactiveOverflow"]:
                errors.append(f"{page}@{width}: controle fora da viewport")
            if data["overlaps"]:
                errors.append(f"{page}@{width}: {len(data['overlaps'])} sobreposicao(oes) de cards")
            if width in screenshot_widths and page in screenshot_pages:
                driver.save_screenshot(str(out_dir/f"{page}-{width}.png"))
    (out_dir/"report.json").write_text(json.dumps({"base":base,"rows":rows,"errors":errors},ensure_ascii=False,indent=2),"utf-8")
    summary={
        "base":base,
        "pages":len(pages),
        "viewports":len(viewports),
        "cases":len(rows),
        "errors":errors,
        "map_overlaps":[{"page":r["page"],"width":r["requestedViewport"]["width"],"count":len(r["overlaps"]),"cards":r["map"]["cards"]} for r in rows if r["overlaps"]],
        "horizontal_overflow":[{"page":r["page"],"width":r["requestedViewport"]["width"],"scrollWidth":r["scrollWidth"],"clientWidth":r["vw"],"offenders":r["offenders"]} for r in rows if r["horizontalOverflow"]]
    }
    (out_dir/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),"utf-8")
    print(json.dumps(summary,ensure_ascii=False,indent=2))
    if strict and errors:
        raise SystemExit(1)
finally:
    driver.quit()
