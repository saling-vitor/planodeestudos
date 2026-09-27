#!/usr/bin/env python3
import json, os, sys
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

base=(sys.argv[1] if len(sys.argv)>1 else os.getenv("PWA_URL") or "http://127.0.0.1:8765/").rstrip("/")+"/"
opts=Options()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1360,1000")
driver=webdriver.Chrome(options=opts)
errors=[]
report={}
cid="demhab-poa-arquiteto-2026"

def wait(cond,timeout=30):
    WebDriverWait(driver,timeout).until(cond)

try:
    driver.get(base+"configuracoes.html?contest="+cid+"#backup")
    wait(lambda d:d.execute_script("return !!window.PLANO_ARQ_DATA && !!window.PLANO_ARQ_HEALTH && !!window.PLANO_ARQ_REPLAN"))
    wait(lambda d:d.execute_script("return !!document.querySelector('#healthState')"))

    baseline=driver.execute_script("""
      const H=window.PLANO_ARQ_HEALTH,cid=arguments[0];
      const snap=()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));
      const before=snap(),r=H.scanSync(cid),after=snap();
      return {ok:before===after&&r.readOnly===true&&r.blockers.length===0,beforeEqAfter:before===after,status:r.status,counts:r.counts,coverage:r.coverage,issues:r.issues};
    """,cid)
    report["baseline"]=baseline
    if not baseline.get("ok"): errors.append("Health Check base não ficou read-only ou gerou bloqueador sem corrupção semeada")

    corrupt=driver.execute_script("""
      const H=window.PLANO_ARQ_HEALTH,cid=arguments[0],key='planoarq:planning::'+cid,prev=localStorage.getItem(key);
      localStorage.setItem(key,'{"broken":');
      const snap=()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));
      const before=snap(),r=H.scanSync(cid),after=snap(),g=H.guard(cid);
      if(prev===null)localStorage.removeItem(key);else localStorage.setItem(key,prev);
      return {ok:before===after&&r.status==='critical'&&g.ok===false&&r.issues.some(x=>x.code==='tracked-json-errors'||x.code==='json-parse'),beforeEqAfter:before===after,status:r.status,blockers:g.blockers,issues:r.issues.filter(x=>x.code.includes('json'))};
    """,cid)
    report["corruptJson"]=corrupt
    if not corrupt.get("ok"): errors.append("Health Check não bloqueou JSON local corrompido")

    orphan=driver.execute_script("""
      const H=window.PLANO_ARQ_HEALTH,cid=arguments[0],key='planoarq:generated-plan::'+cid,prev=localStorage.getItem(key),d=new Date();d.setDate(d.getDate()+1);
      const date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      const plan={schema:3,contestId:cid,generatedAt:new Date().toISOString(),days:[{date,weekday:'Teste',availableMinutes:50,studyMinutes:50,sessions:[{type:'study',materialId:'__health_missing_material__',title:'Órfão',minutes:50}]}]};
      localStorage.setItem(key,JSON.stringify(plan));
      const r=H.scanSync(cid),g=H.guard(cid);
      if(prev===null)localStorage.removeItem(key);else localStorage.setItem(key,prev);
      const hit=r.issues.find(x=>x.code==='plan-material-orphan');
      return {ok:!!hit&&hit.severity==='critical'&&g.ok===false,hit,blockers:g.blockers};
    """,cid)
    report["orphanPlanReference"]=orphan
    if not orphan.get("ok"): errors.append("Health Check não detectou sessão apontando para material inexistente")

    missing_blob=driver.execute_async_script("""
      const done=arguments[arguments.length-1],cid=arguments[0],H=window.PLANO_ARQ_HEALTH,key='planoarq:contest-files::'+cid,prev=localStorage.getItem(key);
      const rows=[{id:'health-missing-pdf',contestId:cid,title:'PDF teste',filename:'health.pdf',storage:'indexeddb',storageKey:cid+'::health-missing-pdf',localOnly:true,type:'pdf'}];
      localStorage.setItem(key,JSON.stringify(rows));
      const before=localStorage.getItem(key);
      H.scan(cid,{files:true,environment:false}).then(r=>{
        const after=localStorage.getItem(key),hit=r.issues.find(x=>x.code==='file-blob-missing'&&x.fileId==='health-missing-pdf');
        if(prev===null)localStorage.removeItem(key);else localStorage.setItem(key,prev);
        done({ok:before===after&&!!hit&&hit.severity==='critical'&&hit.blocksMutation===true,beforeEqAfter:before===after,hit,counts:r.counts});
      }).catch(e=>{if(prev===null)localStorage.removeItem(key);else localStorage.setItem(key,prev);done({ok:false,error:e.message||String(e)})});
    """,cid)
    report["missingLocalFile"]=missing_blob
    if not missing_blob.get("ok"): errors.append("Health Check não detectou metadado de PDF local sem blob correspondente")

    guard=driver.execute_script("""
      const H=window.PLANO_ARQ_HEALTH,R=window.PLANO_ARQ_REPLAN,cid=arguments[0],orig=H.guard;
      let blocked=false,msg='';
      H.guard=()=>({ok:false,status:'critical',blockers:[{title:'Teste de integridade'}]});
      try{R.apply(cid,{contestId:cid,status:'ready',proposalId:'health-test'})}catch(e){blocked=true;msg=e.message||''}
      H.guard=orig;
      return {ok:blocked&&/Health Check bloqueou a aplicação/.test(msg),blocked,msg};
    """,cid)
    report["replanGuard"]=guard
    if not guard.get("ok"): errors.append("AUT-02 não foi protegida pelo Health Check antes de mutar o planejamento")

    ui=driver.execute_async_script("""
      const done=arguments[arguments.length-1],cid=arguments[0],H=window.PLANO_ARQ_HEALTH;
      H.scan(cid,{files:false,environment:false}).then(r=>setTimeout(()=>{
        const el=document.querySelector('#healthState'),txt=el?.textContent||'';
        done({ok:!!el&&txt.includes('Health Check silencioso')&&!txt.includes('verificando integridade'),text:txt,className:el?.className||'',status:r.status});
      },40)).catch(e=>done({ok:false,error:e.message||String(e)}));
    """,cid)
    report["settingsStatus"]=ui
    if not ui.get("ok"): errors.append("Configurações não refletiu o resultado silencioso do Health Check")

finally:
    driver.quit()

print(json.dumps({"ok":not errors,"errors":errors,"report":report},ensure_ascii=False,indent=2))
if errors:
    raise SystemExit(1)
