#!/usr/bin/env python3
import json
import os
import sys
import time
from urllib.parse import urljoin

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

base=(sys.argv[1] if len(sys.argv)>1 else os.environ.get("PWA_URL","")).strip()
if not base:
    raise SystemExit("Informe a URL publicada")
if not base.endswith("/"):
    base+="/"

options=Options()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-gpu")
options.add_argument("--disable-dev-shm-usage")
options.set_capability("goog:loggingPrefs",{"browser":"ALL","performance":"ALL"})
driver=webdriver.Chrome(options=options)
driver.set_page_load_timeout(45)
driver.set_script_timeout(90)
driver.execute_cdp_cmd("Network.enable",{})

errors=[]
report={"base":base,"parser":{},"pdfContest":{},"manualContest":{},"mapIsolation":{},"planning":{},"navigation":{},"network":[],"console":[]}

def wait_ready():
    WebDriverWait(driver,30).until(lambda d:d.execute_script("return document.readyState") in ("interactive","complete"))
    WebDriverWait(driver,30).until(lambda d:d.execute_script("return !!document.body"))
    time.sleep(.22)

def wait_data():
    WebDriverWait(driver,15).until(lambda d:d.execute_script("return !!window.PLANO_ARQ_DATA"))

def drain_logs(label):
    try:
        for entry in driver.get_log("browser"):
            if entry.get("level")=="SEVERE":
                msg=entry.get("message","")
                if "favicon.ico" not in msg:
                    report["console"].append({"where":label,"message":msg})
                    errors.append("console "+label+": "+msg[:220])
    except Exception:
        pass
    try:
        for entry in driver.get_log("performance"):
            msg=json.loads(entry["message"])["message"]
            if msg.get("method")!="Network.responseReceived":
                continue
            res=msg.get("params",{}).get("response",{})
            status=int(res.get("status") or 0)
            url=str(res.get("url") or "")
            if status>=400 and url.startswith(base) and "favicon.ico" not in url:
                row={"where":label,"status":status,"url":url}
                report["network"].append(row)
                errors.append("network "+label+": "+str(status)+" "+url)
    except Exception:
        pass

def get_context():
    return driver.execute_script("return window.PLANO_ARQ_CONTEST_CONTEXT?.resolveId?.()||''")

