#!/usr/bin/env python3
import json, os, sys, time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

base=(sys.argv[1] if len(sys.argv)>1 else os.getenv("PWA_URL") or "http://127.0.0.1:8765/").rstrip("/")+"/"
opts=Options()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1280,900")
driver=webdriver.Chrome(options=opts)
errors=[]
report={}
cid="demhab-poa-arquiteto-2026"

def wait(cond,timeout=20):
    WebDriverWait(driver,timeout).until(cond)

try:
    driver.get(base+"index.html")
    wait(lambda d:d.execute_script("return !!window.PlanoARQActions && !!window.PLANO_ARQ_MATERIALS"))
    today=driver.execute_script("""
      const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
    """)
    seed=driver.execute_script("""
      const cid=arguments[0],today=arguments[1],A=window.PlanoARQActions,m=(window.PLANO_ARQ_MATERIALS?.materials||[]).find(x=>!x.contestId||x.contestId===cid)||(window.PLANO_ARQ_MATERIALS?.materials||[])[0];
      const session={type:'study',materialId:m.id,shortCode:m.shortCode||'MAPA',title:m.title||'Material',minutes:50,time:'Flexível',start:null,end:null};
      const day={date:today,weekday:'Hoje',availableMinutes:60,studyMinutes:50,breakMinutes:10,sessions:[session]};
      localStorage.setItem('planoarq:generated-plan::'+cid,JSON.stringify({schema:3,contestId:cid,days:[day]}));
      localStorage.setItem('planoarq:session-log::'+cid,JSON.stringify({schema:2,sessions:{},extras:[],dayClosures:{}}));
      A.saveSettings({enabled:true,maxActions:4,rules:{planning:true,reviews:false,errors:false,simulations:false,questions:false}});
      return {materialId:m.id,shortCode:m.shortCode||'MAPA',title:m.title||'Material',sessionKey:today+'|0|'+m.id+'|study'};
    """,cid,today)
    report["seed"]=seed

    # Engine calls must be read-only after explicit setup.
    readonly=driver.execute_script("""
      const cid=arguments[0],A=window.PlanoARQActions;
      const snap=()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));
      const before=snap(),rows=A.build(cid),audit=A.audit(cid),after=snap();
      const x=rows[0]||{};
      return {
        ok:before===after&&x.id==='planning-today'&&x.source==='planning'&&!!x.why&&x.score>0&&x.planContext?.sessionKey&&audit.readOnly===true&&audit.selected?.[0]?.id==='planning-today',
        beforeEqAfter:before===after,
        top:{id:x.id,score:x.score,urgency:x.urgency,source:x.source,why:x.why,planContext:x.planContext,rankReason:x.rankReason},
        audit:{candidateCount:audit.candidateCount,selectedCount:audit.selectedCount,readOnly:audit.readOnly,sources:audit.sources}
      };
    """,cid)
    report["readOnly"]=readonly
    if not readonly.get("ok"): errors.append("motor de automação não permaneceu read-only/auditável")

    # Active work must outrank a merely planned session.
    ranking=driver.execute_script("""
      const cid=arguments[0],key=arguments[1],A=window.PlanoARQActions;
      localStorage.setItem('planoarq:session-log::'+cid,JSON.stringify({schema:2,sessions:{[key]:{status:'running',startedAt:new Date().toISOString(),pauses:[]}},extras:[],dayClosures:{}}));
      const rows=A.build(cid),x=rows[0]||{};
      return {ok:x.id==='session-active'&&x.score>=140&&x.urgency==='agora'&&x.bonuses?.some(b=>b.code==='active-session'),top:x,order:rows.map(r=>({id:r.id,score:r.score}))};
    """,cid,seed["sessionKey"])
    report["ranking"]=ranking
    if not ranking.get("ok"): errors.append("ordenação/urgência da automação não priorizou sessão ativa")

    # Empty state with no sources enabled is explicit and harmless.
    empty=driver.execute_script("""
      const cid=arguments[0],A=window.PlanoARQActions;
      A.saveSettings({enabled:true,rules:{planning:false,reviews:false,errors:false,simulations:false,questions:false}});
      const rows=A.build(cid),e=A.emptyState(cid);
      return {ok:rows.length===0&&e?.code==='no-sources'&&!!e?.detail,rows:rows.length,empty:e};
    """,cid)
    report["empty"]=empty
    if not empty.get("ok"): errors.append("estado vazio da automação não ficou explícito")

    # Restore planning-only and verify the Today UI explains + links without mutating progress.
    ui=driver.execute_script("""
      const cid=arguments[0],A=window.PlanoARQActions,key=arguments[1];
      A.saveSettings({enabled:true,rules:{planning:true,reviews:false,errors:false,simulations:false,questions:false}});
      localStorage.setItem('planoarq:session-log::'+cid,JSON.stringify({schema:2,sessions:{},extras:[],dayClosures:{}}));
      location.hash='contest/'+cid;
      return true;
    """,cid,seed["sessionKey"])
    wait(lambda d:d.execute_script("return !!document.querySelector('.auto-main') && !!document.querySelector('[data-auto-session]') && !!document.querySelector('.auto-why')"))
    ui=driver.execute_script("""
      const cid=arguments[0],key=arguments[1],btn=document.querySelector('[data-auto-session]'),card=[...document.querySelectorAll('[data-session-key]')].find(x=>x.dataset.sessionKey===key);
      const storageKey='planoarq:session-log::'+cid,before=localStorage.getItem(storageKey);
      btn.click();
      const after=localStorage.getItem(storageKey);
      return {
        ok:!!card&&before===after&&!!document.querySelector('.auto-chip')&&document.querySelector('.auto-why')?.textContent.includes('Por quê:')&&btn.textContent.trim().length>0,
        beforeEqAfter:before===after,
        button:btn.textContent.trim(),
        why:document.querySelector('.auto-why')?.textContent.trim()||'',
        chip:document.querySelector('.auto-chip')?.textContent.trim()||'',
        targeted:card?.classList.contains('auto-target')||false
      };
    """,cid,seed["sessionKey"])
    report["ui"]=ui
    if not ui.get("ok"): errors.append("Hoje não exibiu explicação/vínculo da automação sem alterar progresso")

finally:
    driver.quit()

print(json.dumps({"ok":not errors,"errors":errors,"report":report},ensure_ascii=False,indent=2))
if errors:
    raise SystemExit(1)
