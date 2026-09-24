function cloneData(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  const state = {
    data: cloneData(EXAM_DATA),
    answers: {},
    finished: false,
    showScratch: false
  };

  function esc(s=''){
    return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function sanitizeRich(s=''){
    const temp = document.createElement('div');
    temp.innerHTML = String(s);
    const allowed = new Set(['B','STRONG','I','EM','SUP','SUB','BR','SPAN','P','UL','OL','LI']);
    Array.from(temp.querySelectorAll('*')).forEach(el=>{
      if(!allowed.has(el.tagName)) el.replaceWith(document.createTextNode(el.textContent));
      else Array.from(el.attributes).forEach(a=>el.removeAttribute(a.name));
    });
    return temp.innerHTML;
  }

  function allQuestions(){
    return state.data.sections.flatMap(s => (s.questions || []).map(q => ({...q, section:s.title})));
  }

  function normalizeData(data){
    if(!data || typeof data !== 'object') throw new Error('Dados da prova inválidos.');
    data.meta = data.meta || {};
    data.sections = Array.isArray(data.sections) ? data.sections : [];
    let num = 1;
    data.sections.forEach(sec=>{
      sec.title = sec.title || 'DISCIPLINA';
      sec.questions = Array.isArray(sec.questions) ? sec.questions : [];
      sec.questions.forEach(q=>{
        q.number = num++;
        q.stem = q.stem || 'Enunciado não informado.';
        q.body = q.body || '';
        q.fragments = Array.isArray(q.fragments) ? q.fragments : [];
        q.assertions = Array.isArray(q.assertions) ? q.assertions : [];
        q.vfStatements = Array.isArray(q.vfStatements) ? q.vfStatements : [];
        q.columns = q.columns && typeof q.columns === 'object' ? q.columns : null;
        q.alternatives = Array.isArray(q.alternatives) ? q.alternatives : [];
        q.answer = String(q.answer || '').trim().toUpperCase();
        q.explanation = q.explanation || '';
        q.reference = q.reference || '';
        q.image = q.image || '';
        q.imageCaption = q.imageCaption || '';
        q.after = q.after || '';
      });
    });
    data.meta.questionCount = num - 1;
    return data;
  }

  function displayDate(){
    const d = String(state.data.meta.date || '').trim();
    return d || 'SIMULADO';
  }

  function buildCover(){
    const m=state.data.meta;
    const ins=state.data.instructions || [];
    return `
    <section class="page cover-page">
      <div class="page-inner">
        <div class="cover-top">
          <div class="seal">IDENTIFICAÇÃO<br>DO ÓRGÃO</div>
          <div class="cover-meta">${esc(m.code || 'SIMULADO')} • ${esc(m.version || 'V01')}<br>${esc(displayDate())}</div>
        </div>
        <div class="cover-box entity">${esc(m.entity || 'ÓRGÃO PÚBLICO')}</div>
        <div class="cover-box exam">${esc(m.exam || 'CONCURSO PÚBLICO — SIMULADO')}</div>
        <div class="cover-box role">${esc(m.role || 'CARGO')}</div>
        <div class="blue-rule"><span>Instruções</span></div>
        <div class="instructions">
          <p><b>Leia atentamente as instruções antes de iniciar este simulado.</b></p>
          <ol>${ins.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
          <p><b>ESTE CADERNO CONTÉM ${allQuestions().length} QUESTÕES. TEMPO DE REFERÊNCIA: ${esc(m.duration || '—')}.</b></p>
        </div>
      </div>
      <div class="cover-footer">
        <div class="badge">Simulado de estudo<br>não oficial</div>
        <div class="mark">PROVA TREINO<small>layout inspirado em caderno de concurso</small></div>
      </div>
    </section>`;
  }

  function buildScratch(){
    const max = Math.max(Number(state.data.meta.scratchSlots || 100), Number(state.data.meta.questionCount || 0));
    const cells = Array.from({length:max},(_,i)=>`<div class="scratch-cell"><span class="n">${String(i+1).padStart(2,'0')}</span></div>`).join('');
    return `
    <section class="page scratch-page ${state.showScratch?'':'hidden'}">
      <div class="page-inner">
        <div class="scratch-title">RASCUNHO</div>
        <div class="scratch-sub">Utilize este espaço para anotar suas respostas</div>
        <div class="scratch-note">* A anotação neste rascunho NÃO substitui as alternativas marcadas no sistema.</div>
        <div class="scratch-grid">${cells}</div>
      </div>
    </section>`;
  }

  function qHtml(q){
    const chosen = state.answers[q.number] || '';
    const answer = (q.answer || '').toUpperCase();
    const alts = q.alternatives || [];
    const fragments = q.fragments || [];
    const vf = q.vfStatements || [];
    const cols = q.columns;
    const body = q.body ? `<div class="qbody">${sanitizeRich(q.body)}</div>` : '';
    const fragHtml = fragments.length ? `<ul class="qfragments">${fragments.map(x=>`<li>${sanitizeRich(x)}</li>`).join('')}</ul>` : '';
    const assertHtml = q.assertions && q.assertions.length ? `<ol class="assertions" type="I">${q.assertions.map(a=>`<li>${sanitizeRich(a.replace(/^\s*[IVX]+\.\s*/i,''))}</li>`).join('')}</ol>`:'';
    const vfHtml = vf.length ? `<div class="vf-list">${vf.map(x=>`<div class="vf-item"><span>( )</span><span>${sanitizeRich(x)}</span></div>`).join('')}</div>` : '';
    const colHtml = cols ? `<div class="assoc-grid">
      <div class="assoc-col"><div class="assoc-title">${esc(cols.leftTitle||'Coluna 1')}</div><div>${(cols.left||[]).map(x=>`<p>${sanitizeRich(x)}</p>`).join('')}</div></div>
      <div class="assoc-col"><div class="assoc-title">${esc(cols.rightTitle||'Coluna 2')}</div><div>${(cols.right||[]).map(x=>`<p>${sanitizeRich(x)}</p>`).join('')}</div></div>
    </div>` : '';
    return `<article class="question" data-q="${q.number}">
      <p class="qstem"><strong>QUESTÃO ${String(q.number).padStart(2,'0')} –</strong> ${sanitizeRich(q.stem)}</p>
      ${body}${fragHtml}${assertHtml}${vfHtml}${colHtml}
      ${q.image ? `<img class="qimage" src="${esc(q.image)}" alt="Figura da questão ${q.number}" loading="lazy" decoding="async">${q.imageCaption?`<div class="qcaption">${esc(q.imageCaption)}</div>`:''}` : ''}
      ${q.after ? `<p class="qafter">${sanitizeRich(q.after)}</p>` : ''}
      <div class="alternatives">${alts.map((a,i)=>{
        const L = String.fromCharCode(65+i);
        const cls = state.finished ? (L===answer?'correct':(chosen===L && chosen!==answer?'wrong':'')) : '';
        const text = String(a).replace(/^\s*[A-Z]\)\s*/i,'');
        return `<label class="alt ${cls}"><input type="radio" name="q${q.number}" value="${L}" ${chosen===L?'checked':''} ${state.finished?'disabled':''}><span><b>${L})</b> ${sanitizeRich(text)}</span></label>`;
      }).join('')}</div>
      ${state.finished ? `<div class="question-note"><b>Gabarito:</b> ${esc(answer || '—')}${q.explanation ? ` • ${esc(q.explanation)}`:''}${q.reference ? `<br><b>Base:</b> ${esc(q.reference)}`:''}</div>`:''}
    </article>`;
  }

  function buildQuestionPages(){
    const pages=[];
    const m=state.data.meta;
    let current=[];
    let approx=0;

    state.data.sections.forEach((sec, secIndex)=>{
      const introRaw = sec.intro ? (sec.intro.text || (sec.intro.lines||[]).join(' ')) : '';
      const introWeight = introRaw ? Math.min(5000, String(introRaw).length) : 0;
      if(current.length && (approx + introWeight > 5000)){
        pages.push(current); current=[]; approx=0;
      }
      current.push({type:'section', sec, secIndex});
      approx += 500 + introWeight;
      (sec.questions||[]).forEach(q=>{
        const weight = 540 + String(q.stem||'').length + String(q.body||'').length + (q.fragments||[]).join('').length + (q.assertions||[]).join('').length + (q.vfStatements||[]).join('').length + (q.columns?JSON.stringify(q.columns).length:0) + String(q.after||'').length + (q.alternatives||[]).join('').length + (q.image?1500:0);
        const introOnlyPage = current.length===1 && current[0].type==='section' && introRaw;
        if((current.length>1 || introOnlyPage) && approx + weight > 5850){
          pages.push(current); current=[]; approx=0;
          current.push({type:'section-cont', sec, secIndex}); approx+=220;
        }
        current.push({type:'question', q}); approx += weight;
      });
    });
    if(current.length) pages.push(current);

    return pages.map(items=>{
      let body='';
      items.forEach(it=>{
        if(it.type==='section' || it.type==='section-cont'){
          body += `<div class="section-title">${esc(it.sec.title)}${it.type==='section-cont'?' — continuação':''}</div>`;
          if(it.type==='section' && it.sec.intro && (it.sec.intro.text || (Array.isArray(it.sec.intro.lines) && it.sec.intro.lines.length))){
            const intro=it.sec.intro;
            const introContent = Array.isArray(intro.lines) && intro.lines.length
              ? `<div class="source-lines">${intro.lines.map((line,idx)=>`<div class="source-line"><span class="ln">${String(idx+1).padStart(2,'0')}</span><span class="lt">${sanitizeRich(line)}</span></div>`).join('')}</div>`
              : `<div>${sanitizeRich(intro.text).replace(/\n/g,'<br>')}</div>`;
            body += `<div class="source-text">${intro.title?`<h3>${esc(intro.title)}</h3>`:''}${intro.author?`<div class="by">${esc(intro.author)}</div>`:''}${introContent}</div>`;
          }
        } else {
          body += qHtml(it.q);
        }
      });
      return `<section class="page question-page"><div class="page-inner">
        <div class="running-head"><span>${esc(m.code||'SIMULADO')}</span><span class="center">${esc(m.level||'')}</span><span>${esc(displayDate())}</span></div>
        ${body}
      </div><div class="page-footer"><span>Execução: Simulado de estudo</span><span>${esc(m.role||'')}</span></div></section>`;
    }).join('');
  }

  function buildAnswerPage(){
    if(!state.finished) return '';
    const qs=allQuestions();
    const m=state.data.meta || {};
    const answered=qs.filter(q => state.answers[q.number]).length;
    const correct=qs.filter(q => (state.answers[q.number]||'') === (q.answer||'').toUpperCase()).length;
    let totalPoints=0, maxPoints=0;
    const sectionRows=(state.data.sections||[]).map(sec=>{
      const weight=Number(sec.weight||1);
      const min=Number(sec.minPoints||0);
      const arr=sec.questions||[];
      const hits=arr.filter(q => (state.answers[q.number]||'') === (q.answer||'').toUpperCase()).length;
      const pts=hits*weight, max=arr.length*weight;
      totalPoints += pts; maxPoints += max;
      const ok=pts>=min;
      return `<tr><td>${esc(sec.title)}</td><td>${hits}/${arr.length}</td><td>${weight.toFixed(2).replace('.',',')}</td><td><b>${pts.toFixed(2).replace('.',',')} / ${max.toFixed(2).replace('.',',')}</b></td><td>${min.toFixed(2).replace('.',',')}</td><td>${ok?'✓ Atingido':'✗ Abaixo'}</td></tr>`;
    }).join('');
    const minTotal=Number(m.minTotalPoints||0);
    const allSectionMins=(state.data.sections||[]).every(sec=>{
      const w=Number(sec.weight||1), min=Number(sec.minPoints||0);
      const hits=(sec.questions||[]).filter(q => (state.answers[q.number]||'') === (q.answer||'').toUpperCase()).length;
      return hits*w>=min;
    });
    const meets=(minTotal<=0 || totalPoints>=minTotal) && allSectionMins;
    const cells=qs.map(q=>{
      const a=state.answers[q.number]||'—', g=(q.answer||'—').toUpperCase();
      return `<div class="key-cell ${a===g?'hit':'miss'}"><b>${String(q.number).padStart(2,'0')}</b><span>${a} / ${g}</span></div>`;
    }).join('');
    return `<section class="page answer-page"><div class="page-inner">
      <h2>RESULTADO DO SIMULADO</h2>
      <div class="answer-meta">${esc(m.role||'')} • ${esc(m.exam||'')}</div>
      <div class="result-box"><div class="score">${totalPoints.toFixed(2).replace('.',',')}<small style="font-size:.35em"> / ${maxPoints.toFixed(2).replace('.',',')}</small></div><div class="detail">${correct} acertos de ${qs.length} questões • ${answered} respondidas${minTotal>0?`<br><b>${meets?'CRITÉRIOS CONFIGURADOS ATINGIDOS NO SIMULADO':'CRITÉRIOS CONFIGURADOS AINDA NÃO ATINGIDOS NO SIMULADO'}</b>`:''}</div></div>
      <h3 style="margin:7mm 0 2mm">Desempenho ponderado por disciplina</h3>
      <table class="answer-table"><thead><tr><th>Disciplina</th><th>Acertos</th><th>Peso</th><th>Pontos</th><th>Mínimo</th><th>Critério</th></tr></thead><tbody>${sectionRows}</tbody></table>
      <h3 style="margin:7mm 0 2mm">Gabarito — marcada / correta</h3>
      <div class="answer-key-grid">${cells}</div>
      <p class="audit-note">Resultado exclusivamente para estudo. Pesos e mínimos são aplicados conforme os valores configurados em EXAM_DATA pelo gerador a partir do edital.</p>
    </div></section>`;
  }


  function auditExamData(){
    const data=state.data, qs=allQuestions(), warnings=[];
    const expected=Number(data.meta?.expectedQuestions||0);
    const altExpected=Number(data.meta?.alternativesCount||0);
    if(expected && qs.length!==expected) warnings.push(`Total de questões: esperado ${expected}, encontrado ${qs.length}.`);

    const diffCount={'Fácil':0,'Média':0,'Difícil':0};
    const seen=new Map(), letters={}, styles={}, sectionByQuestion=new Map();
    let maxStreak=0, streak=0, prevAnswer='';

    (data.sections||[]).forEach(sec=>{
      const ec=Number(sec.expectedCount||0);
      if(ec && (sec.questions||[]).length!==ec) warnings.push(`${sec.title}: esperado ${ec}, encontrado ${(sec.questions||[]).length}.`);
      (sec.questions||[]).forEach(q=>sectionByQuestion.set(q.number,sec));

      if(/PORTUGUESA/i.test(sec.title||'') && (sec.questions||[]).length){
        const intro=sec.intro||{};
        const lines=Array.isArray(intro.lines)?intro.lines.filter(x=>String(x||'').trim()):[];
        const txt=String(intro.text||'').trim();
        if(!lines.length && !txt) warnings.push(`${sec.title}: sem texto-base visível.`);
        if(lines.length && lines.length<20) warnings.push(`${sec.title}: texto-base com apenas ${lines.length} linhas; verificar aderência ao corpus Fundatec.`);
        const wordCount=(lines.length?lines.join(' '):txt).trim().split(/\s+/).filter(Boolean).length;
        if(wordCount && wordCount<300) warnings.push(`${sec.title}: texto-base com cerca de ${wordCount} palavras; pode estar curto para o perfil Fundatec de nível superior.`);
        const anchored=(sec.questions||[]).filter(q=>{
          const blob=[q.stem,q.body,q.after,...(q.fragments||[]),...(q.assertions||[]),...(q.vfStatements||[])].join(' ');
          return /texto|trecho|fragmento|linha|l\.|vocábulo|palavra|período/i.test(blob);
        }).length;
        if((sec.questions||[]).length>=8 && anchored < Math.ceil((sec.questions||[]).length*.5))
          warnings.push(`${sec.title}: somente ${anchored}/${(sec.questions||[]).length} questões parecem ancoradas no texto-base.`);
      }
    });

    qs.forEach(q=>{
      if(altExpected && q.alternatives.length!==altExpected) warnings.push(`Q${q.number}: ${q.alternatives.length} alternativas; esperado ${altExpected}.`);
      const valid=String.fromCharCode(65 + Math.max(0,q.alternatives.length-1));
      if(!q.answer || q.answer<'A' || q.answer>valid) warnings.push(`Q${q.number}: gabarito inválido (${q.answer||'vazio'}).`);
      if(!q.explanation) warnings.push(`Q${q.number}: sem explicação.`);
      if(!q.topic) warnings.push(`Q${q.number}: sem tópico/microassunto.`);
      if(!['Fácil','Média','Difícil'].includes(q.difficulty)) warnings.push(`Q${q.number}: dificuldade inválida ou ausente (${q.difficulty||'vazio'}).`);
      else diffCount[q.difficulty]++;

      const key=String(q.stem||'').toLowerCase().replace(/<[^>]+>/g,'').replace(/\W+/g,' ').trim();
      if(seen.has(key)) warnings.push(`Q${q.number}: enunciado duplicado de Q${seen.get(key)}.`); else seen.set(key,q.number);
      letters[q.answer]=(letters[q.answer]||0)+1;
      const style=String(q.styleTag||'').trim().toLowerCase()||'sem-tag';
      styles[style]=(styles[style]||0)+1;

      if(q.image){
        const img=String(q.image||'').trim();
        const cap=String(q.imageCaption||'').trim();
        if(/^data:image\/svg\+xml/i.test(img) || /\.svg(?:[?#]|$)/i.test(img) || /<svg[\s>]/i.test(img))
          warnings.push(`Q${q.number}: imagem SVG/vetorial detectada; V08 exige figura real de fonte e rasterização do original.`);
        if(/^data:image\/(?:png|jpe?g|webp);base64,/i.test(img)===false && /^https?:\/\//i.test(img)===false)
          warnings.push(`Q${q.number}: formato/origem de imagem não reconhecido; use PNG/JPEG/WebP real ou URL verificável.`);
        if(!cap) warnings.push(`Q${q.number}: imagem sem legenda/fonte.`);
        else {
          if(!/^Fonte:/i.test(cap)) warnings.push(`Q${q.number}: a legenda da imagem deve iniciar por “Fonte:”.`);
          if(/figura\s+autoral|imagem\s+autoral|gerad[ao]\s+por|vetor\s+autoral/i.test(cap))
            warnings.push(`Q${q.number}: legenda indica imagem autoral/gerada; proibido pela política V08.`);
        }
      }

      if(q.answer===prevAnswer) streak++; else {prevAnswer=q.answer; streak=1;}
      maxStreak=Math.max(maxStreak,streak);

      const blob=[q.stem,q.body,q.after,...(q.fragments||[]),...(q.assertions||[]),...(q.vfStatements||[])].join(' ');
      if(/(?:\bl\.\s*\d|linhas?\s*\d)/i.test(blob)){
        const sec=sectionByQuestion.get(q.number)||{};
        const lines=Array.isArray(sec.intro?.lines)?sec.intro.lines:[];
        if(!lines.length) warnings.push(`Q${q.number}: referencia linha(s), mas a seção não possui intro.lines.`);
      }
    });

    if(qs.length>=20){
      const n=qs.length, pe=diffCount['Fácil']/n, pm=diffCount['Média']/n, ph=diffCount['Difícil']/n;
      if(pe<.10 || pe>.25) warnings.push(`Dificuldade: fáceis ${(pe*100).toFixed(1)}%; alvo usual 15–20%.`);
      if(pm<.45 || pm>.70) warnings.push(`Dificuldade: médias ${(pm*100).toFixed(1)}%; alvo usual 55–60%.`);
      if(ph<.15 || ph>.35) warnings.push(`Dificuldade: difíceis ${(ph*100).toFixed(1)}%; alvo usual 20–25%.`);

      const expectedLetters=altExpected||Math.max(0,...qs.map(q=>q.alternatives.length));
      const vals=Array.from({length:expectedLetters},(_,i)=>letters[String.fromCharCode(65+i)]||0);
      if(vals.length && Math.max(...vals)-Math.min(...vals)>Math.max(3,Math.ceil(n*.08)))
        warnings.push(`Gabarito possivelmente desequilibrado: ${JSON.stringify(letters)}.`);
      if(maxStreak>3) warnings.push(`Gabarito com sequência de ${maxStreak} respostas iguais consecutivas.`);

      const dominant=Math.max(...Object.values(styles));
      if(dominant/n>.72) warnings.push(`Baixa diversidade de formatos: um styleTag ocupa ${(dominant/n*100).toFixed(1)}% da prova.`);
    }

    if(warnings.length) console.warn('[AUDITORIA V08]', warnings, {dificuldade:diffCount,gabarito:letters,formatos:styles});
    else console.info('[AUDITORIA V08] Estrutura, calibração e política de imagens validadas.', {questoes:qs.length,dificuldade:diffCount,gabarito:letters,formatos:styles});
    return warnings;
  }

  function updateProgress(){
    const qs=allQuestions();
    const answered=qs.filter(q=>state.answers[q.number]).length;
    const el=document.getElementById('progressStatus');
    if(el) el.textContent=`${answered}/${qs.length} respondidas`;
  }

  function render(){
    state.data = normalizeData(state.data);
    auditExamData();
    document.getElementById('examShell').innerHTML = buildCover()+buildScratch()+buildQuestionPages()+buildAnswerPage();
    bindAnswerEvents();
    updateProgress();
  }

  function storageKey(){
    return 'exam_answers_'+String(state.data.meta.code||'SIMULADO_V01').replace(/[^a-z0-9_-]/gi,'_');
  }

  function saveAnswers(){
    try{ localStorage.setItem(storageKey(), JSON.stringify(state.answers)); }catch(e){}
  }

  function loadSavedAnswers(){
    try{ state.answers = JSON.parse(localStorage.getItem(storageKey())||'{}') || {}; }catch(e){ state.answers={}; }
  }

  function clearSavedAnswers(){
    try{ localStorage.removeItem(storageKey()); }catch(e){}
  }

  function bindAnswerEvents(){
    document.querySelectorAll('.question input[type=radio]').forEach(input=>{
      input.addEventListener('change', e=>{
        const q = Number(e.target.name.replace('q',''));
        state.answers[q]=e.target.value;
        saveAnswers();
        updateProgress();
      }, {passive:true});
    });
  }

  document.getElementById('btnAnswers').addEventListener('click',()=>{
    state.showScratch=!state.showScratch;
    render();
    if(state.showScratch){
      setTimeout(()=>document.querySelector('.scratch-page')?.scrollIntoView({behavior:'smooth',block:'start'}),60);
    }
  });

  document.getElementById('btnPrint').addEventListener('click',()=>window.print());

  const paOrder=(String(EXAM_DATA.meta?.code||'').match(/SIM_(\d+)/i)?.[1]||'00').padStart(2,'0');
  const paVersion=(String(EXAM_DATA.meta?.version||'V08').match(/\d+/)?.[0]||'08').padStart(2,'0');
  const PA_SIM={contestId:"demhab-poa-arquiteto-2026",id:`demhab-fundatec-sim-${paOrder}-v${paVersion}`,code:String(EXAM_DATA.meta?.code||'SIMULADO')};
  const paProgressKey=()=>`planoarq:simulation-progress::${PA_SIM.contestId}::${PA_SIM.id}`;
  const paHistoryKey=()=>`planoarq:simulations::${PA_SIM.contestId}`;
  const paStartKey=()=>`planoarq:simulation-start::${PA_SIM.contestId}::${PA_SIM.id}`;
  const paMarkerKey=()=>`planoarq:simulation-recorded::${PA_SIM.contestId}::${PA_SIM.id}`;
  const paNow=()=>new Date().toISOString();
  const paSafe=(v,f)=>{try{return JSON.parse(v)??f}catch(_){return f}};
  function paDurationSeconds(){const raw=String(EXAM_DATA.meta?.duration||'').toLowerCase();const h=Number((raw.match(/(\d+)\s*h/)||[])[1]||0),m=Number((raw.match(/(\d+)\s*min/)||[])[1]||0);return Math.max(0,(h*60+m)*60)}
  function paClock(sec){sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
  function paTickTimer(){const el=document.getElementById('paSimTimer');if(!el)return;const total=paDurationSeconds(),started=localStorage.getItem(paStartKey());if(!total||!started){el.textContent='--:--:--';return}const elapsed=Math.max(0,Math.floor((Date.now()-new Date(started).getTime())/1000)),left=Math.max(0,total-elapsed);el.textContent=paClock(left);el.classList.toggle('warn',left>0&&left<=1800);el.classList.toggle('expired',left===0);el.title=left?'Tempo restante do simulado':'Tempo previsto esgotado'}
  function paAsk(title,text,confirmLabel='Confirmar'){return new Promise(resolve=>{const m=document.getElementById('paSimModal'),t=document.getElementById('paSimModalTitle'),p=document.getElementById('paSimModalText'),yes=document.getElementById('paSimConfirm'),no=document.getElementById('paSimCancel');t.textContent=title;p.textContent=text;yes.textContent=confirmLabel;m.classList.add('open');m.setAttribute('aria-hidden','false');const done=v=>{m.classList.remove('open');m.setAttribute('aria-hidden','true');yes.onclick=null;no.onclick=null;resolve(v)};yes.onclick=()=>done(true);no.onclick=()=>done(false)})}
  function paEnsureStart(){if(!localStorage.getItem(paStartKey()))localStorage.setItem(paStartKey(),paNow())}
  function paMirrorProgress(){paEnsureStart();localStorage.setItem(paProgressKey(),JSON.stringify({schema:1,contestId:PA_SIM.contestId,simulationId:PA_SIM.id,code:PA_SIM.code,updatedAt:paNow(),startedAt:localStorage.getItem(paStartKey())||paNow(),answers:state.answers,answered:Object.keys(state.answers||{}).length,total:allQuestions().length}))}
  function paRestoreMirror(){const own=localStorage.getItem(storageKey()),mirror=paSafe(localStorage.getItem(paProgressKey()),null);if(!own&&mirror?.answers&&Object.keys(mirror.answers).length){try{localStorage.setItem(storageKey(),JSON.stringify(mirror.answers))}catch(_){}}}
  function paResult(){const qs=allQuestions(),answered=qs.filter(q=>state.answers[q.number]).length,correct=qs.filter(q=>(state.answers[q.number]||'')===(q.answer||'').toUpperCase()).length;let points=0,maxPoints=0;const sections=(state.data.sections||[]).map(sec=>{const weight=Number(sec.weight||1),arr=sec.questions||[],hits=arr.filter(q=>(state.answers[q.number]||'')===(q.answer||'').toUpperCase()).length,p=hits*weight,max=arr.length*weight;points+=p;maxPoints+=max;return{title:sec.title,correct:hits,total:arr.length,weight,points:p,maxPoints:max,accuracy:arr.length?Math.round(hits*100/arr.length):0}});const errors=[];(state.data.sections||[]).forEach(sec=>(sec.questions||[]).forEach(q=>{const selected=state.answers[q.number]||'';if(selected!==(q.answer||'').toUpperCase())errors.push({number:q.number,section:sec.title,topic:q.topic||'',difficulty:q.difficulty||'',styleTag:q.styleTag||'',selected:selected||null,correct:(q.answer||'').toUpperCase(),blank:!selected})}));return{answered,correct,wrong:answered-correct,blank:qs.length-answered,totalQuestions:qs.length,points,maxPoints,accuracy:qs.length?Math.round(correct*100/qs.length):0,sections,errors}}
  function paRecordAttempt(){const marker=localStorage.getItem(paMarkerKey());if(marker==='finished')return;const result=paResult(),startedAt=localStorage.getItem(paStartKey())||paNow(),finishedAt=paNow(),elapsedSeconds=Math.max(0,Math.round((new Date(finishedAt)-new Date(startedAt))/1000)),hist=paSafe(localStorage.getItem(paHistoryKey()),[]);hist.unshift({schema:1,id:(crypto.randomUUID?crypto.randomUUID():`sim-${Date.now()}-${Math.random().toString(16).slice(2)}`),contestId:PA_SIM.contestId,simulationId:PA_SIM.id,code:PA_SIM.code,title:`Simulado ${paOrder} — FUNDATEC`,startedAt,finishedAt,elapsedSeconds,...result});localStorage.setItem(paHistoryKey(),JSON.stringify(hist.slice(0,100)));localStorage.setItem(paMarkerKey(),'finished');localStorage.removeItem(paProgressKey());localStorage.removeItem(paStartKey());window.dispatchEvent(new CustomEvent('planoarq:simulation-finished',{detail:hist[0]}))}
  function paResetBridge(){localStorage.removeItem(paProgressKey());localStorage.removeItem(paStartKey());localStorage.removeItem(paMarkerKey())}
  const __paSaveAnswers=saveAnswers;saveAnswers=function(){__paSaveAnswers();paMirrorProgress()};
  paRestoreMirror();paEnsureStart();paTickTimer();setInterval(paTickTimer,1000);document.addEventListener('visibilitychange',paTickTimer);

  document.getElementById('btnFinish').addEventListener('click',async()=>{
    if(state.finished){document.querySelector('.answer-page')?.scrollIntoView({behavior:'smooth',block:'start'});return}
    const total=allQuestions().length,answered=allQuestions().filter(q=>state.answers[q.number]).length,blank=total-answered;
    const msg=blank>0?`Você respondeu ${answered} de ${total} questões. Há ${blank} em branco. Deseja finalizar e corrigir mesmo assim?`:'Deseja finalizar e corrigir a prova agora?';
    if(await paAsk('Finalizar simulado',msg,'Finalizar e corrigir')){state.finished=true;render();paRecordAttempt();setTimeout(()=>document.querySelector('.answer-page')?.scrollIntoView({behavior:'smooth',block:'start'}),80)}
  });

  document.getElementById('btnReset').addEventListener('click',async()=>{
    if(await paAsk('Limpar respostas','Isso apaga as respostas em andamento deste simulado neste dispositivo. O histórico de tentativas concluídas será preservado.','Limpar respostas')){state.answers={};state.finished=false;clearSavedAnswers();paResetBridge();paEnsureStart();paTickTimer();render()}
  });

  loadSavedAnswers();
  paMirrorProgress();
  render();
  