try:
    # 1) Parser real: PDF oficial publicado -> texto -> cargos -> estrutura -> conteúdo.
    driver.get(urljoin(base,"index.html#home"))
    wait_ready()
    parser=driver.execute_async_script("""
      const done=arguments[arguments.length-1];
      (async()=>{try{
        const R=window.PLANO_ARQ_PDF_READER,P=window.PLANO_ARQ_EDICT_PARSER;
        const res=await fetch(new URL('edital/edital_abertura_001_2026_DEMHAB.pdf',location.href),{cache:'no-store'});
        if(!res.ok)throw new Error('PDF HTTP '+res.status);
        const blob=await res.blob(),file=new File([blob],'edital-real-etapa-i.pdf',{type:'application/pdf'});
        const doc=await R.read(file);
        const pre=P.parseDocument(doc,null),list=pre.cargos||[];
        const selected=list.find(x=>/arquitet/i.test(x.name||''))||list[0]||null;
        if(!selected)throw new Error('Nenhum cargo identificado');
        const parsed=P.parseDocument(doc,selected);
        let isolated=true,otherPosition='';
        if(list.length>1){
          const other=list.find(x=>(x.code||x.name)!==(selected.code||selected.name));
          if(other){
            const otherParsed=P.parseDocument(doc,other);
            otherPosition=otherParsed.draft?.position||'';
            isolated=otherPosition!==parsed.draft?.position;
          }
        }
        window.__stageIFile=file;window.__stageIParsed=parsed;
        const obj=(parsed.schema?.stages||[]).find(x=>x.type==='objective')||{};
        done({ok:true,pages:doc.numPages,nativeChars:doc.nativeChars||0,cargos:list.length,selected:selected.name||'',positionCode:parsed.draft?.positionCode||'',position:parsed.draft?.position||'',organization:parsed.draft?.organization||'',board:parsed.draft?.board||'',city:parsed.draft?.city||'',uf:parsed.draft?.uf||'',notice:parsed.draft?.notice||'',examDate:parsed.draft?.examDate||'',sections:(obj.sections||[]).length,totalQuestions:obj.totalQuestions||0,totalPoints:obj.totalPoints||0,content:(parsed.draft?.content||[]).length,schedule:(parsed.draft?.schedule||[]).length,isolated,otherPosition,fileSize:file.size});
      }catch(e){done({ok:false,error:String(e)})}})();
    """)
    report["parser"]=parser
    if not parser.get("ok"):
        errors.append("Etapa I parser real: "+str(parser))
    else:
        if parser.get("pages",0)<1 or parser.get("nativeChars",0)<1000:
            errors.append("Etapa I parser real: texto insuficiente")
        if parser.get("cargos",0)<1 or not parser.get("position"):
            errors.append("Etapa I parser real: cargos não identificados")
        if parser.get("sections",0)<1 or parser.get("totalQuestions",0)<1:
            errors.append("Etapa I parser real: estrutura da prova não identificada")
        if parser.get("content",0)<1:
            errors.append("Etapa I parser real: conteúdo programático não identificado")
        if parser.get("cargos",0)>1 and not parser.get("isolated"):
            errors.append("Etapa I parser real: seleção de cargo não ficou isolada")
    drain_logs("parser-real")

    # 2) Criação real via PDF usando o resultado do parser e a tela de revisão.
    driver.find_element(By.ID,"newBtn").click()
    WebDriverWait(driver,8).until(lambda d:d.execute_script("return document.getElementById('modal')?.classList.contains('open')===true"))
    driver.execute_script("""
      const W=window.PLANO_ARQ_CONTEST_IMPORT;
      W.state.mode='auto';W.state.file=window.__stageIFile;W.state.draft=window.__stageIParsed.draft;W.state.step=2;
      W.renderReview();W.updateSteps();document.getElementById('nextStep').hidden=false;
    """)
    reviewed=driver.execute_script("""
      return {
        position:document.getElementById('rwPosition')?.value||'',
        organization:document.getElementById('rwOrg')?.value||'',
        sections:document.querySelectorAll('[data-review-section]').length,
        events:document.querySelectorAll('[data-review-event]').length
      }
    """)
    if reviewed.get("position")!=parser.get("position") or reviewed.get("sections",0)<1:
        errors.append("Etapa I PDF: revisão não recebeu os dados do cargo selecionado")
    driver.find_element(By.ID,"nextStep").click()
    WebDriverWait(driver,8).until(lambda d:d.execute_script("return document.querySelector('[data-step=\"3\"]')?.hidden===false"))
    driver.find_element(By.ID,"nextStep").click()
    WebDriverWait(driver,15).until(lambda d:"edital.html?contest=" in d.current_url)
    wait_ready();wait_data()
    pdf_id=driver.execute_script("return new URL(location.href).searchParams.get('contest')")
    persisted=driver.execute_async_script("""
      const done=arguments[arguments.length-1],id=new URL(location.href).searchParams.get('contest'),D=window.PLANO_ARQ_DATA;
      (async()=>{try{
        const c=D.contestById(id),s=D.examSchemaForContest(id),fs=D.contestFiles(id),blob=await D.contestBlob(id,'edital-principal');
        done({ok:!!c&&!!s&&fs.some(x=>x.id==='edital-principal')&&blob?.blob?.size>0&&localStorage.getItem('planoarq:active-contest:v1')===id,
          id,title:c?.title||'',position:c?.position||'',positionCode:c?.positionCode||'',city:c?.city||'',uf:c?.uf||'',board:c?.board||'',notice:c?.notice||'',examDate:c?.examDate||'',schemaQuestions:s?.stages?.find(x=>x.type==='objective')?.totalQuestions||0,fileSize:blob?.blob?.size||0});
      }catch(e){done({ok:false,error:String(e)})}})();
    """)
    report["pdfContest"]=persisted
    if not persisted.get("ok"):
        errors.append("Etapa I PDF: concurso/schema/PDF não persistiram")
    if not pdf_id or not persisted.get("id")==pdf_id:
        errors.append("Etapa I PDF: contestId inconsistente")
    if pdf_id and not __import__("re").search(r"-[a-z0-9]{6}(?:-\d+)?$",pdf_id):
        errors.append("Etapa I PDF: ID não contém identidade estável independente do nome visível")
    if get_context()!=pdf_id:
        errors.append("Etapa I PDF: contexto não reconheceu o novo concurso")
    drain_logs("pdf-contest")

    # Reload e Arquivos devem reutilizar o PDF sem pedir novo upload.
    driver.refresh();wait_ready();wait_data()
    reload_ok=driver.execute_script("return window.PLANO_ARQ_CONTEST_CONTEXT.resolveId()===arguments[0] && document.getElementById('heroTitle')?.textContent.includes(arguments[1])",pdf_id,persisted.get("position",""))
    if not reload_ok:
        errors.append("Etapa I PDF: reload perdeu concurso/dados")
    driver.get(urljoin(base,"arquivos.html?contest="+pdf_id));wait_ready();wait_data()
    if driver.execute_script("return document.querySelectorAll('.file-row').length")<1:
        errors.append("Etapa I PDF: Arquivos não listou o edital importado")
    drain_logs("arquivos-pdf")

    # 3) Criação manual com dados deliberadamente incompletos.
    driver.get(urljoin(base,"index.html#home"));wait_ready()
    driver.find_element(By.ID,"newBtn").click()
    WebDriverWait(driver,8).until(lambda d:d.execute_script("return document.getElementById('modal')?.classList.contains('open')===true"))
    driver.find_element(By.ID,"manualContestBtn").click()
    WebDriverWait(driver,5).until(lambda d:d.execute_script("return document.querySelector('[data-step=\"2\"]')?.hidden===false"))
    driver.execute_script("""
      document.getElementById('rwTitle').value='Concurso Manual Etapa I';
      document.getElementById('rwOrg').value='Órgão Manual de Teste';
      document.getElementById('rwPosition').value='Analista de Arquitetura';
      document.getElementById('rwBoard').value='';
      document.getElementById('rwCity').value='Chapecó/SC';
      document.getElementById('rwNotice').value='';
      document.getElementById('rwExamDate').value='';
    """)
    driver.find_element(By.ID,"nextStep").click()
    WebDriverWait(driver,5).until(lambda d:d.execute_script("return document.querySelector('[data-step=\"3\"]')?.hidden===false"))
    driver.find_element(By.ID,"nextStep").click()
    WebDriverWait(driver,12).until(lambda d:"edital.html?contest=" in d.current_url)
    wait_ready();wait_data()
    manual_id=driver.execute_script("return new URL(location.href).searchParams.get('contest')")
    manual=driver.execute_script("""
      const id=arguments[0],D=window.PLANO_ARQ_DATA,c=D.contestById(id),s=D.examSchemaForContest(id);
      return {ok:!!c&&c.title==='Concurso Manual Etapa I'&&c.position==='Analista de Arquitetura'&&c.uf==='SC'&&c.city==='Chapecó/SC'&&!c.board&&!c.notice&&!s&&localStorage.getItem('planoarq:active-contest:v1')===id,
        id,title:c?.title||'',position:c?.position||'',city:c?.city||'',uf:c?.uf||'',board:c?.board||'',notice:c?.notice||'',schema:!!s,body:document.body.innerText.slice(0,12000)}
    """,manual_id)
    report["manualContest"]=manual
    if not manual.get("ok"):
        errors.append("Etapa I manual: persistência/UF/estado incompleto incorretos")
    body=manual.get("body","")
    if "DEMHAB" in body or "FUNDATEC" in body:
        errors.append("Etapa I manual: dados do DEMHAB/FUNDATEC vazaram para concurso vazio")
    if get_context()!=manual_id:
        errors.append("Etapa I manual: contexto incorreto")
    drain_logs("manual-edital")

    # 4) Reload + nova aba + URL direta.
    driver.refresh();wait_ready()
    if get_context()!=manual_id:
        errors.append("Etapa I manual: F5 perdeu contestId")
    original=driver.current_window_handle
    driver.switch_to.new_window("tab")
    driver.get(urljoin(base,"biblioteca.html?contest="+manual_id));wait_ready()
    if get_context()!=manual_id or "Concurso Manual Etapa I" not in driver.find_element(By.CSS_SELECTOR,".pa-top-k").text:
        errors.append("Etapa I manual: nova aba direta da Biblioteca perdeu contexto")
    driver.close();driver.switch_to.window(original)
    driver.get(urljoin(base,"planejamento.html?contest="+manual_id));wait_ready()
    if get_context()!=manual_id or driver.execute_script("return document.querySelectorAll('#blueprint .blue-card').length")!=0:
        errors.append("Etapa I manual: Planejamento vazio recebeu estrutura de outro concurso")
    drain_logs("manual-direto")

    # 5) Precedência: URL explícita > concurso ativo; ausência de query usa ativo.
    driver.execute_script("localStorage.setItem('planoarq:active-contest:v1',arguments[0])",pdf_id)
    driver.get(urljoin(base,"edital.html?contest="+manual_id));wait_ready()
    precedence=driver.execute_script("return {resolved:window.PLANO_ARQ_CONTEST_CONTEXT.resolveId(),active:localStorage.getItem('planoarq:active-contest:v1')}")
    if precedence.get("resolved")!=manual_id or precedence.get("active")!=manual_id:
        errors.append("Etapa I contexto: URL explícita não prevaleceu")
    driver.get(urljoin(base,"biblioteca.html"));wait_ready()
    if get_context()!=manual_id:
        errors.append("Etapa I contexto: página sem query não reutilizou concurso ativo")

    # 6) Dois concursos, dois mapas e dois namespaces, sem vazamento.
    def install_map(cid,label,code,group):
        driver.get(urljoin(base,"biblioteca.html?contest="+cid));wait_ready();wait_data()
        result=driver.execute_async_script("""
          const done=arguments[arguments.length-1],cid=arguments[0],label=arguments[1],code=arguments[2],group=arguments[3],D=window.PLANO_ARQ_DATA;
          const ns='stage-i-'+code.toLowerCase()+'-'+cid.replace(/[^a-z0-9]+/gi,'-'),blobId='stage-i-html-'+code.toLowerCase();
          const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="mindmap-storage-id" content="'+ns+'"><meta name="study-display-title" content="'+label+'"><meta name="study-short-title" content="'+label+'"><meta name="study-short-code" content="'+code+'"><meta name="study-file-version" content="V01"><meta name="study-library-group" content="'+group.replace(/"/g,'&quot;')+'"><link rel="stylesheet" href="../assets/css/study-map-shared-v01.css"></head><body><main><section id="mindmap" class="mindmap"><article class="branch-card" data-branch="r1">'+label+'</article></section><section class="ramo" id="r1"><details class="topic-card" id="stage-i-topic" data-topic-id="stage-i-topic"><summary>'+label+'</summary><button type="button" class="state-btn" id="stageIDone">OK</button></details></section></main><script>document.getElementById("stageIDone").addEventListener("click",function(){var k="mindmap_state::'+ns+'",s={};try{s=JSON.parse(localStorage.getItem(k)||"{}")}catch(e){}s.topicStates=Object.assign({},s.topicStates||{},{"stage-i-topic":"done"});s.lastAnchor="stage-i-topic";s.lastLabel="'+label+'";localStorage.setItem(k,JSON.stringify(s));document.getElementById("stage-i-topic").dataset.studyState="done"});<\\/script><script src="../assets/js/study-map-runtime-v01.js"><\\/script></body></html>';
          (async()=>{try{
            await D.storeContestBlob(cid,blobId,new Blob([html],{type:'text/html'}),{name:code+'.html',type:'text/html',size:html.length});
            D.upsertContestFile(cid,{id:blobId,title:label,filename:code+'.html',type:'html',mimeType:'text/html',sizeBytes:html.length,category:'Mapa de estudo',status:'ativo',storage:'indexeddb',storageKey:cid+'::'+blobId,localOnly:true,mapId:'stage-i-'+code});
            const material=D.upsertContestMaterial(cid,{id:ns,storageNamespace:ns,src:'__indexeddb__',blobFileId:blobId,filename:code+'.html',title:label,shortTitle:label,shortCode:code,version:'V01',versionNumber:1,versionCount:1,board:'',contest:'Etapa I',group:group||'Outros',order:'01',topicCount:1,branchCount:1,contestId:cid,dynamic:true,active:true});
            done({ok:true,id:material.id,ns,blobId});
          }catch(e){done({ok:false,error:String(e)})}})();
        """,cid,label,code,group)
        if not result.get("ok"):
            errors.append("Etapa I mapa "+code+": falha ao instalar "+str(result))
        return result

    driver.get(urljoin(base,"edital.html?contest="+pdf_id));wait_ready();wait_data()
    first_group=driver.execute_script("""
      const s=window.PLANO_ARQ_DATA.examSchemaForContest(arguments[0]),o=(s?.stages||[]).find(x=>x.type==='objective'),sec=(o?.sections||[])[0];
      return sec?.mapGroups?.[0]||sec?.label||'Conhecimentos Específicos'
    """,pdf_id)
    map_a=install_map(pdf_id,"Mapa Isolado A","SIA",first_group)
    map_b=install_map(manual_id,"Mapa Isolado B","SIB","Manual")

    driver.get(urljoin(base,"biblioteca.html?contest="+pdf_id));wait_ready()
    titles_a=driver.execute_script("return [...document.querySelectorAll('.library-card h3')].map(x=>x.textContent.trim())")
    if "Mapa Isolado A" not in titles_a or "Mapa Isolado B" in titles_a:
        errors.append("Etapa I isolamento: Biblioteca A misturou mapas")
    driver.execute_script("const b=[...document.querySelectorAll('[data-open]')].find(x=>x.dataset.open===arguments[0]);if(b)b.click()",map_a.get("id"))
    WebDriverWait(driver,8).until(lambda d:d.execute_script("return document.getElementById('viewer')?.classList.contains('open')===true"))
    frame=driver.find_element(By.ID,"frame")
    WebDriverWait(driver,8).until(lambda d:d.execute_script("return !!document.getElementById('frame')?.contentDocument?.getElementById('stageIDone')"))
    driver.switch_to.frame(frame)
    driver.find_element(By.ID,"stageIDone").click()
    driver.switch_to.default_content()
    WebDriverWait(driver,8).until(lambda d:"100%" in d.find_element(By.ID,"viewerProgress").text)
    driver.find_element(By.ID,"closeBtn").click()
    driver.refresh();wait_ready()
    a_progress=driver.execute_script("""
      const card=[...document.querySelectorAll('.library-card')].find(x=>x.querySelector('[data-open]')?.dataset.open===arguments[0]);
      return card?.innerText||''
    """,map_a.get("id"))
    if "100%" not in a_progress:
        errors.append("Etapa I mapa: progresso A não persistiu após reload")

    driver.get(urljoin(base,"biblioteca.html?contest="+manual_id));wait_ready()
    titles_b=driver.execute_script("return [...document.querySelectorAll('.library-card h3')].map(x=>x.textContent.trim())")
    b_progress=driver.execute_script("""
      const card=[...document.querySelectorAll('.library-card')].find(x=>x.querySelector('[data-open]')?.dataset.open===arguments[0]);
      return card?.innerText||''
    """,map_b.get("id"))
    if "Mapa Isolado B" not in titles_b or "Mapa Isolado A" in titles_b or "100%" in b_progress:
        errors.append("Etapa I isolamento: mapa/progresso de A vazou para B")
    report["mapIsolation"]={"pdf":titles_a,"manual":titles_b,"aProgress":a_progress,"bProgress":b_progress,"mapA":map_a,"mapB":map_b}
    drain_logs("map-isolation")

    # 7) Planejamento usa o peso real e o mapa do componente sem redistribuir lacunas.
    driver.get(urljoin(base,"planejamento.html?contest="+pdf_id));wait_ready()
    map_in_plan=driver.execute_script("return [...document.querySelectorAll('[data-priority]')].some(x=>x.dataset.priority===arguments[0])",map_a.get("id"))
    gap_note=driver.execute_script("return document.body.innerText.includes('não serão redistribuídos silenciosamente') || document.body.innerText.includes('sem mapas vinculados')")
    if not map_in_plan:
        errors.append("Etapa I Planejamento: mapa ativo não entrou no componente correto")
    objective=driver.execute_script("""
      const s=JSON.parse(localStorage.getItem('planoarq:exam-schema::'+arguments[0])||'null'),o=(s?.stages||[]).find(x=>x.type==='objective');
      return {sections:(o?.sections||[]).length,totalQuestions:o?.totalQuestions||0,totalPoints:o?.totalPoints||0}
    """,pdf_id)
    if objective.get("sections",0)>1 and not gap_note:
        errors.append("Etapa I Planejamento: lacuna sem mapa não ficou explícita")

    # Gera plano real com teoria e confirma consumo na tela Hoje.
    driver.execute_script("""
      document.querySelectorAll('[data-hours]').forEach(x=>{x.value='1';x.dispatchEvent(new Event('input',{bubbles:true}))});
      document.getElementById('questionsPct').value='0';
      document.getElementById('reviewPct').value='0';
      document.getElementById('blockMinutes').value='30';
    """)
    driver.find_element(By.ID,"generateBtn").click()
    WebDriverWait(driver,8).until(lambda d:d.execute_script("return !!localStorage.getItem('planoarq:generated-plan::'+arguments[0])",pdf_id))
    plan=driver.execute_script("""
      const p=JSON.parse(localStorage.getItem('planoarq:generated-plan::'+arguments[0])||'null'),sessions=(p?.days||[]).flatMap(d=>d.sessions||[]);
      return {ok:!!p&&p.contestId===arguments[0],days:p?.days?.length||0,sessions:sessions.length,hasMap:sessions.some(x=>x.materialId===arguments[1]),unmapped:p?.summary?.unmappedWeight||0}
    """,pdf_id,map_a.get("id"))
    if not plan.get("ok") or plan.get("sessions",0)<1 or not plan.get("hasMap"):
        errors.append("Etapa I Planejamento: plano gerado não consumiu mapa/peso do edital")
    driver.get(urljoin(base,"index.html#contest/"+pdf_id));wait_ready()
    WebDriverWait(driver,8).until(lambda d:"Mapa Isolado A" in d.find_element(By.TAG_NAME,"body").text)
    today_ok="Mapa Isolado A" in driver.find_element(By.TAG_NAME,"body").text
    if not today_ok:
        errors.append("Etapa I Hoje: plano do novo concurso não apareceu")
    report["planning"]={"objective":objective,"mapInPlan":map_in_plan,"gapNote":gap_note,"plan":plan,"today":today_ok}
    drain_logs("planning-today")

    # 8) Todas as rotas internas respeitam URL direta e não mostram DEMHAB no concurso manual.
    routes=["planejamento.html","edital.html","biblioteca.html","revisoes.html","questoes.html","simulados.html","erros.html","desempenho.html","diagnostico.html","historico.html","arquivos.html","configuracoes.html"]
    route_results=[]
    for path in routes:
        driver.get(urljoin(base,path+"?contest="+manual_id));wait_ready()
        cid=get_context()
        top=driver.execute_script("return document.querySelector('.pa-top-k')?.textContent||''")
        text=driver.execute_script("return document.body.innerText.slice(0,16000)")
        ok=(cid==manual_id and "Concurso Manual Etapa I" in top and "DEMHAB Porto Alegre" not in text)
        route_results.append({"path":path,"ok":ok,"cid":cid,"top":top})
        if not ok:
            errors.append("Etapa I rota "+path+": contexto/cabeçalho incorreto")
        drain_logs("route-"+path)
    report["navigation"]["routes"]=route_results

    # Sidebar deve preservar contestId em todos os destinos internos; Trocar concurso é exceção intencional.
    driver.get(urljoin(base,"edital.html?contest="+manual_id));wait_ready()
    nav=driver.execute_script("""
      const id=arguments[0];
      return [...document.querySelectorAll('a.pa-nav-link')].map(a=>({key:a.dataset.paNav||'',href:a.getAttribute('href')||''})).filter(x=>x.key!=='switch').map(x=>({key:x.key,href:x.href,ok:x.key==='today'?x.href.includes('#contest/'+encodeURIComponent(id)):x.href.includes('contest='+encodeURIComponent(id))}));
    """,manual_id)
    if any(not x.get("ok") for x in nav):
        errors.append("Etapa I navegação: algum link perdeu contestId")
    report["navigation"]["links"]=nav

    # Estado final deve continuar em manutenção; nenhum serviço de fundo é reativado pela Etapa I.
    maintenance=driver.execute_script("""
      const flags=JSON.parse(localStorage.getItem('planoarq:runtime-flags:v1')||'{}');
      return {maintenance:flags.maintenanceMode===true,canBackground:window.PLANO_ARQ_DATA?.canRunBackgroundServices?.()===true}
    """)
    report["maintenance"]=maintenance
    if not maintenance.get("maintenance") or maintenance.get("canBackground"):
        errors.append("Etapa I: Maintenance Mode foi alterado/serviços de fundo reativados")

finally:
    report["errors"]=errors
    print(json.dumps(report,ensure_ascii=False,indent=2))
    try:
        driver.quit()
    except Exception:
        pass

if errors:
    raise SystemExit(1)
