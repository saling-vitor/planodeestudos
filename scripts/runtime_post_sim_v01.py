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
    wait(lambda d:d.execute_script("return !!window.PLANO_ARQ_POST_SIM && !!window.PLANO_ARQ_REPLAN && !!window.PlanoARQActions && !!window.PLANO_ARQ_DATA"))

    seeded=driver.execute_script("""
      const cid=arguments[0],P=window.PLANO_ARQ_POST_SIM,D=window.PLANO_ARQ_DATA,R=window.PLANO_ARQ_REPLAN;
      const schema=D.examSchemaForContest(cid),objective=(schema?.stages||[]).find(x=>x.type==='objective'),mats=D.materialsForContest(cid);
      const secs=(objective?.sections||[]).filter(s=>(s.mapGroups||[]).some(g=>mats.some(m=>m.group===g))).slice(0,3);
      if(!secs.length)return {ok:false,reason:'sem seção mapeada'};
      const finishedAt=new Date().toISOString(),startedAt=new Date(Date.now()-7200000).toISOString();
      const sections=secs.map((s,i)=>({title:s.label,correct:Math.max(1,4+i),total:10,weight:1,points:Math.max(1,4+i),maxPoints:10,accuracy:40+i*10}));
      const errs=[];
      secs.forEach((s,i)=>{
        errs.push({number:i*2+1,section:s.label,topic:s.label+' — revisão A',difficulty:'Média',selected:'A',correct:'B',blank:false});
        errs.push({number:i*2+2,section:s.label,topic:s.label+' — revisão B',difficulty:i===0?'Difícil':'Média',selected:null,correct:'C',blank:true});
      });
      const attempt={schema:1,id:'aut03-test-attempt',contestId:cid,simulationId:'aut03-test-sim',code:'AUT03',title:'Simulado AUT-03',startedAt,finishedAt,elapsedSeconds:7200,answered:10*secs.length-1,correct:sections.reduce((a,x)=>a+x.correct,0),wrong:errs.filter(x=>!x.blank).length,blank:errs.filter(x=>x.blank).length,totalQuestions:10*secs.length,points:sections.reduce((a,x)=>a+x.points,0),maxPoints:10*secs.length,accuracy:55,sections,errors:errs};
      localStorage.setItem('planoarq:simulations::'+cid,JSON.stringify([attempt]));
      localStorage.removeItem(P.key(cid));
      localStorage.removeItem(R.planKey(cid));
      localStorage.removeItem(R.configKey(cid));
      localStorage.removeItem(R.logKey(cid));
      return {ok:true,attempt,sectionCount:secs.length,errorCount:errs.length,firstGroup:secs[0].mapGroups[0]};
    """,cid)
    report["seed"]={k:seeded.get(k) for k in ("ok","sectionCount","errorCount","firstGroup","reason") if k in seeded}
    if not seeded.get("ok"):
        errors.append("não foi possível semear tentativa com seção oficial mapeada")
    else:
        readonly=driver.execute_script("""
          const cid=arguments[0],P=window.PLANO_ARQ_POST_SIM,a=arguments[1];
          const snap=()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));
          const before=snap(),x=P.analyzeAttempt(cid,a),after=snap();
          return {ok:before===after&&x.readOnly===true&&x.status==='ready'&&x.summary.areas===arguments[2]&&x.summary.errors===arguments[3]&&x.summary.reviews===Math.min(4,arguments[3]),beforeEqAfter:before===after,summary:x.summary,headline:x.headline,attention:x.attention,reviews:x.reviewSuggestions};
        """,cid,seeded["attempt"],seeded["sectionCount"],seeded["errorCount"])
        report["readonlyDiagnosis"]=readonly
        if not readonly.get("ok"): errors.append("diagnóstico pós-simulado não permaneceu read-only ou resumiu incorretamente a tentativa")

        record=driver.execute_script("""
          const cid=arguments[0],P=window.PLANO_ARQ_POST_SIM,a=arguments[1],key=P.key(cid);
          const planKey='planoarq:generated-plan::'+cid,beforePlan=localStorage.getItem(planKey),beforeKeys=new Set(Object.keys(localStorage)),x=P.record(cid,a),afterKeys=new Set(Object.keys(localStorage)),added=[...afterKeys].filter(k=>!beforeKeys.has(k));
          return {ok:x.status==='ready'&&localStorage.getItem(key)!==null&&beforePlan===localStorage.getItem(planKey)&&added.length===1&&added[0]===key,added,summary:x.summary};
        """,cid,seeded["attempt"])
        report["derivedRecord"]=record
        if not record.get("ok"): errors.append("registro derivado do pós-simulado alterou algo além da chave própria")

        planning=driver.execute_script("""
          const cid=arguments[0],P=window.PLANO_ARQ_POST_SIM,R=window.PLANO_ARQ_REPLAN,D=window.PLANO_ARQ_DATA,a=arguments[1];
          const mats=D.materialsForContest(cid),iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),add=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return iso(d)};
          const today=add(0),tomorrow=add(1),exam=add(14),oldAt=new Date(Date.now()-86400000).toISOString(),availability={};
          for(const k of ['mon','tue','wed','thu','fri','sat','sun'])availability[k]={hours:2,useWindows:false,w1s:'',w1e:'',w2s:'',w2e:''};
          const priorities={};mats.forEach(m=>priorities[m.id]='normal');
          const weakGroup=arguments[2],m=mats.find(x=>x.group===weakGroup)||mats[0],session={type:'study',materialId:m.id,shortCode:m.shortCode||'MAPA',title:m.title||'Material',minutes:50,time:'Flexível',start:null,end:null};
          const plan={schema:3,contestId:cid,generatedAt:oldAt,startDate:today,examDate:exam,config:{blockMinutes:50,breakMinutes:10,questionsPct:25,reviewPct:15,rebalance:true},summary:{},days:[{date:tomorrow,weekday:'Teste',availableMinutes:120,studyMinutes:50,breakMinutes:10,breakPolicy:'between-sessions-v1',sessions:[session]}]};
          const cfg={schema:1,contestId:cid,startDate:today,examDate:exam,blockMinutes:50,breakMinutes:10,questionsPct:25,reviewPct:15,rebalance:true,availability,priorities,updatedAt:oldAt};
          localStorage.setItem(R.planKey(cid),JSON.stringify(plan));localStorage.setItem(R.configKey(cid),JSON.stringify(cfg));localStorage.setItem(R.logKey(cid),JSON.stringify({schema:2,sessions:{},extras:[],dayClosures:{}}));
          const signal=P.planningSignals(cid,{after:oldAt}),snap=()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])),before=snap(),proposal=R.propose(cid),after=snap();
          return {ok:signal.active===true&&Number(signal.groupFactors?.[weakGroup]||1)>1&&before===after&&proposal.readOnly===true&&proposal.reasons?.some(x=>x.code==='post-sim')&&proposal.postSimulation?.attemptId===a.id,signal,proposal:{status:proposal.status,reasons:proposal.reasons,postSimulation:proposal.postSimulation,diff:proposal.diff},beforeEqAfter:before===after};
        """,cid,seeded["attempt"],seeded["firstGroup"])
        report["planningProposal"]=planning
        if not planning.get("ok"): errors.append("AUT-02 não incorporou o sinal pós-simulado apenas como proposta read-only")

        focus=driver.execute_script("""
          const cid=arguments[0],A=window.PlanoARQActions;
          A.saveSettings({enabled:true,maxActions:6,rules:{planning:true,reviews:true,errors:true,simulations:true,questions:true}});
          const snap=()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])),before=snap(),rows=A.candidates(cid),after=snap(),x=rows.find(r=>r.id==='simulation-post-diagnostic');
          return {ok:before===after&&!!x&&x.postSimulation===true&&x.href.includes('#postSimSection')&&x.evidence?.errors>0,beforeEqAfter:before===after,action:x||null};
        """,cid)
        report["focusIntegration"]=focus
        if not focus.get("ok"): errors.append("Foco 2.0 não expôs o diagnóstico pós-simulado de forma read-only")

        driver.get(base+"simulados.html?contest="+cid+"#postSimSection")
        wait(lambda d:d.execute_script("return !!window.PLANO_ARQ_POST_SIM && !!document.querySelector('#postSimSection')"))
        wait(lambda d:d.execute_script("const s=document.querySelector('#postSimSection');return s && !s.hidden && /Diagnóstico pronto/.test(s.textContent||'')"))
        ui=driver.execute_script("""
          const sec=document.querySelector('#postSimSection'),txt=sec?.textContent||'';
          return {ok:!!sec&&!sec.hidden&&txt.includes('Erros registrados')&&txt.includes('Revisões sugeridas')&&!!document.querySelector('#postSimErrors')&&!!document.querySelector('#postSimPlan'),text:txt.slice(0,800)};
        """)
        report["centralUI"]=ui
        if not ui.get("ok"): errors.append("Central de Simulados não exibiu o painel pós-simulado integrado")

finally:
    driver.quit()

print(json.dumps({"ok":not errors,"errors":errors,"report":report},ensure_ascii=False,indent=2))
if errors:
    raise SystemExit(1)
