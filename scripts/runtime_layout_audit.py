#!/usr/bin/env python3
import json
import os
from pathlib import Path
import sys
import time
from urllib.parse import urljoin

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
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

# Matriz pedida + larguras intermediárias + rotações landscape.
viewports=[
    (1920,1080),(1600,1000),(1440,1000),(1366,900),(1280,900),
    (1180,900),(1100,900),(1024,900),(950,900),
    (834,1112),(820,1180),(768,1024),(720,900),(540,900),
    (430,932),(390,844),(375,812),
    (1180,820),(1024,768),(932,430),(844,390),(812,375)
]

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
driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument",{"source":"""
window.__planoArqLayoutShifts=[];
try{
  new PerformanceObserver(list=>{
    for(const e of list.getEntries()){
      if(!e.hadRecentInput)window.__planoArqLayoutShifts.push({value:e.value,startTime:e.startTime});
    }
  }).observe({type:'layout-shift',buffered:true});
}catch(_){}
"""})

def wait_ready():
    WebDriverWait(driver,25).until(lambda d:d.execute_script("return document.readyState") in ("interactive","complete"))
    WebDriverWait(driver,25).until(lambda d:d.execute_script("return !!document.body && document.body.getBoundingClientRect().height > 20"))
    time.sleep(.18)

def measure(page):
    return driver.execute_script(r"""
      const page=arguments[0],vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
      const hiddenByClosedLayer=el=>{
        if(el.closest('[hidden]'))return true;
        const sidebar=el.closest('.pa-sidebar');
        if(vw<=900&&sidebar&&!sidebar.classList.contains('open'))return true;
        const more=el.closest('.pa-mobile-more');
        if(more&&!more.classList.contains('open'))return true;
        const viewer=el.closest('.viewer');
        if(viewer&&!viewer.classList.contains('open'))return true;
        const modal=el.closest('.pa-shell-modal,.dialog-layer,.settings-lock-layer,.modal');
        if(modal){
          if(modal.matches('.settings-lock-layer'))return modal.hasAttribute('hidden');
          if(modal.matches('.modal'))return !modal.classList.contains('open');
          return !modal.classList.contains('open');
        }
        return false;
      };
      const visible=el=>{
        if(hiddenByClosedLayer(el))return false;
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&r.width>1&&r.height>1;
      };
      const inHorizontalScroller=el=>{
        for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){
          const s=getComputedStyle(p);
          if((s.overflowX==='auto'||s.overflowX==='scroll')&&p.scrollWidth>p.clientWidth+2)return true;
        }
        return false;
      };
      const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
      const offenders=[];
      for(const el of document.querySelectorAll('body *')){
        if(!visible(el)||inHorizontalScroller(el))continue;
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
      const topLeft=document.querySelector('.pa-topbar-left'),topActions=document.querySelector('.pa-top-actions');
      const topbarOverlap=topLeft&&topActions&&visible(topLeft)&&visible(topActions)?(()=>{
        const x=topLeft.getBoundingClientRect(),y=topActions.getBoundingClientRect();
        return Math.max(0,Math.min(x.right,y.right)-Math.max(x.left,y.left))>1&&Math.max(0,Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top))>1;
      })():false;
      const controls=[...document.querySelectorAll('button,input,select,a')].filter(visible);
      const smallButtons=[...document.querySelectorAll('button')].filter(visible).map((el,i)=>({i,text:(el.textContent||'').trim().slice(0,80),rect:rect(el)})).filter(x=>x.rect.width<28||x.rect.height<28);
      const interactiveOverflow=controls.filter(el=>!inHorizontalScroller(el)).map(el=>({tag:el.tagName.toLowerCase(),text:(el.textContent||el.getAttribute('placeholder')||'').trim().slice(0,80),rect:rect(el)})).filter(x=>x.rect.right>vw+2||x.rect.left<-2);
      const clippedControls=controls.filter(el=>!inHorizontalScroller(el)).filter(el=>{
        const s=getComputedStyle(el);
        return s.whiteSpace!=='normal'&&el.scrollWidth>el.clientWidth+3;
      }).slice(0,12).map(el=>({tag:el.tagName.toLowerCase(),text:(el.textContent||el.getAttribute('placeholder')||'').trim().slice(0,80),clientWidth:el.clientWidth,scrollWidth:el.scrollWidth}));
      const graphics=[...document.querySelectorAll('canvas,svg')].filter(visible).filter(el=>{
        const r=el.getBoundingClientRect();return r.right>vw+2||r.left<-2||r.width>vw+2;
      }).slice(0,12).map(el=>({tag:el.tagName.toLowerCase(),rect:rect(el)}));
      const shifts=(window.__planoArqLayoutShifts||[]).reduce((a,x)=>a+Number(x.value||0),0);
      const sidebars=[...document.querySelectorAll('.pa-sidebar')];
      const menuButtons=[...document.querySelectorAll('.pa-menu-btn')];
      const mobileNavs=[...document.querySelectorAll('#paMobileNav')];
      const mobileMores=[...document.querySelectorAll('#paMobileMore')];
      const legacyMobile=[...document.querySelectorAll('.mobile-bottom')];
      const mobileTargets=mobileNavs.flatMap(nav=>[...nav.querySelectorAll('a,button')]).filter(visible).map(el=>rect(el));
      const navigation={
        sidebarCount:sidebars.length,
        menuButtonCount:menuButtons.length,
        mobileNavCount:mobileNavs.length,
        mobileMoreCount:mobileMores.length,
        legacyMobileCount:legacyMobile.length,
        sidebarVisible:sidebars.some(visible),
        menuVisible:menuButtons.some(visible),
        mobileNavVisible:mobileNavs.some(visible),
        mobileMoreVisible:mobileMores.some(visible),
        sidebarOpen:sidebars.some(x=>x.classList.contains('open')),
        mobileMoreOpen:mobileMores.some(x=>x.classList.contains('open')),
        mobileTargets
      };
      return{
        page,vw,vh,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
        horizontalOverflow:document.documentElement.scrollWidth>vw+2,
        offenders,overlaps,smallButtons:smallButtons.slice(0,20),interactiveOverflow:interactiveOverflow.slice(0,20),
        clippedControls,graphicsOutside:graphics,layoutShiftScore:shifts,navigation,
        topbar:topbar?rect(topbar):null,content:content?rect(content):null,sidebar:sidebar?rect(sidebar):null,topTitle:h1?(h1.textContent||'').trim():'',topbarOverlap,
        map:{
          grid:document.querySelector('.library-grid')?rect(document.querySelector('.library-grid')):null,
          cards:[...document.querySelectorAll('.library-card')].filter(visible).slice(0,14).map(rect)
        }
      };
    """,page)

def append_errors(data,label,errors):
    if data["horizontalOverflow"]:
        errors.append(f"{label}: overflow horizontal {data['scrollWidth']}>{data['vw']}")
    if data["interactiveOverflow"]:
        errors.append(f"{label}: controle fora da viewport")
    if data["overlaps"]:
        errors.append(f"{label}: {len(data['overlaps'])} sobreposicao(oes) de cards")
    if data.get("topbarOverlap"):
        errors.append(f"{label}: topbar com colisao entre titulo e acoes")
    if data.get("clippedControls"):
        errors.append(f"{label}: controle com texto cortado")
    if data.get("graphicsOutside"):
        errors.append(f"{label}: grafico fora da viewport")
    if float(data.get("layoutShiftScore") or 0)>0.25:
        errors.append(f"{label}: layout shift alto ({data['layoutShiftScore']:.3f})")
    if data.get("page")!="hoje":
        nav=data.get("navigation") or {}
        for key,expected in (
            ("sidebarCount",1),("menuButtonCount",1),("mobileNavCount",1),("mobileMoreCount",1),("legacyMobileCount",0)
        ):
            if int(nav.get(key,-1))!=expected:
                errors.append(f"{label}: contrato de navegação divergente em {key}={nav.get(key)!r}; esperado {expected}")
        if int(data.get("vw") or 0)<=900:
            if not nav.get("menuVisible"):
                errors.append(f"{label}: botão do drawer não está visível em tablet/mobile")
            if not nav.get("mobileNavVisible"):
                errors.append(f"{label}: navegação mobile canônica não está visível")
            if nav.get("sidebarVisible") or nav.get("sidebarOpen"):
                errors.append(f"{label}: sidebar iniciou aberta junto da navegação mobile")
            tiny=[r for r in nav.get("mobileTargets") or [] if r.get("height",0)<44 or r.get("width",0)<44]
            if tiny:
                errors.append(f"{label}: alvo da navegação mobile menor que 44px")
        else:
            if not nav.get("sidebarVisible"):
                errors.append(f"{label}: sidebar desktop não está visível")
            if nav.get("menuVisible"):
                errors.append(f"{label}: botão do drawer apareceu no desktop")
            if nav.get("mobileNavVisible"):
                errors.append(f"{label}: navegação mobile apareceu no desktop")

def rect_inside_viewport(rect,vw,vh,tolerance=2):
    if not rect:return False
    return rect["left"]>=-tolerance and rect["right"]<=vw+tolerance and rect["top"]>=-tolerance and rect["bottom"]<=vh+tolerance

rows=[]
errors=[]
modal_cases=[]
sidebar_cases=[]
long_text_cases=[]
zoom_cases=[]
scale_cases=[]
interactive_cases=[]
touch_cases=[]
functional_cases=[]

try:
    # Matriz completa: todas as páginas são abertas/renderizadas e fotografadas.
    for width,height in viewports:
        driver.set_window_size(width,height)
        for page,rel in pages:
            driver.get(urljoin(base,rel))
            wait_ready()
            data=measure(page)
            data["requestedViewport"]={"width":width,"height":height}
            data["url"]=driver.current_url
            rows.append(data)
            append_errors(data,f"{page}@{width}x{height}",errors)
            driver.save_screenshot(str(out_dir/f"{page}-{width}x{height}.png"))

    # Sidebar aberta em tablet/mobile, incluindo rotação.
    for width,height in ((834,1112),(430,932),(844,390)):
        driver.set_window_size(width,height)
        driver.get(urljoin(base,f"planejamento.html?contest={contest}"))
        wait_ready()
        menu=driver.find_element(By.CSS_SELECTOR,".pa-menu-btn")
        menu.click()
        WebDriverWait(driver,5).until(lambda d:d.execute_script("const e=document.querySelector('.pa-sidebar');return e?.classList.contains('open')===true && e.getBoundingClientRect().left>=-2"))
        info=driver.execute_script("""
          const e=document.querySelector('.pa-sidebar'),r=e.getBoundingClientRect(),vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
          return {rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},vw,vh,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight};
        """)
        info["requestedViewport"]={"width":width,"height":height}
        info["ok"]=info["rect"]["left"]>=-2 and info["rect"]["right"]<=info["vw"]+2 and info["rect"]["top"]>=-2 and info["rect"]["bottom"]<=info["vh"]+2
        sidebar_cases.append(info)
        if not info["ok"]:errors.append(f"sidebar@{width}x{height}: painel fora da viewport")
        driver.save_screenshot(str(out_dir/f"sidebar-open-{width}x{height}.png"))

    # Interação real por toque em iPad/celular: um único menu mobile, drawer e "Mais" sem sobreposição.
    for width,height in ((834,1112),(390,844)):
        driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride",{"width":width,"height":height,"deviceScaleFactor":2,"mobile":False})
        driver.execute_cdp_cmd("Emulation.setTouchEmulationEnabled",{"enabled":True,"maxTouchPoints":5})
        for page,rel in (
            ("planejamento",f"planejamento.html?contest={contest}"),
            ("mapas",f"biblioteca.html?contest={contest}"),
            ("configuracoes",f"configuracoes.html?contest={contest}"),
        ):
            driver.get(urljoin(base,rel));wait_ready()
            base_state=driver.execute_script("""
              const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1};
              const targets=[...document.querySelectorAll('#paMobileNav a,#paMobileNav button')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return{width:r.width,height:r.height}});
              return {
                coarse:matchMedia('(pointer: coarse)').matches,
                touchPoints:navigator.maxTouchPoints||0,
                sidebarCount:document.querySelectorAll('.pa-sidebar').length,
                menuCount:document.querySelectorAll('.pa-menu-btn').length,
                mobileNavCount:document.querySelectorAll('#paMobileNav').length,
                mobileMoreCount:document.querySelectorAll('#paMobileMore').length,
                legacyCount:document.querySelectorAll('.mobile-bottom').length,
                mobileVisible:visible(document.getElementById('paMobileNav')),
                menuVisible:visible(document.querySelector('.pa-menu-btn')),
                targets
              };
            """)
            driver.find_element(By.CSS_SELECTOR,".pa-menu-btn").click()
            WebDriverWait(driver,5).until(lambda d:d.execute_script("return document.querySelector('.pa-sidebar')?.classList.contains('open')===true"))
            drawer_state=driver.execute_script("""
              return {
                sidebarOpen:document.querySelector('.pa-sidebar')?.classList.contains('open')===true,
                moreOpen:document.getElementById('paMobileMore')?.classList.contains('open')===true
              };
            """)
            driver.execute_script("document.querySelector('.pa-backdrop')?.click()")
            WebDriverWait(driver,5).until(lambda d:d.execute_script("return document.querySelector('.pa-sidebar')?.classList.contains('open')!==true"))
            driver.find_element(By.ID,"paMobileMoreBtn").click()
            WebDriverWait(driver,5).until(lambda d:d.execute_script("return document.getElementById('paMobileMore')?.classList.contains('open')===true"))
            more_state=driver.execute_script("""
              const m=document.getElementById('paMobileMore'),r=m.getBoundingClientRect(),vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
              return {
                moreOpen:m?.classList.contains('open')===true,
                sidebarOpen:document.querySelector('.pa-sidebar')?.classList.contains('open')===true,
                rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},
                vw,vh
              };
            """)
            ok=(
                base_state.get("coarse") is True
                and int(base_state.get("touchPoints") or 0)>0
                and base_state.get("sidebarCount")==1
                and base_state.get("menuCount")==1
                and base_state.get("mobileNavCount")==1
                and base_state.get("mobileMoreCount")==1
                and base_state.get("legacyCount")==0
                and base_state.get("mobileVisible") is True
                and base_state.get("menuVisible") is True
                and all(t.get("width",0)>=44 and t.get("height",0)>=44 for t in base_state.get("targets") or [])
                and drawer_state.get("sidebarOpen") is True
                and drawer_state.get("moreOpen") is False
                and more_state.get("moreOpen") is True
                and more_state.get("sidebarOpen") is False
                and rect_inside_viewport(more_state.get("rect"),more_state.get("vw"),more_state.get("vh"))
            )
            case={"page":page,"viewport":{"width":width,"height":height},"base":base_state,"drawer":drawer_state,"more":more_state,"ok":ok}
            touch_cases.append(case)
            if not ok:
                errors.append(f"touch-{page}@{width}x{height}: contrato de navegação responsiva falhou")
            driver.save_screenshot(str(out_dir/f"touch-{page}-{width}x{height}.png"))
            driver.find_element(By.ID,"paMobileMoreBtn").click()
        driver.execute_cdp_cmd("Emulation.setTouchEmulationEnabled",{"enabled":False,"maxTouchPoints":1})
        driver.execute_cdp_cmd("Emulation.clearDeviceMetricsOverride",{})

    # J8.2: interações funcionais principais em desktop, iPad e celular.
    def add_functional(page,width,height,checks):
        ok=all(bool(v) for v in checks.values())
        case={"page":page,"viewport":{"width":width,"height":height},"checks":checks,"ok":ok}
        functional_cases.append(case)
        if not ok:
            failed=", ".join(k for k,v in checks.items() if not v)
            errors.append(f"funcional-{page}@{width}x{height}: falhou em {failed}")

    for width,height in ((1440,1000),(834,1112),(390,844)):
        driver.set_window_size(width,height)

        # Central do Edital: tabs precisam alternar conteúdo sem trocar de página.
        driver.get(urljoin(base,f"edital.html?contest={contest}"));wait_ready()
        driver.find_element(By.CSS_SELECTOR,'[data-tab="exam"]').click()
        exam_tab=driver.execute_script("""
          const b=document.querySelector('[data-tab="exam"]'),v=document.querySelector('[data-view="exam"]');
          return !!b?.classList.contains('active') && !!v && v.hidden===false;
        """)
        driver.find_element(By.CSS_SELECTOR,'[data-tab="files"]').click()
        files_tab=driver.execute_script("""
          const b=document.querySelector('[data-tab="files"]'),v=document.querySelector('[data-view="files"]');
          return !!b?.classList.contains('active') && !!v && v.hidden===false;
        """)
        add_functional("edital",width,height,{"tabProva":exam_tab,"tabArquivos":files_tab})
        driver.save_screenshot(str(out_dir/f"funcional-edital-{width}x{height}.png"))

        # Biblioteca: pesquisa, filtro, ordenação e abertura/fechamento real de um mapa.
        driver.get(urljoin(base,f"biblioteca.html?contest={contest}"));wait_ready()
        before_cards=driver.execute_script("return document.querySelectorAll('.library-card').length")
        driver.execute_script("""
          const s=document.getElementById('search');s.value='__plano_arq_sem_resultado__';s.dispatchEvent(new Event('input',{bubbles:true}));
        """)
        no_results=driver.execute_script("return document.querySelectorAll('.library-card').length===0 && document.getElementById('empty')?.hidden===false")
        driver.execute_script("""
          const s=document.getElementById('search');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));
          const sort=document.getElementById('sortSelect');sort.value='title';sort.dispatchEvent(new Event('change',{bubbles:true}));
        """)
        restored=driver.execute_script("return document.querySelectorAll('.library-card').length===arguments[0] && document.getElementById('sortSelect')?.value==='title'",before_cards)
        filters=driver.find_elements(By.CSS_SELECTOR,"#statusFilters [data-status]")
        filter_ok=False
        if filters:
            filters[0].click()
            filter_ok=driver.execute_script("return document.querySelector('#statusFilters .filter.active')?.dataset.status===''")
        openers=driver.find_elements(By.CSS_SELECTOR,".library-card [data-open]")
        viewer_open=False
        viewer_closed=False
        if openers:
            openers[0].click()
            try:
                WebDriverWait(driver,8).until(lambda d:d.execute_script("return document.getElementById('viewer')?.classList.contains('open')===true"))
                viewer_open=driver.execute_script("""
                  const v=document.getElementById('viewer'),f=document.getElementById('frame'),n=document.getElementById('viewerName');
                  return v?.classList.contains('open')===true && !!f && (f.src!=='about:blank'||(f.srcdoc||'').length>100) && (n?.textContent||'').trim()!=='Material';
                """)
                driver.find_element(By.ID,"closeBtn").click()
                WebDriverWait(driver,5).until(lambda d:d.execute_script("return document.getElementById('viewer')?.classList.contains('open')!==true"))
                viewer_closed=driver.execute_script("return document.body.style.overflow!=='hidden' && document.getElementById('frame')?.src==='about:blank'")
            except Exception:
                viewer_open=False
        add_functional("mapas",width,height,{"temCards":before_cards>0,"pesquisaVazia":no_results,"restauraBuscaOrdena":restored,"filtro":filter_ok,"abreMapa":viewer_open,"fechaMapa":viewer_closed})
        driver.save_screenshot(str(out_dir/f"funcional-mapas-{width}x{height}.png"))

        # Planejamento: formulário e presets devem reagir sem persistir alterações de auditoria.
        driver.get(urljoin(base,f"planejamento.html?contest={contest}"));wait_ready()
        first_hours=driver.find_elements(By.CSS_SELECTOR,"[data-hours]")
        preset=driver.find_elements(By.CSS_SELECTOR,'[data-preset="strong"]')
        preset_ok=False
        input_ok=False
        if preset and first_hours:
            preset[0].click()
            preset_ok=driver.execute_script("return [...document.querySelectorAll('[data-hours]')].some(x=>Number(x.value)>=3)")
            el=driver.find_elements(By.CSS_SELECTOR,"[data-hours]")[0]
            key=el.get_attribute("data-hours")
            driver.execute_script("arguments[0].value='2.5';arguments[0].dispatchEvent(new Event('input',{bubbles:true}))",el)
            input_ok=driver.execute_script("""
              const k=arguments[0],e=document.querySelector('[data-hours="'+k+'"]'),label=document.querySelector('[data-effective="'+k+'"]');
              return Number(e?.value)===2.5 && !!(label?.textContent||'').trim();
            """,key)
        add_functional("planejamento",width,height,{"preset":preset_ok,"entradaHoras":input_ok,"gerarDisponivel":driver.execute_script("return document.getElementById('generateBtn')?.disabled===false")})
        driver.save_screenshot(str(out_dir/f"funcional-planejamento-{width}x{height}.png"))

        # Questões: filtros/pesquisa e abertura do motor original.
        driver.get(urljoin(base,f"questoes.html?contest={contest}"));wait_ready()
        all_chip=driver.find_elements(By.CSS_SELECTOR,'[data-filter="all"]')
        q_filter=False
        q_search=False
        q_view=False
        q_close=False
        if all_chip:
            all_chip[0].click()
            q_filter=driver.execute_script("return document.querySelector('[data-filter="all"]')?.classList.contains('active')===true")
            driver.execute_script("""
              const s=document.getElementById('search');s.value='__sem_topico__';s.dispatchEvent(new Event('input',{bubbles:true}));
            """)
            q_search=driver.execute_script("return document.querySelector('#queue .empty')!==null")
            driver.execute_script("""
              const s=document.getElementById('search');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));
            """)
            trainers=driver.find_elements(By.CSS_SELECTOR,"#queue [data-train]")
            if trainers:
                trainers[0].click()
                try:
                    WebDriverWait(driver,8).until(lambda d:d.execute_script("return document.getElementById('viewer')?.classList.contains('open')===true"))
                    q_view=driver.execute_script("return document.getElementById('questionFrame')?.src!=='about:blank'")
                    driver.find_element(By.ID,"viewerClose").click()
                    q_close=driver.execute_script("return document.getElementById('viewer')?.classList.contains('open')!==true")
                except Exception:
                    q_view=False
        add_functional("questoes",width,height,{"filtroTodos":q_filter,"pesquisa":q_search,"abreTreino":q_view,"fechaTreino":q_close})
        driver.save_screenshot(str(out_dir/f"funcional-questoes-{width}x{height}.png"))

        # Revisões: filtros permanecem funcionais mesmo com fila vazia.
        driver.get(urljoin(base,f"revisoes.html?contest={contest}"));wait_ready()
        rev_all=driver.find_elements(By.CSS_SELECTOR,'[data-filter="all"]')
        rev_filter=False
        rev_search=False
        if rev_all:
            rev_all[0].click()
            rev_filter=driver.execute_script("return document.querySelector('[data-filter="all"]')?.classList.contains('active')===true")
            driver.execute_script("""
              const s=document.getElementById('search');s.value='auditoria';s.dispatchEvent(new Event('input',{bubbles:true}));
            """)
            rev_search=driver.execute_script("return document.getElementById('queue')!==null && document.getElementById('queueCount')!==null")
        add_functional("revisoes",width,height,{"filtroTodas":rev_filter,"pesquisa":rev_search})
        driver.save_screenshot(str(out_dir/f"funcional-revisoes-{width}x{height}.png"))

        # Arquivos: filtro oficial e viewer do edital.
        driver.get(urljoin(base,f"arquivos.html?contest={contest}"));wait_ready()
        official=driver.find_elements(By.CSS_SELECTOR,'[data-filter="official"]')
        file_filter=False
        file_open=False
        file_close=False
        if official:
            official[0].click()
            file_filter=driver.execute_script("return document.querySelector('[data-filter="official"]')?.classList.contains('active')===true && document.querySelectorAll('.file-row').length>=1")
            open_btn=driver.find_elements(By.CSS_SELECTOR,".file-row [data-open]")
            if open_btn:
                open_btn[0].click()
                try:
                    WebDriverWait(driver,6).until(lambda d:d.execute_script("return document.getElementById('viewer')?.classList.contains('open')===true"))
                    file_open=driver.execute_script("return document.getElementById('fileFrame')?.src!=='about:blank' && (document.getElementById('viewerTitle')?.textContent||'').trim().length>0")
                    driver.find_element(By.ID,"viewerClose").click()
                    file_close=driver.execute_script("return document.getElementById('viewer')?.classList.contains('open')!==true")
                except Exception:
                    file_open=False
        add_functional("arquivos",width,height,{"filtroOficial":file_filter,"abreDocumento":file_open,"fechaDocumento":file_close})
        driver.save_screenshot(str(out_dir/f"funcional-arquivos-{width}x{height}.png"))

        # Configurações: preferência local e modal de confirmação sem executar ação destrutiva.
        driver.get(urljoin(base,f"configuracoes.html?contest={contest}"));wait_ready()
        original_prefs=driver.execute_script("return localStorage.getItem('planoarq:preferences:v1')")
        driver.execute_script("""
          const d=document.getElementById('density');d.value='compact';d.dispatchEvent(new Event('change',{bubbles:true}));
        """)
        density_ok=driver.execute_script("""
          const p=JSON.parse(localStorage.getItem('planoarq:preferences:v1')||'{}');
          return p.density==='compact' && document.documentElement.dataset.paDensity==='compact';
        """)
        driver.find_element(By.ID,"resetContest").click()
        dialog_open=driver.execute_script("return document.getElementById('dialog')?.classList.contains('open')===true && document.getElementById('dialogInput')?.hidden===false")
        driver.find_element(By.ID,"dialogCancel").click()
        dialog_close=driver.execute_script("return document.getElementById('dialog')?.classList.contains('open')!==true")
        driver.execute_script("""
          const raw=arguments[0];
          if(raw===null)localStorage.removeItem('planoarq:preferences:v1');else localStorage.setItem('planoarq:preferences:v1',raw);
          dispatchEvent(new Event('planoarq:preferences'));
        """,original_prefs)
        add_functional("configuracoes",width,height,{"densidade":density_ok,"abreModal":dialog_open,"cancelaModal":dialog_close})
        driver.save_screenshot(str(out_dir/f"funcional-configuracoes-{width}x{height}.png"))

        # Navegação entre módulos pelo controle canônico visível em cada largura.
        driver.get(urljoin(base,f"planejamento.html?contest={contest}"));wait_ready()
        if width>900:
            nav=driver.find_element(By.CSS_SELECTOR,'.pa-sidebar [data-pa-nav="edital"]')
        else:
            nav=driver.find_element(By.CSS_SELECTOR,'#paMobileNav a[href*="edital.html"]')
        nav.click()
        try:
            WebDriverWait(driver,6).until(lambda d:"edital.html" in d.current_url)
            nav_ok=driver.execute_script("return document.body.dataset.paPage==='edital'")
        except Exception:
            nav_ok=False
        add_functional("navegacao",width,height,{"planejamentoParaEdital":nav_ok})

    # Wizard Novo Concurso: três etapas, sem concluir a criação.
    for width,height in ((1440,1000),(834,1112),(430,932),(375,812)):
        driver.set_window_size(width,height)
        driver.get(urljoin(base,"index.html#home"))
        wait_ready()
        driver.find_element(By.ID,"newBtn").click()
        WebDriverWait(driver,5).until(lambda d:d.execute_script("return document.getElementById('modal')?.classList.contains('open')===true"))
        for step in (1,2,3):
            if step==2:
                WebDriverWait(driver,5).until(lambda d:d.execute_script("""return typeof window.PLANO_ARQ_CONTEST_IMPORT?.renderReview==='function' && typeof document.getElementById('manualContestBtn')?.onclick==='function'"""))
                driver.execute_script("""
                  const w=window.PLANO_ARQ_CONTEST_IMPORT;
                  w.state.mode='manual';w.state.step=2;
                  w.state.draft={title:'',organization:'',position:'Arquiteto',board:'',city:'',notice:'',examDate:'',note:'',source:'manual',durationMinutes:210,
                    sections:[
                      {id:'specific',label:'Conhecimentos Específicos de Arquitetura e Urbanismo',questions:40,pointsPerQuestion:2,totalPoints:80,minimumPoints:40,mapGroups:['Conhecimentos Específicos']},
                      {id:'legislation',label:'Legislação Municipal e Federal',questions:10,pointsPerQuestion:1,totalPoints:10,minimumPoints:5,mapGroups:['Legislação']},
                      {id:'portuguese',label:'Língua Portuguesa',questions:10,pointsPerQuestion:1,totalPoints:10,minimumPoints:5,mapGroups:['Língua Portuguesa']}
                    ],
                    stages:[{id:'objective',type:'objective',label:'Prova Teórico-Objetiva',durationMinutes:210,totalQuestions:60,totalPoints:100,sections:[]}],
                    schedule:[
                      {date:'2027-10-18',label:'Aplicação da Prova Teórico-Objetiva',kind:'exam',status:'edital'},
                      {date:'2027-10-20',label:'Divulgação do gabarito preliminar',kind:'answer-key',status:'edital'}
                    ]
                  };
                  w.renderReview();w.updateSteps();document.getElementById('nextStep').hidden=false;
                  document.getElementById('rwTitle').value='Prefeitura Municipal de Nome Muito Longo para Teste Responsivo';
                  document.getElementById('rwPosition').value='Arquiteto e Urbanista - Planejamento, Projetos e Fiscalização';
                """)
            elif step==3:
                driver.execute_script("document.getElementById('rwNotice').value='Edital de Abertura 001/2027 com retificações';document.getElementById('rwNote').value='Observação extensa para testar conteúdo variável sem quebrar a composição do modal.';")
                driver.find_element(By.ID,"nextStep").click()
                WebDriverWait(driver,5).until(lambda d:d.execute_script("""return document.querySelector('[data-step="3"]')?.hidden===false"""))
            info=driver.execute_script("""
              const m=document.getElementById('modal'),e=m.querySelector('.dialog'),r=e.getBoundingClientRect(),vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
              return {step:arguments[0],rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},vw,vh,pageScrollWidth:document.documentElement.scrollWidth,dialogScrollHeight:e.scrollHeight,dialogClientHeight:e.clientHeight};
            """,step)
            info["requestedViewport"]={"width":width,"height":height}
            info["ok"]=rect_inside_viewport(info["rect"],info["vw"],info["vh"]) and info["pageScrollWidth"]<=info["vw"]+2
            modal_cases.append(info)
            if not info["ok"]:errors.append(f"novo-concurso etapa {step}@{width}x{height}: modal fora da viewport/overflow")
            driver.save_screenshot(str(out_dir/f"novo-concurso-step{step}-{width}x{height}.png"))
        driver.find_element(By.ID,"cancelBtn").click()

    # Etapa E: cria um concurso temporário, persiste schema e PDF local e valida consumidores dinâmicos.
    driver.set_window_size(834,1112)
    driver.get(urljoin(base,"index.html#home"))
    wait_ready()
    driver.find_element(By.ID,"newBtn").click()
    WebDriverWait(driver,5).until(lambda d:d.execute_script("return document.getElementById('modal')?.classList.contains('open')===true"))
    driver.execute_script("""
      const w=window.PLANO_ARQ_CONTEST_IMPORT;
      w.state.mode='auto';w.state.step=3;
      w.state.file=new File(['%PDF-1.4\\n% Plano ARQ audit\\n%%EOF'],'edital-auditoria.pdf',{type:'application/pdf'});
      w.state.draft={
        title:'Concurso Auditoria Etapa E',organization:'Órgão de Auditoria',position:'Arquiteto',board:'FUNDATEC',
        city:'Porto Alegre/RS',notice:'Edital 999/2027',examDate:'2027-10-18',publicationDate:'2027-01-10',
        sections:[{id:'specific',label:'Conhecimentos Específicos',questions:40,pointsPerQuestion:2,totalPoints:80,mapGroups:['Conhecimentos Específicos']},{id:'portuguese',label:'Língua Portuguesa',questions:20,pointsPerQuestion:1,totalPoints:20,mapGroups:['Língua Portuguesa']}],
        stages:[{id:'objective',type:'objective',label:'Prova Objetiva',planningMode:'weighted-sections',date:'2027-10-18',totalQuestions:60,totalPoints:100,sections:[{id:'specific',label:'Conhecimentos Específicos',questions:40,pointsPerQuestion:2,totalPoints:80,mapGroups:['Conhecimentos Específicos']},{id:'portuguese',label:'Língua Portuguesa',questions:20,pointsPerQuestion:1,totalPoints:20,mapGroups:['Língua Portuguesa']}]}],
        schedule:[{date:'2027-10-18',label:'Aplicação da prova',kind:'exam',status:'edital'}],
        content:[{label:'Conhecimentos Específicos',text:'Programa de auditoria',source:'edital'}],
        schema:{status:'reviewed',organization:'Órgão de Auditoria',position:'Arquiteto',board:'FUNDATEC',notice:'Edital 999/2027',examDate:{date:'2027-10-18',status:'edital'},stages:[{id:'objective',type:'objective',label:'Prova Objetiva',planningMode:'weighted-sections',date:'2027-10-18',totalQuestions:60,totalPoints:100,sections:[{id:'specific',label:'Conhecimentos Específicos',questions:40,pointsPerQuestion:2,totalPoints:80,mapGroups:['Conhecimentos Específicos']},{id:'portuguese',label:'Língua Portuguesa',questions:20,pointsPerQuestion:1,totalPoints:20,mapGroups:['Língua Portuguesa']}]}],schedule:[{date:'2027-10-18',label:'Aplicação da prova',kind:'exam',status:'edital'}],content:[{label:'Conhecimentos Específicos',text:'Programa de auditoria',source:'edital'}],rules:[]}
      };
      w.renderSummary();w.updateSteps();document.getElementById('nextStep').hidden=false;
    """)
    driver.find_element(By.ID,"nextStep").click()
    WebDriverWait(driver,8).until(lambda d:"edital.html?contest=" in d.current_url)
    dynamic_contest=driver.current_url.split("contest=",1)[1].split("&",1)[0]
    WebDriverWait(driver,5).until(lambda d:d.execute_script("return document.getElementById('mQuestions')?.textContent==='60'"))
    persisted=driver.execute_async_script("""
      const done=arguments[arguments.length-1],id=new URLSearchParams(location.search).get('contest'),D=window.PLANO_ARQ_DATA;
      (async()=>{try{
        const s=D.examSchemaForContest(id),fs=D.contestFiles(id),blob=await D.contestBlob(id,'edital-principal');
        done({ok:!!s&&s.stages?.[0]?.totalQuestions===60&&fs.some(f=>f.id==='edital-principal')&&blob?.blob?.size>0,id});
      }catch(e){done({ok:false,error:String(e)})}})();
    """)
    if not persisted.get("ok"):errors.append("novo-concurso Etapa E: schema/PDF não persistidos")
    study_blueprint=driver.execute_script("""
      const id=new URLSearchParams(location.search).get('contest'),b=JSON.parse(localStorage.getItem('planoarq:study-blueprint::'+id)||'null');
      return b?{ok:(b.maps||[]).length>=2&&(b.summary?.topics||0)>=1,maps:b.maps?.length||0,topics:b.summary?.topics||0,coverage:b.summary?.coveragePct||0}:{ok:false};
    """)
    if not study_blueprint.get("ok"):errors.append("novo-concurso Etapa G: estrutura de estudos não foi preparada")
    file_sync=driver.execute_async_script("""
      const done=arguments[arguments.length-1],id=new URLSearchParams(location.search).get('contest'),D=window.PLANO_ARQ_DATA,S=window.PLANO_ARQ_SYNC,oldFetch=window.fetch;
      const uid='00000000-0000-4000-8000-000000000001',objects=new Map(),base=S.config().url;
      localStorage.setItem('planoarq:supabase-session:v1',JSON.stringify({access_token:'audit-token',refresh_token:'audit-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'audit@example.com'},projectUrl:base}));
      window.fetch=async(url,opts={})=>{
        const u=String(url),marker='/plano-arq-contest-files/';
        if(u.includes('/storage/v1/object/authenticated/')&&u.includes(marker)){
          const path=decodeURIComponent(u.slice(u.indexOf(marker)+marker.length)),bytes=objects.get(path);
          return bytes?new Response(bytes,{status:200,headers:{'Content-Type':'application/pdf'}}):new Response(JSON.stringify({message:'not found'}),{status:404,headers:{'Content-Type':'application/json'}});
        }
        if(u.includes('/storage/v1/object/plano-arq-contest-files/')&&String(opts.method||'GET').toUpperCase()==='POST'){
          const path=decodeURIComponent(u.slice(u.indexOf(marker)+marker.length)),buf=await new Response(opts.body).arrayBuffer();objects.set(path,buf);
          return new Response(JSON.stringify({Key:path}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        return oldFetch(url,opts);
      };
      (async()=>{try{
        const first=await S.reconcileContestFiles(uid),meta=D.contestFiles(id).find(f=>f.id==='edital-principal');
        await D.deleteContestBlob(id,'edital-principal');
        const rec=await S.ensureContestFileLocal(id,meta);
        done({ok:first.uploaded===1&&!!meta?.cloudPath&&meta?.localOnly===false&&rec?.blob?.size>0,uploaded:first.uploaded,cloudPath:meta?.cloudPath||'',restored:rec?.blob?.size||0});
      }catch(e){done({ok:false,error:String(e)})}finally{window.fetch=oldFetch;localStorage.removeItem('planoarq:supabase-session:v1')}})();
    """)
    if not file_sync.get("ok"):errors.append("novo-concurso Etapa F: upload/download multi-dispositivo falhou: "+str(file_sync))
    driver.get(urljoin(base,"planejamento.html?contest="+dynamic_contest));wait_ready()
    if driver.execute_script("return document.querySelectorAll('#blueprint .blue-card').length")<2:errors.append("novo-concurso Etapa E: Planejamento não consumiu schema dinâmico")
    driver.get(urljoin(base,"arquivos.html?contest="+dynamic_contest));wait_ready()
    if driver.execute_script("return document.querySelectorAll('.file-row').length")<1:errors.append("novo-concurso Etapa E: Arquivos não consumiu edital local")
    driver.get(urljoin(base,"biblioteca.html?contest="+dynamic_contest));wait_ready()
    if driver.execute_script("return document.querySelectorAll('[data-planned-map]').length")<1:errors.append("novo-concurso Etapa G: Biblioteca não exibiu mapas preparados")
    h1=driver.execute_script("""
      const cid=new URLSearchParams(location.search).get('contest'),b=window.PLANO_ARQ_STUDY_BLUEPRINT?.load?.(cid),m=(b?.maps||[]).find(x=>x.topicCount>0),c=JSON.parse(localStorage.getItem('planoarq:contests:v1')||'[]').find(x=>x.id===cid)||{},s=JSON.parse(localStorage.getItem('planoarq:exam-schema::'+cid)||'null');
      if(!m)return {ok:false,reason:'no-map'};
      const cmd=window.PLANO_ARQ_STUDY_BLUEPRINT.generationCommand(cid,m.id,c,s);
      return {ok:!!document.querySelector('[data-copy-command="'+m.id+'"]')&&cmd.includes('GERAR MAPA DE ESTUDOS')&&cmd.includes('plano-arq-map-id = '+m.id)&&cmd.includes('TEMPLATE HTML OFICIAL MAIS RECENTE')&&cmd.includes(m.topics[0]),mapId:m.id,length:cmd.length};
    """)
    if not h1.get("ok"):errors.append("novo-concurso Etapa H1: comando de geração não ficou completo/acionável")
    h2=driver.execute_async_script("""
      const done=arguments[arguments.length-1],cid=new URLSearchParams(location.search).get('contest'),B=window.PLANO_ARQ_STUDY_BLUEPRINT,D=window.PLANO_ARQ_DATA,b=B.load(cid),m=(b?.maps||[]).find(x=>x.topicCount>0);
      if(!m){done({ok:false,reason:'no-map'});return}
      const sig=b.sourceSignature,html='<!doctype html><html><head><title>Mapa H2</title><meta name="plano-arq-contest-id" content="'+cid+'"><meta name="plano-arq-map-id" content="'+m.id+'"><meta name="plano-arq-blueprint-signature" content="'+sig+'"><meta name="mindmap-storage-id" content="audit-'+m.id+'"><meta name="study-display-title" content="Mapa H2"><meta name="study-short-code" content="H2"><meta name="study-file-version" content="V01"><link rel="stylesheet" href="../assets/css/study-map-shared-v01.css"></head><body><article data-topic-id="t1">Teste</article><script src="../assets/js/study-map-runtime-v01.js"><\/script></body></html>';
      const wrong=html.replace('content="'+m.id+'"','content="mapa-errado"');
      (async()=>{try{
        let rejected=false;try{await B.importGeneratedHtml(cid,m.id,new File([wrong],'errado.html',{type:'text/html'}))}catch(e){rejected=e?.code==='H2_CONTRACT_MISMATCH'}
        const result=await B.importGeneratedHtml(cid,m.id,new File([html],'mapa-h2.html',{type:'text/html'})),rec=await D.contestBlob(cid,'study-map-html::'+m.id),fresh=B.load(cid),saved=(fresh.maps||[]).find(x=>x.id===m.id);
        done({ok:rejected&&result.check.ok&&rec?.blob?.size>0&&saved?.status==='imported-pending-audit'&&!saved?.materialId&&!!document.querySelector('[data-import-html="'+m.id+'"]'),rejected,status:saved?.status,stored:rec?.blob?.size||0,materialId:saved?.materialId||''});
      }catch(e){done({ok:false,error:String(e)})}})();
    """)
    if not h2.get("ok"):errors.append("novo-concurso Etapa H2: importação/vínculo pendente do HTML falhou: "+str(h2))
    h3=driver.execute_async_script("""
      const done=arguments[arguments.length-1],cid=new URLSearchParams(location.search).get('contest'),B=window.PLANO_ARQ_STUDY_BLUEPRINT,D=window.PLANO_ARQ_DATA,b=B.load(cid),m=(b?.maps||[]).find(x=>x.topicCount>0);
      if(!m){done({ok:false,reason:'no-map'});return}
      const sig=b.sourceSignature,storageId='audit-h3-'+m.id,topic=(m.topics||[])[0]||'Programa de auditoria',group=m.group||m.sectionLabel||'Conhecimentos Específicos';
      const valid='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Mapa H3</title><meta name="plano-arq-contest-id" content="'+cid+'"><meta name="plano-arq-map-id" content="'+m.id+'"><meta name="plano-arq-blueprint-signature" content="'+sig+'"><meta name="mindmap-storage-id" content="'+storageId+'"><meta name="study-display-title" content="Mapa H3 Auditável"><meta name="study-short-title" content="Mapa H3"><meta name="study-short-code" content="H3"><meta name="study-file-version" content="V01"><meta name="study-library-group" content="'+group.replace(/"/g,'&quot;')+'"><meta name="plano-arq-bridge-version" content="1.3"><meta name="plano-arq-source-template" content="H3-AUDIT"><script src="../assets/js/study-map-bootstrap-v01.js"><\\/script><link rel="stylesheet" href="../assets/css/study-map-shared-v01.css"></head><body class="mindmap-app"><button id="searchToggle"></button><input id="search"><span id="searchInfo"></span><button id="expandBtn"></button><button id="collapseBtn"></button><button id="highBtn"></button><button id="reviewBtn"></button><button id="clearBtn"></button><button id="closeFileBtn"></button><button data-view="detail"></button><main><section id="mindmap" class="mindmap"><article class="branch-card" data-branch="r1">'+topic+'</article></section><section class="ramo" id="r1"><details class="topic-card" data-topic-id="h3-topic-1"><summary>'+topic+'</summary><div>'+topic+'<script type="application/json" class="v134-question-data">{}</scr'+'ipt></div></details></section></main><script src="../assets/js/study-map-runtime-v01.js"><\\/script></body></html>';
      (async()=>{try{
        await B.importGeneratedHtml(cid,m.id,new File([valid],'mapa-h3.html',{type:'text/html'}));
        const report=await B.auditImportedMap(cid,m.id);
        const activated=await B.activateImportedMap(cid,m.id),fresh=B.load(cid),saved=(fresh.maps||[]).find(x=>x.id===m.id),material=D.materialsForContest(cid).find(x=>x.id===storageId),file=D.contestFiles(cid).find(x=>x.id==='study-map-html::'+m.id);
        done({ok:report.ok&&saved?.status==='active'&&saved?.materialId===storageId&&!!material?.dynamic&&material?.src==='__indexeddb__'&&!!file?.linkedToMap,materialId:storageId,checks:report.checks?.length||0,topics:report.stats?.topicCount||0,status:saved?.status});
      }catch(e){done({ok:false,error:String(e),report:e?.report||null})}})();
    """)
    if not h3.get("ok"):errors.append("novo-concurso Etapa H3: auditoria/ativação falhou: "+str(h3))
    driver.get(urljoin(base,"biblioteca.html?contest="+dynamic_contest));wait_ready()
    if h3.get("ok"):
        material_id=h3.get("materialId")
        if not driver.execute_script("return [...document.querySelectorAll('[data-open]')].some(x=>x.dataset.open===arguments[0])",material_id):
            errors.append("novo-concurso Etapa H3: material ativo não apareceu na Biblioteca")
        else:
            driver.execute_script("const x=[...document.querySelectorAll('[data-open]')].find(x=>x.dataset.open===arguments[0]);if(x)x.click()",material_id)
            try:
                WebDriverWait(driver,6).until(lambda d:d.execute_script('return !!document.getElementById("frame")?.contentDocument?.querySelector(\'[data-topic-id="h3-topic-1"]\')'))
            except Exception:
                errors.append("novo-concurso Etapa H3: HTML ativo não abriu a partir do IndexedDB")
            driver.execute_script("document.getElementById('closeBtn')?.click()")
    driver.get(urljoin(base,"planejamento.html?contest="+dynamic_contest));wait_ready()
    if h3.get("ok") and driver.execute_script("return document.querySelectorAll('[data-priority]').length")<1:
        errors.append("novo-concurso Etapa H3: Planejamento não consumiu material ativado")
    if driver.execute_script("return document.querySelectorAll('[data-study-blueprint-note]').length")<1:errors.append("novo-concurso Etapa G: Planejamento não reconheceu mapas preparados")

    # Overlay do PIN sem alterar a configuração real do dispositivo.
    for width,height in ((834,1112),(430,932),(375,812)):
        driver.set_window_size(width,height)
        driver.get(urljoin(base,f"configuracoes.html?contest={contest}"))
        wait_ready()
        info=driver.execute_script("""
          const layer=document.getElementById('settingsLock'),shell=document.querySelector('.pa-shell');
          layer.hidden=false;if(shell)shell.inert=true;
          const e=layer.querySelector('.settings-lock-card'),r=e.getBoundingClientRect(),vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
          return {rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},vw,vh};
        """)
        info["requestedViewport"]={"width":width,"height":height}
        info["ok"]=rect_inside_viewport(info["rect"],info["vw"],info["vh"])
        modal_cases.append({"kind":"settings-pin",**info})
        if not info["ok"]:errors.append(f"pin-modal@{width}x{height}: modal fora da viewport")
        driver.save_screenshot(str(out_dir/f"pin-modal-{width}x{height}.png"))

    # Texto longo realista: títulos e concurso compridos não podem romper a malha.
    long_title="CONCURSO MUNICIPAL DE ARQUITETURA, URBANISMO, PLANEJAMENTO E FISCALIZAÇÃO — NOME EXTREMAMENTE LONGO"
    for width,height in ((834,1112),(430,932),(375,812)):
        for page,rel in (("mapas",f"biblioteca.html?contest={contest}"),("configuracoes",f"configuracoes.html?contest={contest}")):
            driver.set_window_size(width,height)
            driver.get(urljoin(base,rel))
            wait_ready()
            driver.execute_script("""
              const t=document.querySelector('.pa-top-title');if(t)t.textContent=arguments[0];
              const h=document.querySelector('.hero h1,.today-main-card h1');if(h)h.textContent=arguments[0];
            """,long_title)
            time.sleep(.15)
            driver.execute_script("window.__planoArqLayoutShifts=[]")
            data=measure(page)
            data["requestedViewport"]={"width":width,"height":height}
            long_text_cases.append(data)
            append_errors(data,f"texto-longo-{page}@{width}x{height}",errors)
            driver.save_screenshot(str(out_dir/f"stress-texto-longo-{page}-{width}x{height}.png"))

    # Estados interativos representativos: hover/focus não podem alterar geometria.
    for width,height in ((1440,1000),(430,932)):
        for page,rel,selector in (
            ("mapas",f"biblioteca.html?contest={contest}",".library-card .primary-btn"),
            ("configuracoes",f"configuracoes.html?contest={contest}","#saveSettingsPin"),
        ):
            driver.set_window_size(width,height)
            driver.get(urljoin(base,rel));wait_ready()
            el=driver.find_element(By.CSS_SELECTOR,selector)
            geom="const r=arguments[0].getBoundingClientRect(),sx=window.scrollX,sy=window.scrollY;return {x:r.x,y:r.y,width:r.width,height:r.height,scrollX:sx,scrollY:sy,docX:r.x+sx,docY:r.y+sy}"
            before=driver.execute_script(geom,el)
            ActionChains(driver).move_to_element(el).perform();time.sleep(.12)
            hover=driver.execute_script(geom,el)
            driver.execute_script("arguments[0].focus({preventScroll:true})",el);time.sleep(.08)
            focus=driver.execute_script(geom,el)
            stable=all(abs(before[k]-hover[k])<=1 and abs(before[k]-focus[k])<=1 for k in ("docX","docY","width","height"))
            case={"page":page,"viewport":{"width":width,"height":height},"selector":selector,"before":before,"hover":hover,"focus":focus,"stable":stable}
            interactive_cases.append(case)
            if not stable:errors.append(f"interacao-{page}@{width}: hover/focus alterou geometria")
            driver.save_screenshot(str(out_dir/f"interacao-{page}-{width}.png"))

    # Zoom do navegador via atalhos reais do Chrome.
    def reset_zoom():
        ActionChains(driver).key_down(Keys.CONTROL).send_keys("0").key_up(Keys.CONTROL).perform()
        time.sleep(.25)

    def zoom_steps(steps):
        reset_zoom()
        key="+" if steps>0 else "-"
        for _ in range(abs(steps)):
            ActionChains(driver).key_down(Keys.CONTROL).send_keys(key).key_up(Keys.CONTROL).perform()
            time.sleep(.18)

    zoom_map=[(80,-2),(100,0),(110,1),(125,2),(150,3)]
    driver.set_window_size(1440,1000)
    for page,rel in (("mapas",f"biblioteca.html?contest={contest}"),("configuracoes",f"configuracoes.html?contest={contest}")):
        driver.get(urljoin(base,rel));wait_ready();reset_zoom()
        baseline=driver.execute_script("return {innerWidth:innerWidth,dpr:devicePixelRatio}")
        for pct,steps in zoom_map:
            zoom_steps(steps)
            time.sleep(.2)
            state=driver.execute_script("return {innerWidth:innerWidth,innerHeight:innerHeight,dpr:devicePixelRatio}")
            data=measure(page)
            case={"page":page,"requestedZoom":pct,"baseline":baseline,"state":state,"diagnostics":data}
            zoom_cases.append(case)
            append_errors(data,f"zoom-{page}@{pct}%",errors)
            driver.save_screenshot(str(out_dir/f"zoom-{page}-{pct}.png"))
        reset_zoom()
    zoom_effective=any(c["requestedZoom"]!=100 and c["state"]["innerWidth"]!=c["baseline"]["innerWidth"] for c in zoom_cases)

    # Escala de renderização (DPR) para simular 100/125/150% de escala de tela.
    for dpr in (1,1.25,1.5):
        driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride",{"width":1366,"height":768,"deviceScaleFactor":dpr,"mobile":False})
        for page,rel in (("mapas",f"biblioteca.html?contest={contest}"),("configuracoes",f"configuracoes.html?contest={contest}")):
            driver.get(urljoin(base,rel));wait_ready()
            data=measure(page)
            case={"page":page,"dpr":dpr,"diagnostics":data}
            scale_cases.append(case)
            append_errors(data,f"escala-{page}@{dpr}",errors)
    driver.execute_cdp_cmd("Emulation.clearDeviceMetricsOverride",{})

    report={"base":base,"rows":rows,"modalCases":modal_cases,"sidebarCases":sidebar_cases,"touchCases":touch_cases,"functionalCases":functional_cases,"longTextCases":long_text_cases,"zoomCases":zoom_cases,"zoomEffective":zoom_effective,"scaleCases":scale_cases,"interactiveCases":interactive_cases,"errors":errors}
    (out_dir/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),"utf-8")
    summary={
        "base":base,
        "pages":len(pages),
        "viewports":len(viewports),
        "cases":len(rows),
        "modalCases":len(modal_cases),
        "sidebarCases":len(sidebar_cases),
        "touchCases":len(touch_cases),
        "touchFailures":[x for x in touch_cases if not x.get("ok")],
        "functionalCases":len(functional_cases),
        "functionalFailures":[x for x in functional_cases if not x.get("ok")],
        "navigationFailures":[{"page":r["page"],"viewport":r["requestedViewport"],"navigation":r.get("navigation")} for r in rows if any("navegação" in e and f"{r['page']}@{r['requestedViewport']['width']}x{r['requestedViewport']['height']}" in e for e in errors)],
        "longTextCases":len(long_text_cases),
        "zoomCases":len(zoom_cases),
        "zoomEffective":zoom_effective,
        "scaleCases":len(scale_cases),
        "interactiveCases":len(interactive_cases),
        "errors":errors,
        "map_overlaps":[{"page":r["page"],"viewport":r["requestedViewport"],"count":len(r["overlaps"]),"cards":r["map"]["cards"]} for r in rows if r["overlaps"]],
        "horizontal_overflow":[{"page":r["page"],"viewport":r["requestedViewport"],"scrollWidth":r["scrollWidth"],"clientWidth":r["vw"],"offenders":r["offenders"]} for r in rows if r["horizontalOverflow"]],
        "topbar_collisions":[{"page":r["page"],"viewport":r["requestedViewport"]} for r in rows if r.get("topbarOverlap")],
        "clipped_controls":[{"page":r["page"],"viewport":r["requestedViewport"],"items":r["clippedControls"]} for r in rows if r.get("clippedControls")],
        "high_layout_shift":[{"page":r["page"],"viewport":r["requestedViewport"],"score":r["layoutShiftScore"]} for r in rows if float(r.get("layoutShiftScore") or 0)>0.25]
    }
    (out_dir/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),"utf-8")
    print(json.dumps(summary,ensure_ascii=False,indent=2))
    if strict and errors:
        raise SystemExit(1)
finally:
    try: driver.execute_cdp_cmd("Emulation.setTouchEmulationEnabled",{"enabled":False,"maxTouchPoints":1})
    except Exception: pass
    try: driver.execute_cdp_cmd("Emulation.clearDeviceMetricsOverride",{})
    except Exception: pass
    driver.quit()
