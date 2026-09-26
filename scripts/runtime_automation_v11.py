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

    # Focus 2.0 exposes one canonical, read-only answer with exam context.
    focus_v2=driver.execute_script("""
      const cid=arguments[0],A=window.PlanoARQActions;
      const snap=()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));
      const before=snap(),f=A.focus(cid),after=snap();
      return {
        ok:A.version==='2.0'&&before===after&&f?.readOnly===true&&Array.isArray(f?.actions)&&Array.isArray(f?.selected)&&f?.context?.readOnly===true&&f?.context?.exam?.contestId===cid&&f?.top?.id==='session-active',
        version:A.version,beforeEqAfter:before===after,top:f?.top||null,context:f?.context||null
      };
    """,cid)
    report["focusV2"]=focus_v2
    if not focus_v2.get("ok"): errors.append("Foco Automático 2.0 não expôs uma fonte única/read-only com contexto de prova")

    # Imported contests keep their local ExamSchema as the source of truth.
    imported_schema=driver.execute_script("""
      const A=window.PlanoARQActions,sid='focus-v2-local-schema-test';
      const contestsKey='planoarq:contests:v1',schemaKey='planoarq:exam-schema::'+sid;
      const prevContests=localStorage.getItem(contestsKey),prevSchema=localStorage.getItem(schemaKey);
      try{
        const rows=JSON.parse(prevContests||'[]').filter(x=>x?.id!==sid);
        rows.push({id:sid,title:'Focus V2 local',examDate:'2026-12-31',examSchemaId:sid});
        localStorage.setItem(contestsKey,JSON.stringify(rows));
        localStorage.setItem(schemaKey,JSON.stringify({id:sid,contestId:sid,stages:[{type:'objective',sections:[{id:'local',label:'Estrutura local',totalPoints:77,mapGroups:['LOCAL']}]}]}));
        const ctx=A.focusContext(sid);
        return {ok:ctx?.exam?.contestId===sid&&ctx?.exam?.totalPoints===77&&ctx?.exam?.sections?.[0]?.label==='Estrutura local',exam:ctx?.exam||null};
      }finally{
        if(prevContests===null)localStorage.removeItem(contestsKey);else localStorage.setItem(contestsKey,prevContests);
        if(prevSchema===null)localStorage.removeItem(schemaKey);else localStorage.setItem(schemaKey,prevSchema);
      }
    """)
    report["importedSchema"]=imported_schema
    if not imported_schema.get("ok"): errors.append("Foco 2.0 não respeitou o ExamSchema local de concurso importado")

    # Diagnostic signal is derived from study evidence, exam weight and enabled sources.
    diagnostic=driver.execute_script("""
      const cid=arguments[0],A=window.PlanoARQActions;
      const mats=(window.PLANO_ARQ_MATERIALS?.materials||[]).filter(m=>!m.contestId||m.contestId===cid);
      const qs=(window.PLANO_ARQ_QUESTION_CATALOG?.topics||[]).filter(t=>!t.contestId||t.contestId===cid);
      const pair=mats.map(m=>({m,ts:qs.filter(t=>t.materialId===m.id)})).find(x=>x.ts.length);
      if(!pair)return {ok:false,reason:'sem material/tópico para semear'};
      const m=pair.m,t=pair.ts[0],ns=t.storageNamespace||m.storageNamespace,key='mindmap_state::'+ns;
      const st=JSON.parse(localStorage.getItem(key)||'{}');st.topicStates=st.topicStates||{};st.reviewMeta=st.reviewMeta||{};st.quizMeta=st.quizMeta||{};
      st.topicStates[t.topicId]='difficult';st.topicStates.__focus_v2_done_1='done';st.topicStates.__focus_v2_done_2='done';
      st.reviewMeta[t.topicId]={...(st.reviewMeta[t.topicId]||{}),nextReview:new Date(Date.now()-86400000).toISOString()};
      const hist=Array.from({length:5},(_,i)=>({correct:false,at:new Date(Date.now()-(i+1)*3600000).toISOString()}));
      st.quizMeta[t.topicId]={...(st.quizMeta[t.topicId]||{}),attempts:5,correct:0,answerHistory:hist};
      localStorage.setItem(key,JSON.stringify(st));
      localStorage.setItem('planoarq:session-log::'+cid,JSON.stringify({schema:2,sessions:{},extras:[],dayClosures:{}}));
      A.saveSettings({enabled:true,maxActions:6,rules:{planning:false,reviews:true,errors:true,simulations:true,questions:true}});
      const snap=()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));
      const before=snap(),audit=A.audit(cid),after=snap(),x=(audit.actions||[]).find(r=>r.id==='diagnostic-priority');
      return {
        ok:before===after&&!!x&&x.source==='diagnostic'&&x.diagnostic?.confidence>=40&&x.examContext?.contestId===cid&&x.why?.includes('peso oficial da prova')&&audit.context?.primaryDiagnostic?.materialId===x.diagnostic?.materialId,
        beforeEqAfter:before===after,
        diagnostic:x||null,
        context:audit.context||null
      };
    """,cid)
    report["diagnostic"]=diagnostic
    if not diagnostic.get("ok"): errors.append("Diagnóstico/peso/contexto de prova não foram integrados corretamente ao Foco 2.0")

    # Immediate agenda keeps precedence over derived diagnostic/review signals.
    temporal=driver.execute_script("""
      const cid=arguments[0],A=window.PlanoARQActions,key='planoarq:generated-plan::'+cid;
      const plan=JSON.parse(localStorage.getItem(key)||'{}'),day=(plan.days||[]).find(d=>d.date===arguments[1]);
      if(!day?.sessions?.length)return {ok:false,reason:'sem sessão de hoje'};
      day.sessions[0].start='00:00';day.sessions[0].end='00:50';
      localStorage.setItem(key,JSON.stringify(plan));
      localStorage.setItem('planoarq:session-log::'+cid,JSON.stringify({schema:2,sessions:{},extras:[],dayClosures:{}}));
      A.saveSettings({enabled:true,maxActions:6,rules:{planning:true,reviews:true,errors:true,simulations:true,questions:true}});
      const rows=A.build(cid),planned=rows.find(x=>x.id==='planning-today'),diag=rows.find(x=>x.id==='diagnostic-priority');
      return {ok:!!planned&&!!diag&&rows[0]?.id==='planning-today'&&planned.temporalTier===2&&diag.temporalTier===0,order:rows.map(x=>({id:x.id,score:x.score,temporalTier:x.temporalTier}))};
    """,cid,today)
    report["temporalPrecedence"]=temporal
    if not temporal.get("ok"): errors.append("Foco 2.0 deixou sinal derivado ultrapassar agenda imediata")

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
      const cid=arguments[0],key=arguments[1],btn=document.querySelector('[data-auto-session]'),card=[...document.querySelectorAll('[data-session-key]')].find(x=>x.dataset.sessionKey===key),featuredControl=[...document.querySelectorAll('[data-start]')].find(x=>x.dataset.start===key),target=card||featuredControl?.closest('.featured-session');
      const storageKey='planoarq:session-log::'+cid,before=localStorage.getItem(storageKey);
      btn.click();
      const after=localStorage.getItem(storageKey);
      return {
        ok:!!target&&before===after&&!!document.querySelector('.auto-chip')&&document.querySelector('.auto-why')?.textContent.includes('Por quê:')&&btn.textContent.trim().length>0&&target.classList.contains('auto-target'),
        beforeEqAfter:before===after,
        button:btn.textContent.trim(),
        why:document.querySelector('.auto-why')?.textContent.trim()||'',
        chip:document.querySelector('.auto-chip')?.textContent.trim()||'',
        targetKind:card?'session-card':featuredControl?'featured-session':'none',
        targeted:target?.classList.contains('auto-target')||false
      };
    """,cid,seed["sessionKey"])
    report["ui"]=ui
    if not ui.get("ok"): errors.append("Hoje não exibiu explicação/vínculo da automação sem alterar progresso")

finally:
    driver.quit()

print(json.dumps({"ok":not errors,"errors":errors,"report":report},ensure_ascii=False,indent=2))
if errors:
    raise SystemExit(1)
