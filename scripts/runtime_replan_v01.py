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

def wait(cond,timeout=25):
    WebDriverWait(driver,timeout).until(cond)

try:
    driver.get(base+"index.html")
    wait(lambda d:d.execute_script("return !!window.PLANO_ARQ_REPLAN && !!window.PLANO_ARQ_DATA && !!window.PLANO_ARQ_MATERIALS"))

    seed=driver.execute_script("""
      const cid=arguments[0],R=window.PLANO_ARQ_REPLAN,D=window.PLANO_ARQ_DATA;
      const mats=D.materialsForContest(cid),m=mats[0];
      const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      const add=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return iso(d)};
      const today=add(0),yesterday=add(-1),tomorrow=add(1),locked=add(2),exam=add(10);
      const session=(type='study',minutes=50)=>({type,materialId:m.id,shortCode:m.shortCode||'MAPA',title:m.title||'Material',minutes,time:'Flexível',start:null,end:null});
      const day=(date,sessions)=>({date,weekday:'Teste',availableMinutes:120,studyMinutes:sessions.reduce((a,x)=>a+x.minutes,0),breakMinutes:10,breakPolicy:'between-sessions-v1',sessions});
      const plan={schema:3,contestId:cid,generatedAt:new Date(Date.now()-86400000*4).toISOString(),startDate:yesterday,examDate:exam,config:{blockMinutes:50,breakMinutes:10,questionsPct:25,reviewPct:15,rebalance:true},summary:{},days:[day(yesterday,[session()]),day(today,[session('questions',40)]),day(tomorrow,[session()]),day(locked,[session('review',30)])]};
      const availability={mon:{hours:2,useWindows:false},tue:{hours:2,useWindows:false},wed:{hours:2,useWindows:false},thu:{hours:2,useWindows:false},fri:{hours:2,useWindows:false},sat:{hours:2,useWindows:false},sun:{hours:2,useWindows:false}};
      const priorities={};mats.forEach(x=>priorities[x.id]='normal');
      const cfg={schema:1,contestId:cid,startDate:yesterday,examDate:exam,blockMinutes:50,breakMinutes:10,questionsPct:25,reviewPct:15,rebalance:true,availability,priorities,updatedAt:new Date().toISOString()};
      const lockedKey=locked+'|0|'+m.id+'|review';
      localStorage.setItem(R.planKey(cid),JSON.stringify(plan));
      localStorage.setItem(R.configKey(cid),JSON.stringify(cfg));
      localStorage.setItem(R.logKey(cid),JSON.stringify({schema:2,sessions:{[lockedKey]:{status:'done',completedAt:new Date().toISOString(),actualMinutes:30}},extras:[{date:today,minutes:20,title:'Extra'}],dayClosures:{}}));
      return {today,yesterday,tomorrow,locked,exam,materialId:m.id,lockedKey,plan,cfg};
    """,cid)
    report["seed"]={k:seed[k] for k in ("today","yesterday","tomorrow","locked","exam","materialId")}

    readonly=driver.execute_script("""
      const cid=arguments[0],R=window.PLANO_ARQ_REPLAN;
      const snap=()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));
      const before=snap(),p=R.propose(cid),after=snap();
      const pastOld=p.currentPlan.days.filter(d=>d.date<p.cutoverDate),pastNew=p.plan.days.filter(d=>d.date<p.cutoverDate);
      const lockedOld=p.currentPlan.days.find(d=>d.date===arguments[1]),lockedNew=p.plan.days.find(d=>d.date===arguments[1]);
      return {
        ok:before===after&&p.readOnly===true&&p.status==='ready'&&p.cutoverDate===arguments[2]&&JSON.stringify(pastOld)===JSON.stringify(pastNew)&&JSON.stringify(lockedOld)===JSON.stringify(lockedNew)&&p.diff.lockedFutureDays===1&&p.diff.changedDays>0,
        beforeEqAfter:before===after,status:p.status,proposalId:p.proposalId,cutover:p.cutoverDate,diff:p.diff,reasons:p.reasons,locked:p.lockedDates
      };
    """,cid,seed["locked"],seed["tomorrow"])
    report["readonly"]=readonly
    if not readonly.get("ok"): errors.append("proposta AUT-02 não permaneceu read-only ou alterou histórico/dia futuro protegido")

    # UI: first Apply click only arms confirmation and must not change the plan.
    driver.get(base+"planejamento.html?contest="+cid+"&adaptive=1")
    wait(lambda d:d.execute_script("return !!window.PLANO_ARQ_REPLAN && !!document.querySelector('#adaptivePlanning')"))
    wait(lambda d:d.execute_script("return !!document.querySelector('#adaptiveApply')"))
    ui=driver.execute_script("""
      const key='planoarq:generated-plan::'+arguments[0],btn=document.querySelector('#adaptiveApply'),before=localStorage.getItem(key);
      btn.click();
      const after=localStorage.getItem(key),note=document.querySelector('#adaptiveConfirmNote');
      return {ok:before===after&&btn.textContent.includes('Confirmar')&&note&&!note.hidden,beforeEqAfter:before===after,label:btn.textContent,noteHidden:note?.hidden};
    """,cid)
    report["uiConfirmation"]=ui
    if not ui.get("ok"): errors.append("primeiro clique da proposta não ficou apenas em confirmação")

    # A stale proposal must be rejected.
    stale=driver.execute_script("""
      const cid=arguments[0],R=window.PLANO_ARQ_REPLAN,key=R.configKey(cid),original=localStorage.getItem(key),p=R.propose(cid);
      const cfg=JSON.parse(original);cfg.questionsPct=35;cfg.updatedAt=new Date(Date.now()+1000).toISOString();localStorage.setItem(key,JSON.stringify(cfg));
      let rejected=false,msg='';try{R.apply(cid,p)}catch(e){rejected=true;msg=e.message||''}
      localStorage.setItem(key,original);
      return {ok:rejected&&/desatualizada/i.test(msg),rejected,msg};
    """,cid)
    report["staleGuard"]=stale
    if not stale.get("ok"): errors.append("proposta desatualizada não foi rejeitada")

    applied=driver.execute_script("""
      const cid=arguments[0],R=window.PLANO_ARQ_REPLAN,planKey=R.planKey(cid),logKey=R.logKey(cid);
      const p=R.propose(cid),logBefore=localStorage.getItem(logKey),pastBefore=JSON.stringify(p.currentPlan.days.filter(d=>d.date<p.cutoverDate)),lockedBefore=JSON.stringify(p.currentPlan.days.find(d=>d.date===arguments[1]));
      const out=R.apply(cid,p),logAfter=localStorage.getItem(logKey),pastAfter=JSON.stringify(out.plan.days.filter(d=>d.date<p.cutoverDate)),lockedAfter=JSON.stringify(out.plan.days.find(d=>d.date===arguments[1]));
      const saved=JSON.parse(localStorage.getItem(planKey)||'null');
      return {ok:out.applied===true&&!!out.recoveryId&&logBefore===logAfter&&pastBefore===pastAfter&&lockedBefore===lockedAfter&&saved?.adaptive?.proposalId===p.proposalId&&!!saved?.adaptive?.appliedAt,logEq:logBefore===logAfter,recoveryId:out.recoveryId,adaptive:saved?.adaptive,diff:out.diff};
    """,cid,seed["locked"])
    report["apply"]=applied
    if not applied.get("ok"): errors.append("aplicação AUT-02 não preservou log/histórico ou não criou recuperação")

finally:
    driver.quit()

print(json.dumps({"ok":not errors,"errors":errors,"report":report},ensure_ascii=False,indent=2))
if errors:
    raise SystemExit(1)
