/* bloco compartilhado 01 */

(()=>{
  'use strict';
  const mq=matchMedia('(pointer:coarse) and (max-width:1400px)');
  const sync=()=>{
    const btn=document.querySelector('.touch-more-btn');
    const panel=document.querySelector('.touch-more-panel');
    if(!mq.matches){
      document.body.classList.remove('touch-more-open');
      btn?.setAttribute('aria-expanded','false');
      btn?.style.setProperty('display','none','important');
      panel?.style.setProperty('display','none','important');
      panel?.setAttribute('aria-hidden','true');
    }else{
      btn?.style.removeProperty('display');
      panel?.style.removeProperty('display');
      panel?.setAttribute('aria-hidden',document.body.classList.contains('touch-more-open')?'false':'true');
    }
  };
  mq.addEventListener?.('change',sync);
  addEventListener('resize',sync,{passive:true});
  sync();
  requestAnimationFrame(sync);
})();

/* bloco compartilhado 02 */

(function(){
  'use strict';
  const mq=window.matchMedia('(pointer:coarse) and (max-width:1400px)');
  let dock=null, placeholder=null, originalTop=0, raf=0, ro=null;

  const root=document.documentElement;
  const body=()=>document.body;

  function stickyTop(){
    const raw=getComputedStyle(root).getPropertyValue('--touch-dock-top').trim();
    // CSS max()/env() não é parseável como número; o WebView normalmente usa 8px.
    return 8;
  }

  function ensurePlaceholder(){
    if(!dock) return;
    placeholder=document.querySelector('.touch-toolbar-placeholder');
    if(!placeholder){
      placeholder=document.createElement('div');
      placeholder.className='touch-toolbar-placeholder';
      dock.parentNode.insertBefore(placeholder,dock);
    }
  }

  function measureOriginal(){
    if(!dock||!mq.matches) return;
    const wasFixed=dock.classList.contains('touch-toolbar-fixed');
    if(wasFixed) dock.classList.remove('touch-toolbar-fixed');
    if(placeholder) placeholder.style.height='0px';
    originalTop=window.scrollY+dock.getBoundingClientRect().top;
    if(wasFixed) dock.classList.add('touch-toolbar-fixed');
  }

  function updateVars(){
    if(!dock||!mq.matches) return;
    const r=dock.getBoundingClientRect();
    const h=Math.max(0,Math.round(r.height));
    root.style.setProperty('--touch-toolbar-height',h+'px');
    root.style.setProperty('--touch-toolbar-bottom',Math.max(0,Math.round(r.bottom))+'px');
  }

  function apply(){
    raf=0;
    if(!dock) return;
    const b=body();
    if(!mq.matches){
      dock.classList.remove('touch-toolbar-fixed');
      b?.classList.remove('smart-toolbar-hidden','touch-toolbar-pinned');
      if(placeholder) placeholder.style.height='0px';
      root.style.removeProperty('--touch-toolbar-height');
      root.style.removeProperty('--touch-toolbar-bottom');
      return;
    }

    b?.classList.remove('smart-toolbar-hidden');
    b?.classList.add('touch-toolbar-pinned');

    const top=stickyTop();
    const shouldFix=(window.scrollY+top)>=originalTop;
    if(shouldFix){
      if(!dock.classList.contains('touch-toolbar-fixed')){
        const h=dock.getBoundingClientRect().height;
        dock.classList.add('touch-toolbar-fixed');
        if(placeholder) placeholder.style.height=Math.ceil(h)+'px';
      }
    }else{
      dock.classList.remove('touch-toolbar-fixed');
      if(placeholder) placeholder.style.height='0px';
    }
    updateVars();
  }

  function schedule(){if(!raf) raf=requestAnimationFrame(apply)}

  function init(){
    dock=document.querySelector('.toolbar-dock');
    if(!dock) return;
    ensurePlaceholder();
    measureOriginal();
    apply();

    // Recalcula quando busca/toolbar muda de altura.
    if('ResizeObserver' in window){
      ro=new ResizeObserver(()=>{updateVars(); if(dock.classList.contains('touch-toolbar-fixed')&&placeholder) placeholder.style.height=Math.ceil(dock.getBoundingClientRect().height)+'px'});
      ro.observe(dock);
    }

    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',()=>{measureOriginal();schedule()},{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(()=>{measureOriginal();apply()},160),{passive:true});
    if(mq.addEventListener) mq.addEventListener('change',()=>{measureOriginal();apply()});
    else if(mq.addListener) mq.addListener(()=>{measureOriginal();apply()});

    setTimeout(()=>{measureOriginal();apply()},120);
    setTimeout(()=>{measureOriginal();apply()},550);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();

/* bloco compartilhado 03 */

(()=>{
  'use strict';
  const mq=matchMedia('(pointer:coarse) and (max-width:1400px)');
  const body=document.body;
  const dock=document.querySelector('.toolbar-dock');
  const toggle=document.querySelector('.branch-index-toggle');
  const index=document.querySelector('.branch-index');
  const moreBtn=document.querySelector('.touch-more-btn');
  const morePanel=document.querySelector('.touch-more-panel');
  if(!body||!dock) return;

  /* Proteção simples contra indicadores duplicados, sem observer global. */
  document.querySelectorAll('.branch-card').forEach(card=>{
    if(card.querySelector('.branch-signals')) card.querySelectorAll('.branch-content-indicators').forEach(el=>el.remove());
  });

  let anchor=dock.querySelector('.branch-nav-anchor');
  if(!anchor){
    anchor=document.createElement('div');
    anchor.className='branch-nav-anchor';
    dock.appendChild(anchor);
  }

  const mount=()=>{
    if(toggle && toggle.parentNode!==anchor) anchor.appendChild(toggle);
    if(index && index.parentNode!==anchor) anchor.appendChild(index);
  };

  const closeMore=()=>{
    body.classList.remove('touch-more-open');
    moreBtn?.setAttribute('aria-expanded','false');
  };
  const closeIndex=()=>{
    body.classList.remove('branch-index-open');
    toggle?.setAttribute('aria-expanded','false');
  };
  const reconcile=()=>{
    if(!mq.matches){closeMore();closeIndex();return}
    mount();
    /* Segurança: nunca permitir os dois estados simultaneamente. */
    if(body.classList.contains('touch-more-open') && body.classList.contains('branch-index-open')) closeIndex();
    moreBtn?.setAttribute('aria-expanded',String(body.classList.contains('touch-more-open')));
    toggle?.setAttribute('aria-expanded',String(body.classList.contains('branch-index-open')));
  };

  /* Escape é sempre uma saída segura. */
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeMore();closeIndex();}
  });

  /* Se um painel for aberto por qualquer engine legada, fecha o outro imediatamente,
     sem MutationObserver e sem loop de classes. */
  moreBtn?.addEventListener('click',()=>requestAnimationFrame(()=>{
    if(body.classList.contains('touch-more-open')) closeIndex();
    reconcile();
  }));
  toggle?.addEventListener('click',()=>requestAnimationFrame(()=>{
    if(body.classList.contains('branch-index-open')) closeMore();
    reconcile();
  }));

  mq.addEventListener?.('change',reconcile);
  addEventListener('resize',reconcile,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(reconcile,120),{passive:true});

  mount();
  reconcile();
  requestAnimationFrame(reconcile);
  setTimeout(reconcile,120);
})();

/* bloco compartilhado 04 */

(function(){
  function migrateLegacySignals(){
    document.querySelectorAll('.branch-card').forEach(card=>{
      card.querySelectorAll('.branch-signals').forEach(el=>el.remove());
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{migrateLegacySignals();setTimeout(migrateLegacySignals,80);setTimeout(migrateLegacySignals,350);});
})();

;(()=>{
  'use strict';
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(()=>{
    const body=document.body;
    const Q=(s,r=document)=>r.querySelector(s), QA=(s,r=document)=>[...r.querySelectorAll(s)];
    const topics=()=>QA('.topic-card');
    const ramos=()=>QA('main > .ramo');
    const overview=Q('.study-overview');
    const reviewBtn=Q('#reviewBtn');
    const reviewSummary=Q('.review-queue-summary');

    function stats(){
      const ts=topics();
      const total=ts.length;
      const done=ts.filter(t=>t.dataset.studyState==='done').length;
      const review=ts.filter(t=>t.dataset.studyState==='review').length;
      const difficult=ts.filter(t=>t.dataset.studyState==='difficult').length;
      const studied=done+review+difficult;
      const pending=Math.max(0,total-studied);
      return {total,done,review,difficult,studied,pending,pct:total?Math.round(studied/total*100):0};
    }

    function setText(id,value){const el=Q(id);if(el)el.textContent=value}

    function updateDashboard(){
      const s=stats();
      setText('#dashTotal',s.total);setText('#dashDone',s.done);setText('#dashReview',s.review);
      setText('#dashDifficult',s.difficult);setText('#dashPending',s.pending);setText('#dashProgress',s.pct+'%');
      const txt=Q('#studyOverviewText',overview||document);
      if(txt)txt.textContent=`${s.total} tópicos · ${s.done} OK · ${s.review} REV · ${s.difficult} DIF · ${s.pending} pendentes · ${s.pct}% estudado.`;
      updateReviewQueue();
    }

    function updateReviewQueue(){
      const s=stats(), queued=s.review+s.difficult;
      ramos().forEach(r=>{
        const count=QA('.topic-card[data-study-state="difficult"],.topic-card[data-study-state="review"]',r).length;
        r.classList.toggle('review-queue-empty',count===0);
      });
      if(reviewSummary){
        reviewSummary.innerHTML=queued
          ? `<strong>🎯 Fila inteligente · ${queued} tópico${queued===1?'':'s'}</strong><br><b>${s.difficult} DIF</b> primeiro · ${s.review} REV depois. Ao marcar como OK, o tópico sai automaticamente desta fila.`
          : `<strong>✓ Fila REV/DIF vazia</strong><br>Sem pendências marcadas; o modo Revisão mantém os MEMOs normais dos ramos.`;
      }
      syncReviewMode(false);
    }

    function syncReviewMode(openQueued=true){
      const s=stats(), queued=s.review+s.difficult;
      const active=body.classList.contains('review-mode')&&queued>0;
      body.classList.toggle('smart-review-queue',active);
      if(active&&openQueued){
        QA('.topic-card[data-study-state="difficult"],.topic-card[data-study-state="review"]').forEach(t=>t.open=true);
      }
    }

    // Estados são controlados pela engine original. Esta camada apenas lê e resume.
    document.addEventListener('mindmap:study-state-changed',()=>{updateDashboard();syncReviewMode(true)});
    document.addEventListener('click',e=>{
      if(e.target.closest('#reviewBtn')) setTimeout(()=>syncReviewMode(true),0);
    },false);

    const bodyObserver=new MutationObserver(muts=>{
      if(muts.some(m=>m.type==='attributes'&&m.attributeName==='class')) syncReviewMode(true);
    });
    bodyObserver.observe(body,{attributes:true,attributeFilter:['class']});

    updateDashboard();
    setTimeout(updateDashboard,80);
    setTimeout(updateDashboard,350);
  });
})();

;(()=>{
  'use strict';
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(()=>{
    const body=document.body;
    const main=document.querySelector('main');
    const topics=()=>[...document.querySelectorAll('details.topic-card,.topic-card')].filter((el,i,a)=>a.indexOf(el)===i);
    const ramos=()=>[...document.querySelectorAll('main > .ramo')];

    function applyAdaptiveDensity(){
      const total=topics().length;
      const density=total>90?'dense':total>45?'compact':'balanced';
      body.dataset.topicDensity=density;
      document.documentElement.dataset.topicDensity=density;
      body.dataset.topicCount=String(total);

      ramos().forEach(r=>{
        const local=r.querySelectorAll('.topic-card').length;
        r.dataset.topicCount=String(local);
        r.dataset.localDensity=local>18?'dense':local>11?'compact':'balanced';
      });
    }

    /* A estrutura de ramos/tópicos é estática após o carregamento dos materiais. */
    applyAdaptiveDensity();
  });
})();

(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const placeholder=/\[\[[\s\S]*?\]\]/;
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const realText=el=>{const t=clean(el?.textContent);return !!t && !placeholder.test(t)};

  /* Capa: classifica pelo conteúdo real, sem depender de viewport. */
  const hero=$('.hero'), title=$('.hero-title'), sub=$('.hero-sub');
  if(hero&&title){
    const n=clean(title.textContent).replace(/^🧠\s*/,'').length;
    hero.dataset.titleSize=n<=36?'short':n<=66?'medium':n<=104?'long':'extreme';
    if(sub) hero.dataset.subtitleSize=clean(sub.textContent).length>185?'long':'normal';
  }

  /* Estados vazios: fonte, Não Confunda e revisão externa só existem com conteúdo real. */
  $$('.topic-source-local').forEach(el=>{
    const ref=$('.topic-source-ref',el);
    el.classList.toggle('is-auto-empty',!realText(ref));
  });
  $$('.study-block--compare').forEach(block=>{
    const required=$$('.compare-side strong,.compare-side p,.compare-key p',block);
    const enough=required.length>=3 && required.some(realText) && $$('.compare-side strong',block).filter(realText).length>=2;
    block.classList.toggle('is-auto-empty',!enough);
  });
  $$('.review-box').forEach(box=>{
    const items=$$('li',box);
    box.classList.toggle('is-auto-empty',!items.some(realText));
  });

  /* Marca se há fila REV/DIF para que nenhum resumo vazio apareça. */
  const syncReviewPresence=()=>document.body.classList.toggle('has-smart-review-items',!!$('.topic-card[data-study-state="difficult"],.topic-card[data-study-state="review"]'));
  syncReviewPresence();
  document.addEventListener('click',e=>{if(e.target.closest('.state-btn')) setTimeout(syncReviewPresence,0)},true);

  /* Microcopy de segurança para conteúdo gerado a partir de versões antigas. */
  $$('.study-block h4').forEach(h=>{
    const t=clean(h.textContent).toUpperCase();
    if(t.includes('COMO PODE CAIR')||t.includes('COBRANÇA')) h.textContent='3 · COMO CAI';
    if(t.includes('MEMORIZAÇÃO')) h.textContent='5 · ÂNCORA MENTAL';
  });
  $$('.study-block--exam strong').forEach(el=>{if(/COBRANÇA DE PROVA/i.test(el.textContent))el.textContent='COMO CAI'});
  $$('.study-block--memory strong').forEach(el=>{if(/^MEMO$/i.test(clean(el.textContent)))el.textContent='ÂNCORA MENTAL'});

  /* Números/prazos/frações/artigos: realce tipográfico automático.
     Em touch, processa em lotes depois do primeiro paint para não atrasar o conteúdo. */
  const unitNum='(?:dias?|meses?|anos?|horas?|minutos?|segundos?|mm|cm|m²|m2|km|%|R\$)';
  const numRe=new RegExp('(\\bart\\.?\\s*\\d+[A-Za-zº°-]*|§\\s*\\d+[º°]?|\\b\\d+\\s*\\/\\s*\\d+\\b|\\b(?:19|20)\\d{2}\\b|\\b\\d+(?:[.,]\\d+)?(?=\\s*(?:(?:a|e|até|ou|,|–|—|-)\\s*\\d+(?:[.,]\\d+)?\\s*)+'+unitNum+'\\b)|\\b\\d+(?:[.,]\\d+)?\\s*'+unitNum+'\\b)','gi');
  const numberTargets=$$('.topic-body p,.topic-body li,.compare-side p,.compare-key p,.quote-box');
  const highlightNumbersIn=root=>{
    if(root.closest('.topic-source-local')) return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      if(!node.nodeValue||!numRe.test(node.nodeValue)){numRe.lastIndex=0;return NodeFilter.FILTER_REJECT}
      numRe.lastIndex=0;
      const p=node.parentElement;
      if(!p||p.closest('.study-number,script,style,textarea,button')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const val=node.nodeValue; numRe.lastIndex=0; let m,last=0; const frag=document.createDocumentFragment();
      while((m=numRe.exec(val))){
        if(m.index>last)frag.appendChild(document.createTextNode(val.slice(last,m.index)));
        const span=document.createElement('span');span.className='study-number';span.textContent=m[0];frag.appendChild(span);last=m.index+m[0].length;
        if(m[0].length===0)numRe.lastIndex++;
      }
      if(last){if(last<val.length)frag.appendChild(document.createTextNode(val.slice(last)));node.replaceWith(frag)}
    });
  };
  if(document.documentElement.classList.contains('touch-performance')&&numberTargets.length>24){
    let numberIndex=0;
    const pumpNumbers=()=>{
      const end=Math.min(numberIndex+18,numberTargets.length);
      while(numberIndex<end) highlightNumbersIn(numberTargets[numberIndex++]);
      if(numberIndex<numberTargets.length)setTimeout(pumpNumbers,16);
    };
    requestAnimationFrame(()=>setTimeout(pumpNumbers,0));
  }else{
    numberTargets.forEach(highlightNumbersIn);
  }

  /* aria-expanded sincronizado com details nativo. */
  $$('.topic-card').forEach(d=>{
    const s=$('.topic-summary',d); if(!s)return;
    const sync=()=>s.setAttribute('aria-expanded',String(!!d.open)); sync(); d.addEventListener('toggle',sync);
  });
})();

/* bloco compartilhado 05 */

(function(){
  const closeAllGeneratedTopics = () => {
    document.querySelectorAll('details.topic-card').forEach(topic => {
      topic.open = false;
      topic.removeAttribute('open');
      const summary = topic.querySelector(':scope > summary');
      if (summary) summary.setAttribute('aria-expanded','false');
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', closeAllGeneratedTopics, {once:true});
  } else {
    closeAllGeneratedTopics();
  }
})();

/* bloco compartilhado 06 */

(function(){
  const norm = s => (s||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('pt-BR');

  function removeHowToStudyBlock(){
    const phrase='como estudar este material';
    const headings=[...document.querySelectorAll('main strong,main b,main h2,main h3,main h4,main h5,main [data-study-guide-title]')];
    headings.forEach(el=>{
      const t=norm(el.textContent).replace(/:$/,'');
      if(t!==phrase) return;

      let box=el.closest('[data-study-material-guide],.study-material-guide,.how-to-study,.material-study-guide,.notice,aside,article,section');
      if(!box){
        let p=el.parentElement, best=null;
        while(p && p!==document.querySelector('main')){
          const len=(p.textContent||'').trim().length;
          if(len>0 && len<1500) best=p;
          if(len>=1500) break;
          p=p.parentElement;
        }
        box=best;
      }
      box?.remove();
    });
  }

  function memoItemsFrom(box){
    const lis=[...box.querySelectorAll('li')].map(li=>li.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
    if(lis.length) return lis;
    return [...box.querySelectorAll('p')].map(p=>p.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
  }

  function consolidateBranchMemos(){
    const ramos=[...document.querySelectorAll('main > .ramo')];
    ramos.forEach((ramo,idx)=>{
      const memos=[...ramo.children].filter(el=>el.classList?.contains('review-box'));
      if(!memos.length) return;

      const items=[];
      const seen=new Set();
      memos.forEach(m=>memoItemsFrom(m).forEach(txt=>{
        const key=norm(txt);
        if(key && !seen.has(key)){seen.add(key);items.push(txt)}
      }));

      const memo=memos[0];
      memos.slice(1).forEach(m=>m.remove());
      memo.classList.add('branch-memo');
      memo.dataset.branchMemo=String(idx+1).padStart(2,'0');

      let h=memo.querySelector('h4');
      if(!h){h=document.createElement('h4');memo.prepend(h)}
      h.textContent=`MEMO DO BLOCO — RAMO ${String(idx+1).padStart(2,'0')}`;

      let ul=memo.querySelector('ul');
      if(!ul){ul=document.createElement('ul');memo.appendChild(ul)}
      ul.className='branch-memo-grid';
      if(items.length){
        ul.replaceChildren(...items.map(txt=>{
          const li=document.createElement('li');
          li.textContent=txt;
          return li;
        }));
      }

      const topics=[...ramo.children].filter(el=>el.matches?.('details.topic-card'));
      const lastTopic=topics.at(-1);
      if(lastTopic) lastTopic.insertAdjacentElement('afterend',memo);
      else ramo.appendChild(memo);
    });
  }

  const run=()=>{removeHowToStudyBlock();consolidateBranchMemos()};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();

/* bloco compartilhado 07 */

(()=>{
  'use strict';

  const root=document.documentElement;
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const touchLite=window.matchMedia?.('(pointer:coarse)');
  if(root.classList.contains('touch-performance')||touchLite?.matches||((navigator.maxTouchPoints||0)>0)){root.style.setProperty('--architect-grid-y','0px');root.style.setProperty('--architect-grid-x','0px');root.style.setProperty('--architect-halo-y','0px');root.style.setProperty('--architect-halo-x','0px');return;}
  let raf=0;

  function update(){
    raf=0;
    const y=window.scrollY||window.pageYOffset||0;
    const factor=reduce?.matches ? .25 : 1;

    /* presença de profundidade mais legível */
    const gridY=-(y*.080*factor);
    const haloY=-(y*.040*factor);

    const gridX=Math.sin(y/1200)*5.5*factor;
    const haloX=Math.sin(y/1750)*14.0*factor;

    root.style.setProperty('--architect-grid-y','0px');
    root.style.setProperty('--architect-grid-x','0px');
    root.style.setProperty('--architect-halo-y',haloY.toFixed(2)+'px');
    root.style.setProperty('--architect-halo-x',haloX.toFixed(2)+'px');
  }

  const request=()=>{ if(!raf) raf=requestAnimationFrame(update); };

  addEventListener('scroll',request,{passive:true});
  addEventListener('resize',request,{passive:true});
  reduce?.addEventListener?.('change',request);

  update();
})();

/* bloco compartilhado 08 */

(()=>{
  'use strict';

  const PALETTE=['#B23A48', '#486387', '#BA87AE', '#CFB291', '#59614B', '#5B3765', '#D77A7D', '#1E2840', '#9E9B88', '#6A040F', '#83A2CD', '#5A3122'];

  function applyBranchPalette(){
    const branches=[...document.querySelectorAll('#mindmap > .branch-card')];
    const ramos=[...document.querySelectorAll('main > .ramo')];

    ramos.forEach((ramo,i)=>{
      const color=PALETTE[i % PALETTE.length];
      ramo.style.setProperty('--accent',color);

      ramo.querySelectorAll('.topic-card').forEach(topic=>{
        topic.style.setProperty('--topic',color);
      });

      const branch=branches[i];
      if(branch) branch.style.setProperty('--accent',color);
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',applyBranchPalette,{once:true});
  }else{
    applyBranchPalette();
  }

  /* expõe para geradores/rotinas que substituam o conteúdo */
  window.applyBranchPalette=applyBranchPalette;
})();

/* bloco compartilhado 09 */

(()=>{
  'use strict';

  const titles=()=>[...document.querySelectorAll('main > .ramo .ramo-title')];
  let raf=0;

  const px=(v,fallback)=>{
    const n=parseFloat(v);
    return Number.isFinite(n)?n:fallback;
  };

  function fitOne(el){
    if(!el || el.offsetParent===null) return;

    const cs=getComputedStyle(el);
    const max=px(cs.getPropertyValue('--ramo-title-max'),27);
    const min=px(cs.getPropertyValue('--ramo-title-min'),12);

    el.style.setProperty('--ramo-fit-size',max+'px');

    const available=el.clientWidth;
    if(!available) return;

    /* Já cabe no tamanho editorial normal: não reduz. */
    if(el.scrollWidth <= available + .5) return;

    /* Busca binária: maior tamanho que ainda cabe em uma linha. */
    let low=min, high=max, best=min;

    for(let i=0;i<11;i++){
      const mid=(low+high)/2;
      el.style.setProperty('--ramo-fit-size',mid.toFixed(2)+'px');

      if(el.scrollWidth <= available + .5){
        best=mid;
        low=mid;
      }else{
        high=mid;
      }
    }

    el.style.setProperty('--ramo-fit-size',best.toFixed(2)+'px');

    /*
      Segurança para títulos excepcionalmente extensos:
      reduz em pequenos passos abaixo do mínimo editorial somente
      quando isso for indispensável para cumprir a regra "1 linha".
    */
    let size=best;
    let guard=0;
    while(el.scrollWidth > available + .5 && size>8 && guard<18){
      size-=.35;
      el.style.setProperty('--ramo-fit-size',size.toFixed(2)+'px');
      guard++;
    }
  }

  function fitAll(){
    raf=0;
    titles().forEach(fitOne);
  }

  function schedule(){
    if(!raf) raf=requestAnimationFrame(fitAll);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',schedule,{once:true});
  }else{
    schedule();
  }

  document.fonts?.ready?.then(schedule).catch(()=>{});
  addEventListener('resize',schedule,{passive:true});
  addEventListener('orientationchange',schedule,{passive:true});

  /* ResizeObserver + fonts.ready cobrem as únicas mudanças que afetam
     a largura real dos títulos; classes internas não exigem refit. */
  if('ResizeObserver' in window){
    const ro=new ResizeObserver(schedule);
    titles().forEach(t=>ro.observe(t.parentElement || t));
  }

  window.fitBranchTitlesSingleLine=schedule;
})();

/* bloco compartilhado 10 */

(()=>{
  'use strict';

  const root=document.documentElement;
  const mq=window.matchMedia('(max-width:1180px)');
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  const touchLite=window.matchMedia('(pointer:coarse)');
  if(root.classList.contains('touch-performance')||touchLite.matches||((navigator.maxTouchPoints||0)>0)){root.style.setProperty('--tablet-halo-y','0px');root.style.setProperty('--tablet-halo-x','0px');return;}
  let raf=0;

  function update(){
    raf=0;

    if(!mq.matches){
      root.style.removeProperty('--tablet-halo-x');
      root.style.removeProperty('--tablet-halo-y');
      return;
    }

    const y=window.scrollY || window.pageYOffset || 0;
    const factor=reduce.matches ? .22 : 1;

    /*
      O pontilhado NÃO participa deste cálculo.
      Apenas o halo se desloca, com amplitude um pouco maior
      no tablet para que o efeito continue perceptível.
    */
    const haloY=-(y * .045 * factor);
    const haloX=Math.sin(y / 1250) * 13 * factor;

    root.style.setProperty('--tablet-halo-y',haloY.toFixed(2)+'px');
    root.style.setProperty('--tablet-halo-x',haloX.toFixed(2)+'px');
  }

  function schedule(){
    if(!raf) raf=requestAnimationFrame(update);
  }

  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  addEventListener('orientationchange',schedule,{passive:true});
  mq.addEventListener?.('change',schedule);
  reduce.addEventListener?.('change',schedule);

  update();
})();

/* bloco compartilhado 11 */

(()=>{
  'use strict';

  const mq=matchMedia('(pointer:coarse) and (max-width:1400px)');
  const body=document.body;
  const panel=document.querySelector('.touch-more-panel');
  const moreBtn=document.querySelector('.touch-more-btn');

  if(!body || !panel || !moreBtn) return;

  /* O painel deixa de depender do stacking/hit-testing do toolbar-dock. */
  if(panel.parentElement !== body) body.appendChild(panel);
  panel.classList.add('touch-more-panel-v2');
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label','Ferramentas de estudo');

  const actionName={
    highBtn:'high',
    hardBtn:'hard',
    expandBtn:'expand',
    collapseBtn:'collapse',
    clearBtn:'clear'
  };

  panel.querySelectorAll('.touch-more-action[data-proxy]').forEach(btn=>{
    const proxy=btn.dataset.proxy;
    if(actionName[proxy]) btn.dataset.action=actionName[proxy];
    btn.setAttribute('aria-pressed','false');
  });

  const status=panel.querySelector('#touchMoreStatus');

  const getBtn=(proxy)=>panel.querySelector(`.touch-more-action[data-proxy="${proxy}"]`);
  const target=(id)=>document.getElementById(id);

  function setPressed(btn,on){
    if(!btn) return;
    btn.classList.toggle('active',!!on);
    btn.setAttribute('aria-pressed',String(!!on));
  }

  function flash(btn){
    if(!btn) return;
    btn.classList.remove('is-feedback');
    void btn.offsetWidth;
    btn.classList.add('is-feedback');
    setTimeout(()=>btn.classList.remove('is-feedback'),320);
  }

  function sync(){
    const high=getBtn('highBtn');
    const hard=getBtn('hardBtn');
    const expand=getBtn('expandBtn');
    const collapse=getBtn('collapseBtn');

    const highTarget=target('highBtn');
    const hardTarget=target('hardBtn');

    setPressed(
      high,
      highTarget?.getAttribute('aria-pressed')==='true' ||
      highTarget?.classList.contains('active')
    );

    setPressed(
      hard,
      hardTarget?.getAttribute('aria-pressed')==='true' ||
      hardTarget?.classList.contains('active') ||
      body.classList.contains('hard-mode')
    );

    const topics=[...document.querySelectorAll('.topic-card')];
    const visible=topics.filter(t=>!t.classList.contains('filtered-out'));
    const visibleOpen=visible.filter(t=>t.open).length;
    const totalOpen=topics.filter(t=>t.open).length;

    /* Expandir = todos os tópicos atualmente visíveis estão abertos. */
    setPressed(expand,visible.length>0 && visibleOpen===visible.length);

    /* Recolher = nenhum tópico aberto. */
    setPressed(collapse,topics.length>0 && totalOpen===0);

    const progress=document.getElementById('studyProgressText');
    if(status){
      status.textContent=(progress?.textContent || '0/0 tópicos')
        .replace(' tópicos marcados · ',' · ');
    }

    const open=body.classList.contains('touch-more-open');
    moreBtn.setAttribute('aria-expanded',String(open));
    moreBtn.classList.toggle('active',open);
    panel.setAttribute('aria-hidden',String(!open));
  }

  function closePanel(){
    body.classList.remove('touch-more-open');
    moreBtn.setAttribute('aria-expanded','false');
    moreBtn.classList.remove('active');
    panel.setAttribute('aria-hidden','true');
  }

  /*
    Controlador em CAPTURE:
    intercepta os handlers legados do painel antes do bubble,
    evitando clique duplo / estado desencontrado.
  */
  panel.addEventListener('click',e=>{
    const btn=e.target.closest('.touch-more-action');
    if(!btn || !panel.contains(btn)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if(btn.dataset.action==='close'){
      closePanel();
      return;
    }

    const proxy=btn.dataset.proxy;
    const t=proxy ? target(proxy) : null;

    if(!t){
      flash(btn);
      sync();
      return;
    }

    /* Programmatic click no controle-fonte mantém toda a lógica
       pedagógica original sem duplicá-la. */
    t.click();

    requestAnimationFrame(()=>{
      sync();

      if(proxy==='clearBtn'){
        flash(btn);
      }else if(proxy==='expandBtn' || proxy==='collapseBtn'){
        flash(btn);
        /* após o feedback, volta para o estado persistente calculado */
        setTimeout(sync,340);
      }
    });
  },true);

  /* Botão Mais e mudanças externas de estado. */
  moreBtn.addEventListener('click',()=>requestAnimationFrame(sync));

  ['highBtn','hardBtn','expandBtn','collapseBtn','clearBtn','reviewBtn','eveBtn'].forEach(id=>{
    target(id)?.addEventListener('click',()=>requestAnimationFrame(sync));
  });

  /* Toggle de details não precisa depender de bubble. */
  document.addEventListener('toggle',e=>{
    if(e.target?.classList?.contains('topic-card')) requestAnimationFrame(sync);
  },true);
  document.addEventListener('mindmap:study-state-changed',()=>requestAnimationFrame(sync));

  /* Fechar ao sair do modo touch. */
  mq.addEventListener?.('change',()=>{
    if(!mq.matches) closePanel();
    sync();
  });

  addEventListener('resize',sync,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(sync,100),{passive:true});

  sync();
})();

/* bloco compartilhado 12 */

(()=>{
  'use strict';

  const mq=matchMedia('(pointer:coarse) and (max-width:1400px)');
  const dock=document.querySelector('.toolbar-dock');
  const toolbar=dock?.querySelector('.toolbar');
  const ctx=document.querySelector('.context-bar');

  if(!dock || !toolbar || !ctx) return;

  const secondary=ctx.querySelector('#ctxSecondary');

  function mount(){
    if(mq.matches){
      /* Contexto passa a fazer parte física do mesmo dock da toolbar. */
      if(ctx.parentElement!==dock || ctx.previousElementSibling!==toolbar){
        toolbar.insertAdjacentElement('afterend',ctx);
      }

      if(secondary){
        secondary.hidden=true;
        secondary.setAttribute('aria-hidden','true');
      }
    }else{
      /* Desktop mantém a arquitetura anterior. */
      if(ctx.parentElement===dock){
        dock.insertAdjacentElement('afterend',ctx);
      }

      if(secondary){
        secondary.hidden=false;
        secondary.removeAttribute('aria-hidden');
      }
    }
  }

  mount();
  mq.addEventListener?.('change',mount);
  addEventListener('orientationchange',()=>setTimeout(mount,80),{passive:true});

  /*
    A engine de toolbar já observa o tamanho do dock por ResizeObserver;
    ao mover a context-bar para dentro, placeholder e --touch-toolbar-bottom
    passam a incluir automaticamente as duas barras.
  */
})();

/* bloco compartilhado 13 */

(()=>{
  'use strict';

  const mq=matchMedia('(pointer:coarse) and (max-width:1400px)');
  let current=null;
  let startX=0, startY=0;

  const clear=()=>{
    if(current){
      current.classList.remove('is-touch-press');
      current=null;
    }
  };

  document.addEventListener('pointerdown',e=>{
    if(!mq.matches || e.pointerType==='mouse') return;

    const card=e.target.closest('.branch-card[data-target]');
    if(!card) return;

    clear();
    current=card;
    startX=e.clientX;
    startY=e.clientY;
    card.classList.add('is-touch-press');
  },{passive:true});

  document.addEventListener('pointermove',e=>{
    if(!current || e.pointerType==='mouse') return;

    /* Se o gesto virou rolagem, o feedback some imediatamente. */
    if(Math.abs(e.clientX-startX)>9 || Math.abs(e.clientY-startY)>9){
      clear();
    }
  },{passive:true});

  document.addEventListener('pointerup',()=>{
    /* pequeno atraso só para o toque ser perceptível */
    setTimeout(clear,70);
  },{passive:true});

  document.addEventListener('pointercancel',clear,{passive:true});
  addEventListener('scroll',clear,{passive:true});
  addEventListener('blur',clear,{passive:true});

  mq.addEventListener?.('change',clear);
})();

/* bloco compartilhado 14 */

(()=>{
  'use strict';

  const mq=matchMedia('(pointer:coarse) and (max-width:1400px)');
  const moreBtn=document.querySelector('.touch-more-btn');

  function syncMoreLabel(){
    if(!moreBtn) return;

    if(mq.matches){
      moreBtn.innerHTML=
        '<span class="more-dots" aria-hidden="true">•••</span>' +
        '<span class="label-long">Mais</span>';
    }else{
      moreBtn.innerHTML=
        '🧰 <span class="label-long">Mais</span>';
    }
  }

  syncMoreLabel();
  mq.addEventListener?.('change',syncMoreLabel);
})();

/* bloco compartilhado 15 */

(()=>{
  'use strict';
  const root=document.documentElement;
  const coarse=matchMedia('(pointer:coarse)');
  const touch=('maxTouchPoints' in navigator && navigator.maxTouchPoints>0)||coarse.matches;
  if(!touch) return;
  root.classList.add('touch-performance');
  const isiPadOS=/iPad|iPhone|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(isiPadOS) root.classList.add('ios-webkit-touch');
  const topicCount=document.querySelectorAll('.topic-card').length;
  const sectionCount=document.querySelectorAll('main > .ramo, main > .global').length;
  if(topicCount>24||sectionCount>10) root.classList.add('touch-long-page');

  // CSS viewport unit fallback for older Safari builds and split-screen resizing.
  let viewportRaf=0;
  const syncViewport=()=>{
    viewportRaf=0;
    const h=window.visualViewport?.height||window.innerHeight;
    root.style.setProperty('--stable-vh',(h*.01).toFixed(3)+'px');
  };
  const scheduleViewport=()=>{if(!viewportRaf) viewportRaf=requestAnimationFrame(syncViewport);};
  window.addEventListener('orientationchange',scheduleViewport,{passive:true});
  window.addEventListener('resize',scheduleViewport,{passive:true});
  window.visualViewport?.addEventListener('resize',scheduleViewport,{passive:true});
  syncViewport();

  // A classificação longa é estática: tópicos/ramos não são adicionados após o boot.
})();

/* bloco compartilhado 16 */

(()=>{
  'use strict';
  const root=document.documentElement;
  const nav=navigator;
  const touch=root.classList.contains('touch-performance')||((nav.maxTouchPoints||0)>0);
  if(touch){
    const sync=()=>{
      const vv=window.visualViewport;
      const h=(vv&&vv.height)||window.innerHeight||document.documentElement.clientHeight||1;
      root.style.setProperty('--stable-vh',(h*.01).toFixed(3)+'px');
    };
    addEventListener('pageshow',sync,{passive:true});
  }

  let hasSelector=true;
  try{hasSelector=!!(window.CSS&&CSS.supports&&CSS.supports('selector(:has(*))'));}catch(_){hasSelector=false;}
  if(!hasSelector){
    root.classList.add('no-css-has');
    const mark=()=>document.querySelectorAll('main > .ramo').forEach(r=>r.classList.toggle('has-review-box',!!r.querySelector('.review-box')));
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mark,{once:true});else mark();
  }
})();

/* bloco compartilhado 17 */

(()=>{
  'use strict';
  let source=null, sourceBtn=null, lastFocus=null;
  const overlay=document.createElement('div');
  overlay.className='note-focus-overlay';
  overlay.setAttribute('aria-hidden','true');
  overlay.innerHTML=`<section class="note-focus-dialog" role="dialog" aria-modal="true" aria-labelledby="noteFocusTitle"><header class="note-focus-head"><div class="note-focus-title-wrap"><span class="note-focus-kicker">📝 Anotação pessoal · modo foco</span><strong class="note-focus-title" id="noteFocusTitle">Minha nota</strong></div><span class="note-focus-status">salva automaticamente</span><button class="note-focus-close" type="button" aria-label="Fechar modo foco">×</button></header><div class="note-focus-body"><textarea class="note-focus-textarea" aria-label="Anotação pessoal em modo foco" placeholder="Escreva sua observação, associação, pegadinha da banca ou lembrete pessoal…"></textarea></div></section>`;
  document.body.appendChild(overlay);
  const dialog=overlay.querySelector('.note-focus-dialog');
  const focusTA=overlay.querySelector('.note-focus-textarea');
  const title=overlay.querySelector('.note-focus-title');
  const closeBtn=overlay.querySelector('.note-focus-close');

  const topicTitle=panel=>panel?.closest('.topic-card')?.querySelector('.topic-name')?.textContent?.trim()||'Minha nota';
  function closeFocus(){
    if(!overlay.classList.contains('open'))return;
    overlay.classList.remove('open'); overlay.setAttribute('aria-hidden','true'); document.body.classList.remove('note-focus-open');
    source=null; sourceBtn=null;
    const target=lastFocus; lastFocus=null; if(target?.isConnected)setTimeout(()=>target.focus({preventScroll:true}),0);
  }
  function openFocus(panel,btn){
    const ta=panel?.querySelector('textarea'); if(!ta)return;
    source=ta; sourceBtn=btn; lastFocus=document.activeElement;
    focusTA.value=ta.value; title.textContent=topicTitle(panel);
    overlay.classList.add('open'); overlay.setAttribute('aria-hidden','false'); document.body.classList.add('note-focus-open');
    setTimeout(()=>{focusTA.focus(); try{focusTA.setSelectionRange(focusTA.value.length,focusTA.value.length)}catch{}},30);
  }
  function enhance(panel){
    if(!panel||panel.dataset.focusReady==='1')return;
    const head=panel.querySelector('.personal-note-head'); const ta=panel.querySelector('textarea'); if(!head||!ta)return;
    panel.dataset.focusReady='1';
    const btn=document.createElement('button'); btn.type='button'; btn.className='note-focus-btn'; btn.innerHTML='⛶ <span>Foco</span>'; btn.setAttribute('aria-label','Abrir anotação em modo foco');
    const saved=head.querySelector('.personal-note-saved'); if(saved)head.insertBefore(btn,saved); else head.appendChild(btn);
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openFocus(panel,btn)});
  }
  function enhanceAll(){document.querySelectorAll('.personal-note-panel').forEach(enhance)}
  focusTA.addEventListener('input',()=>{
    if(!source)return; source.value=focusTA.value; source.dispatchEvent(new Event('input',{bubbles:true}));
  });
  closeBtn.addEventListener('click',closeFocus);
  overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)closeFocus()});
  dialog.addEventListener('pointerdown',e=>e.stopPropagation());
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open')){e.preventDefault();closeFocus()}});
  /* Os painéis de nota são montados pelo preconfig antes deste runtime. */
  enhanceAll();
})();

/* bloco compartilhado 19 */

(()=>{
  'use strict';
  const API=window.MINDMAP_V134||window.MINDMAP_V133||{}; if(!API.stateKey)return;
  const Q=(s,r=document)=>r.querySelector(s), QA=(s,r=document)=>[...r.querySelectorAll(s)];
  const topics=()=>QA('.topic-card'); const now=()=>Date.now();
  const readState=()=>{try{const s=JSON.parse(localStorage.getItem(API.stateKey)||'{}')||{};s.topicStates=s.topicStates||{};s.reviewMeta=s.reviewMeta||{};s.quizMeta=s.quizMeta||{};return s}catch(_){return{topicStates:{},reviewMeta:{},quizMeta:{}}}};
  const writeState=s=>{try{localStorage.setItem(API.stateKey,JSON.stringify(s))}catch(_){}};
  const readNotes=()=>{try{return JSON.parse(localStorage.getItem(API.notesKey)||'{}')||{}}catch(_){return{}}};
  const writeNotes=n=>{try{localStorage.setItem(API.notesKey,JSON.stringify(n))}catch(_){}};
  const esc=s=>{const d=document.createElement('div');d.textContent=s||'';return d.innerHTML};
  function questionVisualHtml(v){const raw=v?.media;if(!raw)return'';const items=(Array.isArray(raw)?raw:[raw]).filter(Boolean).slice(0,3);const figs=items.map((m,i)=>{const src=String(m.src||'');if(!/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(src))return'';const alt=esc(m.alt||'Figura técnica utilizada na questão');const parts=[m.caption,m.figure?`Figura ${m.figure}`:'',m.page?`p. ${m.page}`:'',m.sourceLabel||m.sourceRef||''].map(x=>String(x||'').trim()).filter(Boolean);const cap=parts.length?`<figcaption><span class=\"v159-question-visual-source\">Fonte:</span> ${esc(parts.join(' · '))}</figcaption>`:'';return `<figure class=\"v159-question-visual\"><img src=\"${src.replace(/\"/g,'')}\" alt=\"${alt}\" loading=\"lazy\" decoding=\"async\">${cap}</figure>`}).join('');return figs}
  const fmtDate=v=>{if(!v)return'';try{return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'}).format(new Date(v))}catch(_){return''}};
  const addDays=d=>{const x=new Date();x.setHours(8,0,0,0);x.setDate(x.getDate()+d);return x.toISOString()};
  const metaFor=(s,id)=>s.reviewMeta[id]||(s.reviewMeta[id]={reviewCount:0,errorCount:0,confidence:0,lastReviewed:'',nextReview:''});
  const quizFor=(s,id)=>s.quizMeta[id]||(s.quizMeta[id]={attempts:0,correct:0,wrong:0,streak:0,lastChoice:'',lastCorrect:null,lastLevel:'',lastAnswered:''});
  const due=m=>!!m?.nextReview&&new Date(m.nextReview).getTime()<=now();
  const markerScore=t=>{const a=(t.dataset.markers||'').split(',');return(a.includes('star')?5:0)+(a.includes('warn')?4:0)+(a.includes('num')?3:0)+(a.includes('imp')?2:0)+(a.includes('target')?2:0)};
  const titleOf=t=>Q('.topic-name',t)?.textContent?.trim()||t.id;
  const refOf=t=>Q('.topic-code',t)?.textContent?.replace(/\s+/g,' ').trim()||'';
  const branchOf=t=>t.closest('.ramo')?.querySelector('.ramo-title')?.textContent?.trim()||'';
  function syncBadges(t,s){const summary=Q('.topic-summary',t);if(!summary)return;let box=Q('.v133-topic-badges',summary);if(!box){box=document.createElement('span');box.className='v133-topic-badges';summary.appendChild(box)}const m=s.reviewMeta[t.id]||{},q=s.quizMeta[t.id]||{},bits=[];if(due(m))bits.push('<span class="v133-badge due">📅 Hoje</span>');if((m.errorCount||0)>0)bits.push(`<span class="v133-badge error">✕ ${m.errorCount}</span>`);if((q.attempts||0)>0){const pct=Math.round((q.correct||0)*100/q.attempts);bits.push(`<span class="v133-badge">🧠 ${pct}%</span>`)}box.innerHTML=bits.join('')}
  function setStudyState(t,kind,s){if(kind)s.topicStates[t.id]=kind;else delete s.topicStates[t.id];t.dataset.studyState=kind||'';QA('.state-btn',t).forEach(b=>{const on=b.dataset.state===kind;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))})}
  function grade(t,grade){const s=readState(),m=metaFor(s,t.id);m.reviewCount=(m.reviewCount||0)+1;m.lastReviewed=new Date().toISOString();if(grade==='wrong'){m.errorCount=(m.errorCount||0)+1;m.confidence=0;m.nextReview=addDays(1);setStudyState(t,'difficult',s)}else if(grade==='doubt'){m.confidence=1;m.nextReview=addDays(3);setStudyState(t,'review',s)}else if(grade==='right'){const wasWeak=(m.confidence===0&&(m.reviewCount||0)>1);m.confidence=wasWeak?1:2;const n=m.reviewCount||1;const days=wasWeak?3:(n>=5?60:n>=4?30:n>=3?14:7);m.nextReview=addDays(days);setStudyState(t,wasWeak?'review':'done',s)}writeState(s);syncBadges(t,s);refreshHub()}

  document.addEventListener('plano-arq:review-grade-request',e=>{
    const d=e.detail||{},t=document.getElementById(String(d.topicId||''));
    if(!t||!['wrong','doubt','right'].includes(d.grade))return;
    grade(t,d.grade);
    document.dispatchEvent(new CustomEvent('plano-arq:review-grade-applied',{detail:{topicId:t.id,grade:d.grade,requestId:d.requestId||''}}));
  });
  function markForReview(t){const s=readState(),m=metaFor(s,t.id);m.confidence=1;m.nextReview=addDays(3);setStudyState(t,'review',s);writeState(s);syncBadges(t,s);refreshHub();toast('Tópico marcado para revisar')}
  function questionData(t){const el=Q('.v134-question-data',t);if(!el)return null;try{return JSON.parse(el.textContent)}catch(_){return null}}
  function variantsOf(data){
    if(Array.isArray(data?.variants))return data.variants;
    if(data?.questions&&typeof data.questions==='object')return ['N1','N2','N3'].flatMap(k=>Array.isArray(data.questions[k])?data.questions[k]:[]);
    return [];
  }
  const levelOf=v=>String(v?.difficulty||v?.id||'N2').toUpperCase().match(/N[123]/)?.[0]||'N2';
  const masteryOf=m=>Number.isFinite(+m?.mastery)?Math.max(0,Math.min(100,+m.mastery)):50;
  const listify=v=>Array.isArray(v)?v:String(v||'').split(',').map(x=>x.trim()).filter(Boolean);
  function desiredLevel(q,m){
    const mastery=masteryOf(m);
    if(!(q.attempts||0))return'N2';
    if(q.lastCorrect===false||mastery<35)return'N1';
    if(q.lastConfidence==='guess'||q.pendingConfidence)return'N2';
    if(mastery>=72&&(q.streak||0)>=2)return'N3';
    return'N2';
  }
  function chooseVariant(data,q,m={},state={},t=null){
    const vars=variantsOf(data);if(!vars.length)return null;
    const desired=desiredLevel(q,m),recent=(q.variantHistory||[]).slice(-3),need=String(q.lastErrorType||q.lastDistractorTrap||'').toLowerCase();
    const globalPatterns=state?.v135?.errorPatterns||{};
    const commonTrap=Object.entries(globalPatterns).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
    const rank=v=>{
      const lev=levelOf(v);let r=lev===desired?0:lev==='N2'?5:9;
      const id=String(v.id||lev),anti=listify(v.antidoteFor).map(x=>String(x).toLowerCase()),trap=String(v.trapType||'').toLowerCase();
      if(need&&(anti.includes(need)||trap===need))r-=9;
      else if(commonTrap&&(anti.includes(commonTrap)||trap===commonTrap))r-=2;
      if(recent.includes(id))r+=recent[recent.length-1]===id?24:9;
      r+=(q.variantCounts?.[id]||0)*1.4;
      if(v.interdisciplinary&&lev!=='N3')r+=8;
      return r;
    };
    return [...vars].sort((a,b)=>rank(a)-rank(b))[0]||vars[0];
  }
  function shuffleAllowed(data,v){
    if(v?.shuffle===false)return false;
    const signature=((data?.format||'')+' '+(v?.examFormat||'')+' '+(v?.type||'')+' '+(v?.prompt||'')).toUpperCase();
    if(/V\/F|CERTO|ERRADO|ASSOCIA|COLUN|SEQU[ÊE]NCIA|ORDENE|LACUNA/.test(signature))return false;
    const labels=(v?.options||[]).map(o=>String(o.label||''));
    return labels.length>=3&&labels.every((x,i)=>x===String.fromCharCode(65+i));
  }
  function optionView(data,v,storedOrder=null){
    const opts=(v?.options||[]).map(o=>({...o,_key:String(o.label)}));
    let ordered=[...opts];
    if(Array.isArray(storedOrder)&&storedOrder.length===opts.length){const by=new Map(opts.map(o=>[o._key,o]));const x=storedOrder.map(k=>by.get(String(k))).filter(Boolean);if(x.length===opts.length)ordered=x;}
    else if(shuffleAllowed(data,v)){for(let i=ordered.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ordered[i],ordered[j]]=[ordered[j],ordered[i]];}}
    const remap=shuffleAllowed(data,v);
    return ordered.map((o,i)=>({...o,_display:remap?String.fromCharCode(65+i):String(o.label)}));
  }
  function optionByKey(v,key){return (v?.options||[]).find(o=>String(o.label)===String(key))||null}
  function updateErrorPattern(s,key){if(!key)return;s.v135=s.v135||{};s.v135.errorPatterns=s.v135.errorPatterns||{};s.v135.errorPatterns[key]=(s.v135.errorPatterns[key]||0)+1}
  function masteryDelta(v,{correct,confidence='pending',eliminatedCorrect=false}={}){
    const lev=levelOf(v);if(!correct)return lev==='N1'?-16:lev==='N3'?-7:-11;
    if(confidence==='guess')return 1;
    let d=lev==='N1'?8:lev==='N3'?16:12;if(eliminatedCorrect)d=Math.max(2,Math.round(d*.25));return d;
  }
  function applyWrongAdaptive(t,v,{trapType=''}={}){
    const s=readState(),m=metaFor(s,t.id),q=quizFor(s,t.id);m.reviewCount=(m.reviewCount||0)+1;m.lastReviewed=new Date().toISOString();m.errorCount=(m.errorCount||0)+1;m.confidence=0;m.mastery=Math.max(0,masteryOf(m)+masteryDelta(v,{correct:false}));m.nextReview=addDays(1);q.pendingConfidence=false;if(trapType){q.lastDistractorTrap=trapType;updateErrorPattern(s,trapType)}setStudyState(t,'difficult',s);writeState(s);syncBadges(t,s);refreshHub();
  }
  function setPendingCorrect(t){const s=readState(),m=metaFor(s,t.id),q=quizFor(s,t.id);m.lastReviewed=new Date().toISOString();m.nextReview=addDays(2);q.pendingConfidence=true;setStudyState(t,'review',s);writeState(s);syncBadges(t,s);refreshHub()}
  function finalizeCorrectAdaptive(t,v,confidence,{eliminatedCorrect=false}={}){
    const s=readState(),m=metaFor(s,t.id),q=quizFor(s,t.id);m.reviewCount=(m.reviewCount||0)+1;m.lastReviewed=new Date().toISOString();m.mastery=Math.min(100,masteryOf(m)+masteryDelta(v,{correct:true,confidence,eliminatedCorrect}));q.pendingConfidence=false;q.lastConfidence=confidence;
    if(confidence==='guess'||eliminatedCorrect){m.confidence=0;m.nextReview=addDays(confidence==='guess'?2:2);if(confidence==='guess')q.guessed=(q.guessed||0)+1;setStudyState(t,'review',s)}else{m.confidence=2;const d=m.mastery>=88?30:m.mastery>=74?14:m.mastery>=60?7:3;m.nextReview=addDays(d);setStudyState(t,'done',s)}
    writeState(s);syncBadges(t,s);refreshHub();document.dispatchEvent(new CustomEvent('mindmap:quiz-updated',{detail:{topicId:t.id,source:'topic',confidence,mastery:m.mastery}}));
  }
  function qStats(q){const pct=q.attempts?Math.round((q.correct||0)*100/q.attempts):0;return `Tentativas ${q.attempts||0} · Acertos ${q.correct||0} · ${pct}%`}
  function renderQuestion(t,{fresh=false,open=false}={}){
    const body=Q('.topic-body',t);if(!body||Q(':scope > .v134-question',body))return;
    const data=questionData(t);if(!data)return;
    const state=readState(),q=quizFor(state,t.id),m=metaFor(state,t.id),vars=variantsOf(data);
    const latest=[...(q.answerHistory||[])].reverse().find(a=>a&&a.variantId&&a.choice);
    const restored=!fresh&&latest?latest:null;
    const byId=id=>vars.find(x=>String(x.id||x.difficulty||'')===String(id));
    const v=(restored&&byId(restored.variantId))||chooseVariant(data,q,m,state,t);
    if(!v||!Array.isArray(v.options)||!v.options.length)return;
    const view=optionView(data,v,restored?.optionOrder),displayByKey=Object.fromEntries(view.map(o=>[o._key,o._display])),correctKey=String(v.correct),correctDisplay=displayByKey[correctKey]||correctKey;
    const box=document.createElement('details');box.className='v134-question';box.open=!!open;box.dataset.variantId=String(v.id||v.difficulty||'');box.setAttribute('aria-label','Teste-se com questão objetiva');
    box.innerHTML=`<summary class="v134-question-head v134-question-toggle"><span class="v134-question-kicker">🧠 TESTE-SE · QUESTÃO OBJETIVA</span><span class="v134-question-meta"><span class="v134-pill bank">${esc(data.bank||'BANCA')}</span><span class="v134-pill level">${esc(levelOf(v))}</span><span class="v134-pill">${esc(v.type||'QUESTÃO')}</span></span><span class="v134-question-chevron" aria-hidden="true">›</span></summary><div class="v134-question-inner"><div class="v134-question-ref">${esc(v.source||data.source||refOf(t))}</div><p class="v134-question-prompt">${esc(v.prompt||'')}</p>${questionVisualHtml(v)}<div class="v134-options" role="radiogroup" aria-label="Alternativas"></div><div class="v134-question-actions"><button class="v134-confirm" type="button" disabled>Confirmar resposta</button><button class="v134-retry" type="button" hidden>Nova tentativa</button><button class="v134-review" type="button" hidden>Marcar para revisar</button><span class="v134-question-stats">${esc(qStats(q))}</span></div><div class="v134-feedback"></div><div class="v134-calibration">${esc(data.calibration||'Questão inédita baseada no conteúdo do tópico.')}</div></div>`;
    body.insertBefore(box,body.firstChild);
    const opts=Q('.v134-options',box),confirm=Q('.v134-confirm',box),retry=Q('.v134-retry',box),review=Q('.v134-review',box),feedback=Q('.v134-feedback',box),stats=Q('.v134-question-stats',box);let chosen='';const eliminatedEver=new Set(restored?.eliminated||[]);
    view.forEach(o=>{const row=document.createElement('div');row.className='v134-option-row';row.dataset.key=o._key;const cut=document.createElement('button');cut.type='button';cut.className='v134-cut';cut.textContent='✂';cut.setAttribute('aria-label',`Descartar ou restaurar alternativa ${o._display}`);cut.setAttribute('title',`Descartar / restaurar alternativa ${o._display}`);cut.setAttribute('aria-pressed','false');const b=document.createElement('button');b.type='button';b.className='v134-option';b.dataset.choice=o._key;b.dataset.display=o._display;b.setAttribute('role','radio');b.setAttribute('aria-checked','false');b.innerHTML=`<span class="v134-option-letter">${esc(o._display)}</span><span class="v134-option-text">${esc(String(o.text||''))}</span>`;cut.addEventListener('click',()=>{if(confirm.hidden)return;const on=!row.classList.contains('eliminated');row.classList.toggle('eliminated',on);cut.setAttribute('aria-pressed',String(on));if(on)eliminatedEver.add(o._key);if(on&&chosen===o._key){chosen='';b.classList.remove('selected');b.setAttribute('aria-checked','false');confirm.disabled=true}});b.addEventListener('click',()=>{if(confirm.hidden)return;if(row.classList.contains('eliminated')){row.classList.remove('eliminated');cut.setAttribute('aria-pressed','false')}chosen=o._key;QA('.v134-option',opts).forEach(x=>{const on=x===b;x.classList.toggle('selected',on);x.setAttribute('aria-checked',String(on))});confirm.disabled=false});row.append(cut,b);opts.appendChild(row)});
    const detailsHtml=(choice,elims)=>{const selected=optionByKey(v,choice),compare=Q('.study-block--compare',t)?.innerText?.replace(/\s+/g,' ').trim()||'',eliminated=(elims||[]).filter(k=>k!==choice).map(k=>{const o=optionByKey(v,k);if(!o)return'';return `<li><strong>${esc(displayByKey[k]||k)}</strong> — ${esc(o.rationale||'Distrator eliminado.')}</li>`}).filter(Boolean).join('');return `<div class="v158-feedback-detail" hidden><p><strong>Por que sua alternativa falha:</strong> ${esc(selected?.rationale||v.explanation||'Confira a regra do tópico.')}</p><p><strong>Regra decisiva:</strong> ${esc(v.explanation||'Confira o conteúdo do tópico.')}</p>${compare?`<p><strong>Não confunda:</strong> ${esc(compare)}</p>`:''}<p><strong>Fonte:</strong> ${esc(v.source||data.source||refOf(t))}</p>${eliminated?`<p><strong>Alternativas que você eliminou:</strong></p><ul>${eliminated}</ul>`:''}</div>`};
    const addDetailToggle=()=>{const detail=Q('.v158-feedback-detail',feedback);if(!detail)return;const b=document.createElement('button');b.type='button';b.className='v158-understand-error';b.textContent='Entender meu erro';b.addEventListener('click',()=>{detail.hidden=!detail.hidden;b.textContent=detail.hidden?'Entender meu erro':'Ocultar explicação'});feedback.insertBefore(b,detail)};
    const renderErrorKinds=()=>{if(Q('.v158-inline-errors',feedback))return;const w=document.createElement('div');w.className='v158-inline-errors';w.innerHTML=`<span>Qual foi a causa principal?</span>${[['conceito','Conceito'],['numero','Número'],['excecao','Exceção'],['leitura','Leitura'],['confusao','Confusão'],['chute','Chute']].map(([k,l])=>`<button type="button" data-kind="${k}">${l}</button>`).join('')}`;feedback.appendChild(w);QA('button',w).forEach(b=>b.addEventListener('click',()=>{const st=readState(),qm=quizFor(st,t.id),mm=metaFor(st,t.id);qm.lastErrorType=b.dataset.kind;mm.errorTypes=mm.errorTypes||{};mm.errorTypes[b.dataset.kind]=(mm.errorTypes[b.dataset.kind]||0)+1;updateErrorPattern(st,b.dataset.kind);writeState(st);w.remove();document.dispatchEvent(new CustomEvent('mindmap:quiz-updated',{detail:{topicId:t.id,source:'topic',errorType:b.dataset.kind}}))}))};
    const renderConfidenceInline=eliminatedCorrect=>{if(Q('.v158-inline-confidence',feedback))return;const w=document.createElement('div');w.className='v158-inline-confidence';w.innerHTML='<span>Você acertou porque sabia ou foi chute?</span><button type="button" data-kind="know">✓ SABIA</button><button type="button" data-kind="guess">◌ CHUTEI</button>';feedback.appendChild(w);QA('button',w).forEach(b=>b.addEventListener('click',()=>{finalizeCorrectAdaptive(t,v,b.dataset.kind,{eliminatedCorrect});w.remove();toast(b.dataset.kind==='know'?(eliminatedCorrect?'Acerto com insegurança · revisar':'Domínio atualizado'):'Acerto por chute · revisão antecipada')}))};
    const showResult=(answer,source='topic')=>{const choice=String(answer.choice||''),ok=!!answer.correct,displayChoice=answer.displayChoice||displayByKey[choice]||choice;chosen=choice;QA('.v134-option',opts).forEach(b=>{b.disabled=true;const selected=b.dataset.choice===choice;b.classList.toggle('selected',selected);b.setAttribute('aria-checked',String(selected));if(b.dataset.choice===correctKey)b.classList.add('correct');if(selected&&!ok)b.classList.add('wrong');const row=b.closest('.v134-option-row');row?.classList.remove('eliminated');const cut=row&&Q('.v134-cut',row);if(cut){cut.disabled=true;cut.setAttribute('aria-pressed','false')}});confirm.hidden=true;retry.hidden=false;review.hidden=false;feedback.className='v134-feedback open '+(ok?'good':'bad');const from=source==='checkpoint'?' · sincronizado do checkpoint':source==='session'?' · sincronizado da sessão':'';feedback.innerHTML=`<strong>${ok?'✓ Resposta correta.':'✕ Resposta incorreta.'}</strong>${esc(from)} Você marcou <strong>${esc(displayChoice)}</strong>. Gabarito: <strong>${esc(answer.correctDisplay||correctDisplay)}</strong>.${!ok?detailsHtml(choice,answer.eliminated||[]):''}`;if(!ok)addDetailToggle();stats.textContent=qStats(quizFor(readState(),t.id))};
    if(restored)showResult(restored,restored.source||'topic');
    confirm.addEventListener('click',()=>{if(!chosen)return;const ok=chosen===correctKey,displayChoice=displayByKey[chosen]||chosen,eliminated=[...eliminatedEver],eliminatedCorrect=eliminated.includes(correctKey);QA('.v134-option',opts).forEach(b=>{b.disabled=true;if(b.dataset.choice===correctKey){b.classList.add('correct');const row=b.closest('.v134-option-row');row?.classList.remove('eliminated');const cut=row&&Q('.v134-cut',row);if(cut)cut.setAttribute('aria-pressed','false')}if(b.dataset.choice===chosen&&!ok)b.classList.add('wrong')});QA('.v134-cut',opts).forEach(c=>c.disabled=true);confirm.hidden=true;retry.hidden=false;review.hidden=false;feedback.className='v134-feedback open '+(ok?'good':'bad');feedback.innerHTML=`<strong>${ok?'✓ Resposta correta.':'✕ Resposta incorreta.'}</strong> Você marcou <strong>${esc(displayChoice)}</strong>. Gabarito: <strong>${esc(correctDisplay)}</strong>.${!ok?detailsHtml(chosen,eliminated):''}`;
      const st=readState(),qm=quizFor(st,t.id);qm.attempts=(qm.attempts||0)+1;qm.lastChoice=chosen;qm.lastDisplayChoice=displayChoice;qm.lastCorrect=ok;qm.lastLevel=levelOf(v);qm.lastAnswered=new Date().toISOString();qm.lastVariantId=v.id||levelOf(v);qm.lastSource='topic';qm.variantHistory=[...(qm.variantHistory||[]),qm.lastVariantId].filter(Boolean).slice(-16);qm.variantCounts=qm.variantCounts||{};qm.variantCounts[qm.lastVariantId]=(qm.variantCounts[qm.lastVariantId]||0)+1;const selected=optionByKey(v,chosen),trap=String(selected?.trapType||v.trapType||'').trim();if(!ok&&trap)qm.lastDistractorTrap=trap;const answer={at:qm.lastAnswered,source:'topic',variantId:qm.lastVariantId,choice:chosen,displayChoice,correct:ok,correctDisplay,optionOrder:view.map(o=>o._key),eliminated,eliminatedCorrect,trapType:trap};qm.answerHistory=[...(qm.answerHistory||[]),answer].slice(-60);if(ok){qm.correct=(qm.correct||0)+1;qm.streak=(qm.streak||0)+1}else{qm.wrong=(qm.wrong||0)+1;qm.streak=0}writeState(st);if(ok){setPendingCorrect(t);renderConfidenceInline(eliminatedCorrect)}else{applyWrongAdaptive(t,v,{trapType:trap});addDetailToggle();renderErrorKinds()}stats.textContent=qStats(quizFor(readState(),t.id));document.dispatchEvent(new CustomEvent('mindmap:quiz-updated',{detail:{topicId:t.id,source:'topic',correct:ok,variantId:qm.lastVariantId,choice:chosen,eliminatedCorrect}}));toast(ok?'Resposta correta · classifique sua confiança':'Erro registrado para revisão')});
    retry.addEventListener('click',()=>{const wasOpen=box.open;box.remove();renderQuestion(t,{fresh:true,open:wasOpen||true})});review.addEventListener('click',()=>markForReview(t));
  }
  function scheduleFromStateButton(t,kind){const s=readState(),m=metaFor(s,t.id);m.lastReviewed=new Date().toISOString();if(kind)m.reviewCount=(m.reviewCount||0)+1;if(kind==='difficult'){m.confidence=0;m.nextReview=addDays(1)}else if(kind==='review'){m.confidence=1;m.nextReview=addDays(3)}else if(kind==='done'){m.confidence=2;const n=m.reviewCount||1;m.nextReview=addDays(n>=5?60:n>=4?30:n>=3?14:7)}else m.nextReview='';writeState(s);syncBadges(t,s);refreshHub()}
  document.querySelector('main')?.addEventListener('click',e=>{const b=e.target.closest('.state-btn');if(!b)return;const t=b.closest('.topic-card');setTimeout(()=>scheduleFromStateButton(t,t.dataset.studyState||''),0)});
  topics().forEach(renderQuestion);let s0=readState();topics().forEach(t=>syncBadges(t,s0));
  document.addEventListener('mindmap:quiz-updated',e=>{const id=e.detail?.topicId;if(!id)return;const t=document.getElementById(id);if(!t)return;const s=readState();setStudyState(t,s.topicStates[t.id]||'',s);syncBadges(t,s);const body=Q('.topic-body',t),box=body&&Q(':scope > .v134-question',body);const stats=box&&Q('.v134-question-stats',box);if(stats)stats.textContent=qStats(quizFor(s,t.id));if(e.detail?.source!=='topic'&&box&&!box.open){box.remove();renderQuestion(t)}refreshHub()});
  const ctx=Q('.context-side')||Q('.toolbar');const hubBtn=document.createElement('button');hubBtn.type='button';hubBtn.id='v133HubBtn';hubBtn.className='v133-hub-button';hubBtn.innerHTML='☰ <span class="label-long">Mais</span><span class="v133-due-count">0</span>';ctx?.appendChild(hubBtn);
  const overlay=document.createElement('div');overlay.className='v133-hub-overlay';overlay.innerHTML=`<aside class="v133-hub" role="dialog" aria-modal="true" aria-label="Central de estudo"><div class="v133-hub-head"><div><h3>Central de estudo</h3><p>V134 · questões por banca, revisão adaptativa, erros, notas e backup</p></div><button class="v133-hub-close" type="button" aria-label="Fechar">×</button></div><div class="v133-hub-stats"></div><div class="v133-hub-tabs"><button data-tab="today" class="active" type="button">📅 Hoje</button><button data-tab="errors" type="button">✕ Erros</button><button data-tab="notes" type="button">📝 Notas</button></div><div class="v133-hub-list"></div><div class="v133-hub-tools"><button data-tool="export" type="button">Exportar progresso</button><button data-tool="import" type="button">Importar progresso</button><button data-tool="audit" type="button">Auditar material</button><button data-tool="resetview" type="button">Mostrar todos os tópicos</button></div><div class="v133-audit" hidden></div><input class="v133-import" type="file" accept="application/json,.json" hidden></aside>`;document.body.appendChild(overlay);
  const list=Q('.v133-hub-list',overlay),stats=Q('.v133-hub-stats',overlay),auditBox=Q('.v133-audit',overlay),importInput=Q('.v133-import',overlay);let activeTab='today';const openHub=()=>{overlay.classList.add('open');refreshHub()},closeHub=()=>overlay.classList.remove('open');hubBtn.addEventListener('click',openHub);Q('.v133-hub-close',overlay).addEventListener('click',closeHub);overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)closeHub()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open'))closeHub()});QA('[data-tab]',overlay).forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.tab;QA('[data-tab]',overlay).forEach(x=>x.classList.toggle('active',x===b));refreshHub()}));
  function itemButton(t,sub){return `<button class="v133-hub-item" data-topic="${esc(t.id)}" type="button"><strong>${esc(titleOf(t))}</strong><span>${esc(branchOf(t))}${sub?' · '+esc(sub):''}</span></button>`}
  function refreshHub(){const s=readState(),notes=readNotes(),ts=topics();const dueTopics=ts.filter(t=>due(s.reviewMeta[t.id])||s.topicStates[t.id]==='difficult'||s.topicStates[t.id]==='review');const errorTopics=ts.filter(t=>(s.reviewMeta[t.id]?.errorCount||0)>0).sort((a,b)=>(s.reviewMeta[b.id]?.errorCount||0)-(s.reviewMeta[a.id]?.errorCount||0));const noteTopics=ts.filter(t=>(notes[t.id]||'').trim());if(hubBtn.isConnected)Q('.v133-due-count',hubBtn).textContent=String(dueTopics.length);const attempts=Object.values(s.quizMeta||{}).reduce((n,q)=>n+(q.attempts||0),0),correct=Object.values(s.quizMeta||{}).reduce((n,q)=>n+(q.correct||0),0),acc=attempts?Math.round(correct*100/attempts):0;stats.innerHTML=`<div class="v133-stat"><strong>${dueTopics.length}</strong><span>para revisar</span></div><div class="v133-stat"><strong>${errorTopics.reduce((n,t)=>n+(s.reviewMeta[t.id]?.errorCount||0),0)}</strong><span>erros registrados</span></div><div class="v133-stat"><strong>${acc}%</strong><span>acerto em questões</span></div><div class="v133-stat"><strong>${attempts}</strong><span>tentativas</span></div>`;let html='';if(activeTab==='today')html=dueTopics.map(t=>itemButton(t,due(s.reviewMeta[t.id])?'vence hoje':(s.topicStates[t.id]==='difficult'?'difícil':'revisar'))).join('');else if(activeTab==='errors')html=errorTopics.map(t=>itemButton(t,`${s.reviewMeta[t.id]?.errorCount||0} erro(s)`)).join('');else html=noteTopics.map(t=>itemButton(t,(notes[t.id]||'').slice(0,90))).join('');list.innerHTML=html||'<div class="v133-hub-empty">Nada nesta fila por enquanto.</div>';QA('[data-topic]',list).forEach(b=>b.addEventListener('click',()=>{const t=document.getElementById(b.dataset.topic);if(!t)return;closeHub();t.open=true;setTimeout(()=>t.scrollIntoView({behavior:'smooth',block:'start'}),20)}));topics().forEach(t=>syncBadges(t,s))}
  function exportData(){const payload={format:'mindmap-v134-backup',version:API.version,namespace:API.ns,examBoard:document.querySelector('meta[name="study-exam-board"]')?.content||'',exportedAt:new Date().toISOString(),state:readState(),notes:readNotes(),topics:topics().map(t=>({id:t.id,title:titleOf(t),branch:branchOf(t)}))};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(window.sanitizeMindMapFilename?.(`Backup-${API.ns}-${new Date().toISOString().slice(0,10)}.json`)||`backup-${API.ns}.json`);document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast('Backup exportado')}
  async function importData(file){try{const data=JSON.parse(await file.text());if(!data||!data.state||!data.notes)throw new Error('Formato inválido');const current=readState();current.topicStates={...(current.topicStates||{}),...(data.state.topicStates||{})};current.reviewMeta={...(current.reviewMeta||{}),...(data.state.reviewMeta||{})};current.quizMeta={...(current.quizMeta||{}),...(data.state.quizMeta||{})};if(data.state.lastAnchor)current.lastAnchor=data.state.lastAnchor;writeState(current);writeNotes({...readNotes(),...data.notes});location.reload()}catch(err){toast('Não foi possível importar este backup')}}
  function audit(){
    const ts=topics(),ids=ts.map(t=>t.id),dups=ids.filter((x,i)=>ids.indexOf(x)!==i),missing=ts.filter(t=>!t.dataset.topicId||!Q('.topic-summary',t)||!Q('.topic-body',t)||!Q('.topic-name',t)),noRef=ts.filter(t=>!refOf(t)),placeholder=ts.filter(t=>/\[\[|\]\]/.test(t.textContent));
    let qMissing=0,qInvalid=0,qVariants=0,qDuplicatePrompts=0,qDuplicateOptions=0,qMissingRationale=0,qBadCorrect=0,qDuplicateIds=0,qMicrobankShort=0;const keys={};
    const norm=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
    ts.forEach(t=>{const d=questionData(t);if(!d){qMissing++;return}const vs=variantsOf(d);qVariants+=vs.length;const seenP=new Set(),seenId=new Set();if(vs.length<3)qMicrobankShort++;
      const incidence=String(d.incidenceClass||'').toUpperCase();if(incidence.includes('MUITO')&&vs.length<5)qMicrobankShort++;else if(incidence==='RECORRENTE'&&vs.length<4)qMicrobankShort++;
      let invalid=false;vs.forEach(v=>{const id=String(v.id||'');if(id&&seenId.has(id)){qDuplicateIds++;invalid=true}seenId.add(id);const pp=norm(v.prompt);if(pp&&seenP.has(pp)){qDuplicatePrompts++;invalid=true}seenP.add(pp);const os=Array.isArray(v.options)?v.options:[];if(!v.prompt||os.length<2||!v.correct||!v.explanation)invalid=true;const texts=os.map(o=>norm(o.text));if(new Set(texts).size!==texts.length){qDuplicateOptions++;invalid=true}const correctMatches=os.filter(o=>String(o.label)===String(v.correct)).length;if(correctMatches!==1){qBadCorrect++;invalid=true}if(os.some(o=>!String(o.rationale||'').trim())){qMissingRationale++;invalid=true}const k=String(v.correct||'');if(k)keys[k]=(keys[k]||0)+1});if(invalid)qInvalid++});
    const dist=Object.entries(keys).sort().map(([k,v])=>`${k}:${v}`).join(' · ')||'—',totalKey=Object.values(keys).reduce((a,b)=>a+b,0),maxKey=Math.max(0,...Object.values(keys)),skew=totalKey>=10&&maxKey/totalKey>.55;
    const lines=[`Versão: ${API.version}`,`Tópicos: ${ts.length}`,`IDs duplicados: ${new Set(dups).size}`,`Estrutura incompleta: ${missing.length}`,`Sem referência no cabeçalho: ${noRef.length}`,`Sem questão: ${qMissing}`,`Variantes do microbanco: ${qVariants}`,`Microbancos abaixo do mínimo: ${qMicrobankShort}`,`Questões estruturalmente inválidas: ${qInvalid}`,`Prompts duplicados: ${qDuplicatePrompts}`,`IDs de variante duplicados: ${qDuplicateIds}`,`Alternativas textualmente duplicadas: ${qDuplicateOptions}`,`Rationales ausentes: ${qMissingRationale}`,`Gabaritos inválidos: ${qBadCorrect}`,`Distribuição de letras: ${dist}${skew?' · atenção: concentração alta':''}`,`Placeholders restantes: ${placeholder.length}`,dups.length?'Duplicados: '+[...new Set(dups)].join(', '):'Integridade de IDs: OK'];auditBox.hidden=false;auditBox.textContent=lines.join('\n');toast(missing.length||dups.length||qMissing||qInvalid||qMicrobankShort?'Auditoria encontrou pontos para revisar':'Auditoria estrutural e do microbanco concluída')}
  QA('[data-tool]',overlay).forEach(b=>b.addEventListener('click',()=>{if(b.dataset.tool==='export')exportData();if(b.dataset.tool==='import')importInput.click();if(b.dataset.tool==='audit')audit();if(b.dataset.tool==='resetview'){topics().forEach(t=>t.classList.remove('v133-eve-hidden'));QA('.ramo').forEach(r=>r.classList.remove('v133-eve-empty'));document.body.classList.remove('v133-eve-adaptive');toast('Todos os tópicos visíveis')}}));importInput.addEventListener('change',()=>{const f=importInput.files?.[0];if(f)importData(f)});
  const eveBtn=Q('#eveBtn');function applyEve(){if(!document.body.classList.contains('eve-mode')){document.body.classList.remove('v133-eve-adaptive');topics().forEach(t=>t.classList.remove('v133-eve-hidden'));QA('main > .ramo').forEach(r=>r.classList.remove('v133-eve-empty'));return}const s=readState();const scored=topics().map(t=>{const m=s.reviewMeta[t.id]||{},q=s.quizMeta[t.id]||{};const lowAcc=q.attempts?Math.max(0,1-(q.correct||0)/q.attempts):0;let score=markerScore(t)+(m.errorCount||0)*5+Math.round(lowAcc*5)+(s.topicStates[t.id]==='difficult'?7:s.topicStates[t.id]==='review'?4:s.topicStates[t.id]==='done'?-2:0)+(due(m)?5:0);return{t,score}}).sort((a,b)=>b.score-a.score);const keep=Math.max(8,Math.ceil(scored.length*.42)),threshold=scored[Math.min(keep-1,scored.length-1)]?.score??0;scored.forEach((x,i)=>x.t.classList.toggle('v133-eve-hidden',i>=keep&&x.score<threshold+1));QA('main > .ramo').forEach(r=>r.classList.toggle('v133-eve-empty',!Q('.topic-card:not(.v133-eve-hidden)',r)));document.body.classList.add('v133-eve-adaptive')}
  eveBtn?.addEventListener('click',()=>setTimeout(applyEve,0));const mainShell=Q('main > .page-shell');if(mainShell&&!Q('.v133-eve-note',mainShell)){const n=document.createElement('div');n.className='v133-eve-note';n.textContent='Véspera adaptativa: priorizando incidência, pegadinhas, números-chave, DIF/REV, erros, baixa acurácia nas questões e revisões vencidas.';mainShell.appendChild(n)}
  function syncTopicFromSharedState(topicId,{refreshQuestion=false}={}){
    const t=document.getElementById(topicId);if(!t)return;const s=readState(),kind=s.topicStates[t.id]||'';
    t.dataset.studyState=kind;QA('.state-btn',t).forEach(b=>{const on=b.dataset.state===kind;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
    syncBadges(t,s);
    if(refreshQuestion){const old=Q('.v134-question',t),wasOpen=!!old?.open;if(old)old.remove();renderQuestion(t,{fresh:false,open:wasOpen});}
    refreshHub();
  }
  document.addEventListener('mindmap:quiz-updated',e=>{const d=e.detail||{};if(!d.topicId)return;syncTopicFromSharedState(d.topicId,{refreshQuestion:d.source==='checkpoint'||d.source==='session'});});
  document.addEventListener('input',e=>{if(e.target.matches('.personal-note-panel textarea'))setTimeout(refreshHub,220)},{passive:true});let toastTimer=0;function toast(msg){let el=Q('.v133-toast');if(!el){el=document.createElement('div');el.className='v133-toast';document.body.appendChild(el)}el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800)}
  refreshHub();window.MINDMAP_V134=Object.assign(window.MINDMAP_V134||API,{refresh:refreshHub,audit});window.MINDMAP_V133=window.MINDMAP_V134;
})();

/* bloco compartilhado 22 */

(()=>{
  'use strict';
  const API=window.MINDMAP_V134||window.MINDMAP_V133||{}; if(!API.stateKey)return;
  window.MINDMAP_V139={...(window.MINDMAP_V139||window.MINDMAP_V135||{}),...API,version:'V165.0'}; window.MINDMAP_V135=window.MINDMAP_V139;
  const Q=(s,r=document)=>r.querySelector(s), QA=(s,r=document)=>[...r.querySelectorAll(s)];
  const topics=()=>QA('.topic-card');
  const esc=s=>{const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML};
  function questionVisualHtml(v){const raw=v?.media;if(!raw)return'';const items=(Array.isArray(raw)?raw:[raw]).filter(Boolean).slice(0,3);return items.map(m=>{const src=String(m.src||'');if(!/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(src))return'';const alt=esc(m.alt||'Figura técnica utilizada na questão'),parts=[m.caption,m.figure?`Figura ${m.figure}`:'',m.page?`p. ${m.page}`:'',m.sourceLabel||m.sourceRef||''].map(x=>String(x||'').trim()).filter(Boolean),cap=parts.length?`<figcaption><span class=\"v159-question-visual-source\">Fonte:</span> ${esc(parts.join(' · '))}</figcaption>`:'';return `<figure class=\"v159-question-visual\"><img src=\"${src.replace(/\"/g,'')}\" alt=\"${alt}\" loading=\"lazy\" decoding=\"async\">${cap}</figure>`}).join('')}
  const readState=()=>{try{const s=JSON.parse(localStorage.getItem(API.stateKey)||'{}')||{};s.topicStates=s.topicStates||{};s.reviewMeta=s.reviewMeta||{};s.quizMeta=s.quizMeta||{};s.v135=s.v135||{};s.v135.parkedThoughts=s.v135.parkedThoughts||[];s.v135.errorPatterns=s.v135.errorPatterns||{};return s}catch(_){return{topicStates:{},reviewMeta:{},quizMeta:{},v135:{parkedThoughts:[],errorPatterns:{}}}}};
  const writeState=s=>{try{localStorage.setItem(API.stateKey,JSON.stringify(s))}catch(_){}};
  const titleOf=t=>Q('.topic-name',t)?.textContent?.trim()||t.id;
  const branchEl=t=>t.closest('.ramo');
  const branchOf=t=>Q('.ramo-title',branchEl(t))?.textContent?.trim()||'';
  const branchId=t=>branchEl(t)?.dataset.syllabusId||branchEl(t)?.id||'';
  const markers=t=>(t.dataset.markers||'').split(',').map(x=>x.trim()).filter(Boolean);
  const qData=t=>{try{return JSON.parse(Q('.v134-question-data',t)?.textContent||'null')}catch(_){return null}};
  const variantsOf=data=>Array.isArray(data?.variants)?data.variants:(data?.questions&&typeof data.questions==='object'?['N1','N2','N3'].flatMap(k=>Array.isArray(data.questions[k])?data.questions[k]:[]):[]);
  const levelOf=v=>String(v?.difficulty||v?.id||'N2').toUpperCase().match(/N[123]/)?.[0]||'N2';
  const masteryOf=m=>Number.isFinite(+m?.mastery)?Math.max(0,Math.min(100,+m.mastery)):50;
  const listify=v=>Array.isArray(v)?v:String(v||'').split(',').map(x=>x.trim()).filter(Boolean);
  const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'');
  const metaExam=()=>{const v=(Q('meta[name="study-exam-date"]')?.content||'').trim();return validDate(v)?v:''};
  function getCfg(){const s=readState();const c=s.v135||{};return{duration:[10,15,25,40].includes(+c.duration)?+c.duration:15,mixed:c.mixed!==false,examDate:validDate(c.examDate)?c.examDate:metaExam()}}
  function setCfg(patch){const s=readState();s.v135={...(s.v135||{}),...patch};writeState(s);return getCfg()}
  function daysToExam(){const d=getCfg().examDate;if(!d)return null;const end=new Date(d+'T23:59:59');return Math.max(0,Math.ceil((end-Date.now())/86400000))}
  const addDays=n=>{const d=new Date();d.setHours(8,0,0,0);d.setDate(d.getDate()+Math.max(1,n));return d.toISOString()};
  function examAware(base,quality='normal'){const left=daysToExam();let d=Math.max(1,base);if(quality==='guess')d=Math.min(d,2);if(left==null)return d;if(left<=1)return 1;if(left<=3)return Math.min(d,1);if(left<=7)return Math.min(d,2);if(left<=14)return Math.min(d,4);if(left<=30)return Math.min(d,7);if(left<=60)return Math.min(d,14);return Math.min(d,Math.max(7,Math.floor(left/3)))}
  const due=m=>!!m?.nextReview&&new Date(m.nextReview).getTime()<=Date.now();
  function coverage(){const s=readState();const items=syllabusItems();let studied=0,total=0;const rows=items.map(item=>{const ts=topicsForSyllabus(item.id);const done=ts.filter(t=>{const q=s.quizMeta[t.id]||{};return !!s.topicStates[t.id]||(q.attempts||0)>0}).length;studied+=done;total+=ts.length;return{...item,done,total:ts.length,pct:ts.length?Math.round(done*100/ts.length):0}});return{rows,studied,total,pct:total?Math.round(studied*100/total):0}}
  function syllabusItems(){const el=Q('.v135-syllabus-data');if(el){try{const d=JSON.parse(el.textContent);if(Array.isArray(d.items)&&d.items.length)return d.items}catch(_){}}return QA('main > .ramo').map((r,i)=>({id:r.dataset.syllabusId||r.id||`item-${i+1}`,label:Q('.ramo-title',r)?.textContent?.trim()||`Item ${i+1}`}))}
  function topicsForSyllabus(id){return topics().filter(t=>branchId(t)===id)}
  function scoreTopic(t,s){const m=s.reviewMeta[t.id]||{},q=s.quizMeta[t.id]||{},st=s.topicStates[t.id]||'',mastery=masteryOf(m);let x=0;if(due(m))x+=100;if(st==='difficult')x+=80;else if(st==='review')x+=55;if((m.errorCount||0)>0)x+=Math.min(48,(m.errorCount||0)*9);if((q.attempts||0)===0&&!st)x+=30;x+=Math.round((100-mastery)*.42);if(q.lastConfidence==='guess')x+=24;if(q.lastErrorType||q.lastDistractorTrap)x+=10;const mk=markers(t);if(mk.includes('star'))x+=15;if(mk.includes('warn'))x+=10;if(mk.includes('num'))x+=8;if(mk.includes('target'))x+=7;const left=daysToExam();if(left!=null&&left<=30)x+=mk.includes('star')?12:4;if(m.lastReviewed)x+=Math.min(15,Math.floor((Date.now()-new Date(m.lastReviewed).getTime())/86400000/3));return x}
  function category(t,s){const m=s.reviewMeta[t.id]||{},q=s.quizMeta[t.id]||{},st=s.topicStates[t.id]||'';if(due(m)||st==='review'||st==='difficult')return'review';if((m.errorCount||0)>0||(q.wrong||0)>0)return'error';if((q.attempts||0)===0&&!st)return'new';return'practice'}
  function targetCount(min){return min<=10?4:min<=15?6:min<=25?10:16}
  function interleave(list){const pool=[...list],out=[];let last='';while(pool.length){let idx=pool.findIndex(x=>branchId(x)!==last);if(idx<0)idx=0;const [t]=pool.splice(idx,1);out.push(t);last=branchId(t)}return out}
  function checkpointPool(scope=null){const s=readState();const all=(scope?topics().filter(scope):topics()).filter(t=>variantsOf(qData(t)).some(v=>v&&v.prompt&&Array.isArray(v.options)&&v.options.length>=2&&v.correct));const studied=all.filter(t=>{const q=s.quizMeta[t.id]||{};return(q.attempts||0)>0||!!s.topicStates[t.id]});const pool=studied.length?studied:all;return{all,studied,pool,count:Math.min(5,pool.length)}}
  function checkpointSelect(pool,n,s){
    const picked=[],add=t=>{if(t&&!picked.includes(t)&&picked.length<n)picked.push(t)};
    const weak=[...pool].sort((a,b)=>masteryOf(s.reviewMeta[a.id]||{})-masteryOf(s.reviewMeta[b.id]||{})||scoreTopic(b,s)-scoreTopic(a,s));add(weak[0]);add(weak[1]);
    const incidence=[...pool].filter(t=>{const m=markers(t);return m.includes('star')||m.includes('target')||m.includes('warn')}).sort((a,b)=>scoreTopic(b,s)-scoreTopic(a,s));add(incidence.find(t=>!picked.includes(t)));
    const risky=[...pool].filter(t=>{const q=s.quizMeta[t.id]||{};return q.lastConfidence==='guess'||q.lastErrorType||q.lastDistractorTrap}).sort((a,b)=>scoreTopic(b,s)-scoreTopic(a,s));add(risky.find(t=>!picked.includes(t)));
    const consolidation=[...pool].filter(t=>(s.quizMeta[t.id]?.attempts||0)>0).sort((a,b)=>masteryOf(s.reviewMeta[b.id]||{})-masteryOf(s.reviewMeta[a.id]||{}));add(consolidation.find(t=>!picked.includes(t)));
    for(const t of [...pool].sort((a,b)=>scoreTopic(b,s)-scoreTopic(a,s))){if(picked.length>=n)break;add(t)}return picked.slice(0,n)
  }
  function buildPlan(duration=getCfg().duration,{scope=null,checkpoint=false,mixed=getCfg().mixed}={}){const s=readState();const all=(scope?topics().filter(scope):topics()).filter(t=>variantsOf(qData(t)).length);const n=checkpoint?checkpointPool(scope).count:Math.min(targetCount(duration),all.length);if(checkpoint){const cp=checkpointPool(scope),selected=checkpointSelect(cp.pool,n,s);return{queue:mixed?interleave(selected):selected,counts:{review:0,error:0,new:0,practice:selected.length},checkpoint:{eligible:cp.pool.length,studied:cp.studied.length,total:cp.all.length}}}
    const buckets={review:[],error:[],new:[],practice:[]};all.forEach(t=>buckets[category(t,s)].push(t));Object.values(buckets).forEach(a=>a.sort((a,b)=>scoreTopic(b,s)-scoreTopic(a,s)));
    const quotas={review:Math.ceil(n*.45),error:Math.ceil(n*.30),new:Math.max(1,Math.floor(n*.25))};const picked=[];const add=(name,k)=>{while(k-->0&&buckets[name].length){const t=buckets[name].shift();if(!picked.includes(t))picked.push(t)}};add('review',quotas.review);add('error',quotas.error);add('new',quotas.new);const rest=[...buckets.review,...buckets.error,...buckets.new,...buckets.practice].sort((a,b)=>scoreTopic(b,s)-scoreTopic(a,s));for(const t of rest){if(picked.length>=n)break;if(!picked.includes(t))picked.push(t)}const queue=(mixed?interleave(picked):picked).slice(0,n);const counts={review:0,error:0,new:0,practice:0};queue.forEach(t=>counts[category(t,s)]++);return{queue,counts}}
  function planText(duration=getCfg().duration){const p=buildPlan(duration),c=p.counts,bits=[];if(c.review)bits.push(`${c.review} revisão${c.review>1?'ões':''}`);if(c.error)bits.push(`${c.error} erro${c.error>1?'s':''}`);if(c.new)bits.push(`${c.new} novo${c.new>1?'s':''}`);if(c.practice)bits.push(`${c.practice} prática${c.practice>1?'s':''}`);return bits.join(' · ')||'Sessão de manutenção'}
  function launcher(){const host=Q('.hero-copy')||Q('.hero')||document.body;if(Q('#v135Launcher'))return;const cfg=getCfg(),cov=coverage();const box=document.createElement('div');box.id='v135Launcher';box.className='v135-launcher';box.innerHTML=`<div class="v135-start-row"><button class="v135-start-now" type="button">▶ COMEÇAR AGORA <span>· ${cfg.duration} MIN</span></button><div class="v135-duration-row">${[10,15,25,40].map(n=>`<button class="v135-duration ${n===cfg.duration?'active':''}" data-min="${n}" type="button">${n}</button>`).join('')}</div><button class="v135-mixed-toggle ${cfg.mixed?'active':''}" type="button">⇄ Misturar ramos</button></div><div class="v135-launch-summary"><strong>Plano automático:</strong> <span class="v135-plan-text">${esc(planText(cfg.duration))}</span> · cobertura ${cov.pct}%</div><div class="v135-exam-hint ${cfg.examDate?'':'warn'}">${cfg.examDate?`Prova: ${esc(cfg.examDate.split('-').reverse().join('/'))} · ${daysToExam()} dia(s) restantes`:'Defina a data da prova em Mais para adaptar os intervalos de revisão.'}</div>`;host.appendChild(box);Q('.v135-start-now',box).addEventListener('click',()=>startSession(buildPlan(getCfg().duration).queue,{title:'Plano de hoje',duration:getCfg().duration}));QA('.v135-duration',box).forEach(b=>b.addEventListener('click',()=>{const c=setCfg({duration:+b.dataset.min});QA('.v135-duration',box).forEach(x=>x.classList.toggle('active',+x.dataset.min===c.duration));Q('.v135-start-now span',box).textContent=`· ${c.duration} MIN`;Q('.v135-plan-text',box).textContent=planText(c.duration);syncHubExtra()}));Q('.v135-mixed-toggle',box).addEventListener('click',e=>{const c=setCfg({mixed:!getCfg().mixed});e.currentTarget.classList.toggle('active',c.mixed);Q('.v135-plan-text',box).textContent=planText(c.duration);syncHubExtra()})}
  function desiredLevel(q,m){const mastery=masteryOf(m);if(!(q.attempts||0))return'N2';if(q.lastCorrect===false||mastery<35)return'N1';if(q.lastConfidence==='guess'||q.pendingConfidence)return'N2';if(mastery>=72&&(q.streak||0)>=2)return'N3';return'N2'}
  function variantFor(t){const data=qData(t),vars=variantsOf(data);if(!vars.length)return null;const s=readState(),q=s.quizMeta[t.id]||{},m=s.reviewMeta[t.id]||{},desired=desiredLevel(q,m),recent=(q.variantHistory||[]).slice(-3),need=String(q.lastErrorType||q.lastDistractorTrap||'').toLowerCase(),common=Object.entries(s.v135.errorPatterns||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';const rank=v=>{const lev=levelOf(v),id=String(v.id||lev),anti=listify(v.antidoteFor).map(x=>String(x).toLowerCase()),trap=String(v.trapType||'').toLowerCase();let r=lev===desired?0:lev==='N2'?5:9;if(need&&(anti.includes(need)||trap===need))r-=10;else if(common&&(anti.includes(common)||trap===common))r-=2;if(recent.includes(id))r+=recent[recent.length-1]===id?24:9;r+=(q.variantCounts?.[id]||0)*1.4;if(v.interdisciplinary&&lev!=='N3')r+=8;return r};return[...vars].sort((a,b)=>rank(a)-rank(b))[0]||vars[0]}
  function optionRationale(v,choice){const o=(v.options||[]).find(x=>String(x.label)===String(choice));if(o?.rationale)return o.rationale;return v.explanation||'Confira a regra correspondente no tópico.'}
  function shuffleAllowed(data,v){if(v?.shuffle===false)return false;const sig=((data?.format||'')+' '+(v?.examFormat||'')+' '+(v?.type||'')+' '+(v?.prompt||'')).toUpperCase();if(/V\/F|CERTO|ERRADO|ASSOCIA|COLUN|SEQU[ÊE]NCIA|ORDENE|LACUNA/.test(sig))return false;const labs=(v?.options||[]).map(o=>String(o.label||''));return labs.length>=3&&labs.every((x,i)=>x===String.fromCharCode(65+i))}
  function optionView(data,v){const arr=(v?.options||[]).map(o=>({...o,_key:String(o.label)}));if(shuffleAllowed(data,v)){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr.map((o,i)=>({...o,_display:String.fromCharCode(65+i)}))}return arr.map(o=>({...o,_display:String(o.label)}))}
  const masteryDelta=(v,{correct,confidence='pending',eliminatedCorrect=false}={})=>{const lev=levelOf(v);if(!correct)return lev==='N1'?-16:lev==='N3'?-7:-11;if(confidence==='guess')return 1;let d=lev==='N1'?8:lev==='N3'?16:12;if(eliminatedCorrect)d=Math.max(2,Math.round(d*.25));return d};
  function updatePattern(s,k){if(!k)return;s.v135.errorPatterns=s.v135.errorPatterns||{};s.v135.errorPatterns[k]=(s.v135.errorPatterns[k]||0)+1}
  function renderProgressive(t,host){const blocks=QA('.study-topic-flow > .study-block',t);if(!blocks.length)return;const wrap=document.createElement('div');wrap.className='v135-progressive';host.appendChild(wrap);let idx=0;const reveal=()=>{if(idx>=blocks.length)return;const src=blocks[idx++],d=document.createElement('section');d.className='v135-progressive-block';d.innerHTML=src.innerHTML;wrap.appendChild(d);Q('.v135-reveal-next',host)?.remove();if(idx<blocks.length){const b=document.createElement('button');b.type='button';b.className='v135-reveal-next';b.textContent=`Continuar → ${Q('h4',blocks[idx])?.textContent?.replace(/^\d+\s*·\s*/,'')||'próxima etapa'}`;b.addEventListener('click',reveal);wrap.appendChild(b)}};reveal()}
  let session=null,timerId=0;
  function ensureSessionUI(){if(Q('#v135Session'))return Q('#v135Session');const ov=document.createElement('div');ov.id='v135Session';ov.className='v135-session-overlay';ov.innerHTML=`<header class="v135-session-top"><button class="v135-session-exit" type="button">× Sair</button><div class="v135-session-center"><div class="v135-session-progress"></div><div class="v135-session-title"></div></div><div class="v135-session-time"><span class="v135-timer">15:00</span><button class="v135-thought-btn" type="button" title="Estacionar pensamento">💭</button></div></header><main class="v135-session-stage"><div class="v135-session-card"></div></main><div class="v135-thought-pop"><label>💭 ESTACIONAR PENSAMENTO</label><div class="v135-thought-row"><input type="text" maxlength="240" placeholder="Anote e volte ao estudo…"><button type="button">Guardar</button></div></div>`;document.body.appendChild(ov);Q('.v135-session-exit',ov).addEventListener('click',()=>finishSession(true));const pop=Q('.v135-thought-pop',ov),inp=Q('input',pop);Q('.v135-thought-btn',ov).addEventListener('click',()=>{pop.classList.toggle('open');if(pop.classList.contains('open'))setTimeout(()=>inp.focus(),30)});const saveThought=()=>{const text=inp.value.trim();if(!text)return;const s=readState();s.v135.parkedThoughts.push({text,at:new Date().toISOString(),topicId:session?.queue?.[session.index]?.id||''});writeState(s);if(session)session.parked++;inp.value='';pop.classList.remove('open');syncHubExtra()};Q('button',pop).addEventListener('click',saveThought);inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveThought()}});return ov}
  function startTimer(min){clearInterval(timerId);session.deadline=Date.now()+min*60000;const tick=()=>{const left=Math.max(0,session.deadline-Date.now()),sec=Math.ceil(left/1000),m=Math.floor(sec/60),x=sec%60,el=Q('.v135-timer');if(el){el.textContent=left?`${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:'TEMPO ✓';el.classList.toggle('done',!left)}if(!left)clearInterval(timerId)};tick();timerId=setInterval(tick,1000)}
  function startSession(queue,{title='Sessão de foco',duration=getCfg().duration,returnContext=null}={}){if(!queue?.length)return;const ov=ensureSessionUI();session={queue:[...queue],index:0,title,duration,correct:0,wrong:0,guessed:0,insecure:0,parked:0,startedAt:Date.now(),returnContext,errorTypes:{},wrongTopics:[],answers:[]};ov.classList.add('open');document.body.classList.add('v135-session-active');Q('.v135-session-title',ov).textContent=title;startTimer(duration);renderSessionItem()}
  function feedbackDetail(t,v,choice,elims,displayByKey,data){const selected=(v.options||[]).find(o=>String(o.label)===String(choice)),compare=Q('.study-block--compare',t)?.innerText?.replace(/\s+/g,' ').trim()||'',elim=(elims||[]).filter(k=>k!==choice).map(k=>{const o=(v.options||[]).find(x=>String(x.label)===String(k));return o?`<li><strong>${esc(displayByKey[k]||k)}</strong> — ${esc(o.rationale||'Distrator eliminado.')}</li>`:''}).filter(Boolean).join('');return `<div class="v158-feedback-detail" hidden><p><strong>Por que sua alternativa falha:</strong> ${esc(selected?.rationale||v.explanation||'Confira a regra do tópico.')}</p><p><strong>Regra decisiva:</strong> ${esc(v.explanation||'Confira o conteúdo do tópico.')}</p>${compare?`<p><strong>Não confunda:</strong> ${esc(compare)}</p>`:''}<p><strong>Fonte:</strong> ${esc(v.source||data?.source||'Fonte do tópico')}</p>${elim?`<p><strong>Alternativas que você eliminou:</strong></p><ul>${elim}</ul>`:''}</div>`}
  function renderSessionItem(){if(!session)return;const t=session.queue[session.index];if(!t){renderSessionEnd();return}const card=Q('.v135-session-card'),v=variantFor(t),data=qData(t);if(!v){session.index++;renderSessionItem();return}const view=optionView(data,v),displayByKey=Object.fromEntries(view.map(o=>[o._key,o._display])),correctKey=String(v.correct),correctDisplay=displayByKey[correctKey]||correctKey;Q('.v135-session-progress').textContent=`${session.index+1} / ${session.queue.length}`;card.style.setProperty('--topic-accent',getComputedStyle(t).getPropertyValue('--topic')||'#d8c59e');card.innerHTML=`<div class="v135-session-branch">${esc(branchOf(t))}</div><h2 class="v135-session-topic">${esc(titleOf(t))}</h2><section class="v135-session-question"><div class="v135-qhead"><span class="v135-qkicker">🧠 TESTE-SE</span><span class="v135-qmeta"><span class="v135-chip">${esc(data?.bank||'BANCA')}</span><span class="v135-chip">${esc(levelOf(v))}</span></span></div><div class="v135-prompt">${esc(v.prompt||'')}</div>${questionVisualHtml(v)}<div class="v135-options" role="radiogroup"></div><div class="v135-actions"><button class="v135-primary" type="button" disabled>Confirmar resposta</button></div><div class="v135-response"></div></section>`;const opts=Q('.v135-options',card),confirm=Q('.v135-primary',card),response=Q('.v135-response',card);let choice='';const eliminatedEver=new Set();view.forEach(o=>{const row=document.createElement('div');row.className='v135-opt-row';const cut=document.createElement('button');cut.type='button';cut.className='v135-cut';cut.textContent='✂';cut.setAttribute('aria-label',`Descartar ou restaurar alternativa ${o._display}`);cut.setAttribute('title',`Descartar / restaurar alternativa ${o._display}`);cut.setAttribute('aria-pressed','false');const b=document.createElement('button');b.type='button';b.className='v135-opt';b.dataset.choice=o._key;b.dataset.display=o._display;b.innerHTML=`<span class="v135-letter">${esc(o._display)}</span><span class="v135-opt-text">${esc(o.text)}</span>`;cut.addEventListener('click',()=>{if(confirm.hidden)return;const on=!row.classList.contains('eliminated');row.classList.toggle('eliminated',on);cut.setAttribute('aria-pressed',String(on));if(on)eliminatedEver.add(o._key);if(on&&choice===o._key){choice='';b.classList.remove('selected');confirm.disabled=true}});b.addEventListener('click',()=>{if(confirm.hidden)return;if(row.classList.contains('eliminated')){row.classList.remove('eliminated');cut.setAttribute('aria-pressed','false')}choice=o._key;QA('.v135-opt',opts).forEach(x=>x.classList.toggle('selected',x===b));confirm.disabled=false});row.append(cut,b);opts.appendChild(row)});confirm.addEventListener('click',()=>{if(!choice)return;const ok=choice===correctKey,displayChoice=displayByKey[choice]||choice,elims=[...eliminatedEver],eliminatedCorrect=elims.includes(correctKey),selected=(v.options||[]).find(o=>String(o.label)===choice),trap=String(selected?.trapType||v.trapType||'').trim();confirm.hidden=true;QA('.v135-opt',opts).forEach(b=>{b.disabled=true;if(b.dataset.choice===correctKey){b.classList.add('correct');const row=b.closest('.v135-opt-row');row?.classList.remove('eliminated');const cut=row&&Q('.v135-cut',row);if(cut)cut.setAttribute('aria-pressed','false')}if(b.dataset.choice===choice&&!ok)b.classList.add('wrong')});QA('.v135-cut',opts).forEach(c=>c.disabled=true);recordAnswer(t,v,{choice,displayChoice,correctDisplay,ok,elims,eliminatedCorrect,trap,order:view.map(o=>o._key)});response.innerHTML=`<div class="v135-feedback ${ok?'good':'bad'}"><strong>${ok?'✓ Resposta correta.':'✕ Resposta incorreta.'}</strong> Você marcou <strong>${esc(displayChoice)}</strong>. Gabarito: <strong>${esc(correctDisplay)}</strong>.${!ok?feedbackDetail(t,v,choice,elims,displayByKey,data):eliminatedCorrect?'<span class="v158-insecure"> · você havia eliminado a correta</span>':''}</div>`;if(!ok){const detail=Q('.v158-feedback-detail',response);if(detail){const btn=document.createElement('button');btn.type='button';btn.className='v158-understand-error';btn.textContent='Entender meu erro';btn.addEventListener('click',()=>{detail.hidden=!detail.hidden;btn.textContent=detail.hidden?'Entender meu erro':'Ocultar explicação'});detail.parentElement.insertBefore(btn,detail)}renderErrorTaxonomy(t,response);renderProgressive(t,response)}else renderConfidence(t,v,response,{eliminatedCorrect})})}
  function recordAnswer(t,v,a){const s=readState(),q=s.quizMeta[t.id]||(s.quizMeta[t.id]={}),m=s.reviewMeta[t.id]||(s.reviewMeta[t.id]={}),source=(session?.title||'').startsWith('Checkpoint')?'checkpoint':(session?.title||'').startsWith('Correção')?'correction':'session';q.attempts=(q.attempts||0)+1;q.correct=(q.correct||0)+(a.ok?1:0);q.wrong=(q.wrong||0)+(a.ok?0:1);q.streak=a.ok?(q.streak||0)+1:0;q.lastChoice=a.choice;q.lastDisplayChoice=a.displayChoice;q.lastCorrect=a.ok;q.lastLevel=levelOf(v);q.lastAnswered=new Date().toISOString();q.lastVariantId=v.id||levelOf(v);q.lastSource=source;q.variantHistory=[...(q.variantHistory||[]),q.lastVariantId].filter(Boolean).slice(-16);q.variantCounts=q.variantCounts||{};q.variantCounts[q.lastVariantId]=(q.variantCounts[q.lastVariantId]||0)+1;if(!a.ok&&a.trap){q.lastDistractorTrap=a.trap;updatePattern(s,a.trap)}q.answerHistory=[...(q.answerHistory||[]),{at:q.lastAnswered,source,variantId:q.lastVariantId,choice:a.choice,displayChoice:a.displayChoice,correct:a.ok,correctDisplay:a.correctDisplay,optionOrder:a.order,eliminated:a.elims,eliminatedCorrect:a.eliminatedCorrect,trapType:a.trap}].slice(-60);m.lastReviewed=new Date().toISOString();if(!a.ok){m.reviewCount=(m.reviewCount||0)+1;m.errorCount=(m.errorCount||0)+1;m.confidence=0;m.mastery=Math.max(0,masteryOf(m)+masteryDelta(v,{correct:false}));m.nextReview=addDays(examAware(1));s.topicStates[t.id]='difficult';session.wrong++;if(!session.wrongTopics.includes(t.id))session.wrongTopics.push(t.id)}else{q.pendingConfidence=true;m.nextReview=addDays(examAware(2,'guess'));s.topicStates[t.id]='review';session.correct++;if(a.eliminatedCorrect)session.insecure++}session.answers.push({topicId:t.id,correct:a.ok,variantId:q.lastVariantId,trap:a.trap});writeState(s);document.dispatchEvent(new CustomEvent('mindmap:quiz-updated',{detail:{topicId:t.id,source,correct:a.ok,variantId:q.lastVariantId,choice:a.choice,eliminatedCorrect:a.eliminatedCorrect}}))}
  function renderConfidence(t,v,host,{eliminatedCorrect=false}={}){const wrap=document.createElement('div');wrap.className='v135-assessment';wrap.innerHTML=`<span class="v135-assessment-label">Você acertou porque sabia ou foi chute?</span><button class="v135-assess know" type="button">✓ SABIA</button><button class="v135-assess guess" type="button">◌ CHUTEI</button>`;host.appendChild(wrap);const apply=kind=>{const s=readState(),m=s.reviewMeta[t.id]||(s.reviewMeta[t.id]={}),q=s.quizMeta[t.id]||(s.quizMeta[t.id]={});m.reviewCount=(m.reviewCount||0)+1;m.mastery=Math.min(100,masteryOf(m)+masteryDelta(v,{correct:true,confidence:kind,eliminatedCorrect}));q.pendingConfidence=false;q.lastConfidence=kind;if(kind==='guess'||eliminatedCorrect){m.confidence=0;m.nextReview=addDays(examAware(2,'guess'));s.topicStates[t.id]='review';if(kind==='guess'){q.guessed=(q.guessed||0)+1;session.guessed++;renderProgressive(t,host)}}else{m.confidence=2;const base=m.mastery>=88?30:m.mastery>=74?14:m.mastery>=60?7:3;m.nextReview=addDays(examAware(base,'know'));s.topicStates[t.id]='done'}writeState(s);document.dispatchEvent(new CustomEvent('mindmap:quiz-updated',{detail:{topicId:t.id,source:(session?.title||'').startsWith('Checkpoint')?'checkpoint':'session',confidence:kind,mastery:m.mastery}}));wrap.remove();appendNext(host);syncHubExtra();syncCheckpointButtons()};Q('.know',wrap).addEventListener('click',()=>apply('know'));Q('.guess',wrap).addEventListener('click',()=>apply('guess'))}
  function renderErrorTaxonomy(t,host){const wrap=document.createElement('div');wrap.className='v135-error-taxonomy';wrap.innerHTML=`<span class="v135-error-label">Qual foi a causa principal do erro?</span>${[['conceito','Conceito'],['numero','Número'],['excecao','Exceção'],['leitura','Leitura'],['confusao','Confusão'],['chute','Chute']].map(([k,l])=>`<button class="v135-error-kind" data-kind="${k}" type="button">${l}</button>`).join('')}`;host.appendChild(wrap);QA('.v135-error-kind',wrap).forEach(b=>b.addEventListener('click',()=>{const s=readState(),m=s.reviewMeta[t.id]||(s.reviewMeta[t.id]={}),q=s.quizMeta[t.id]||(s.quizMeta[t.id]={});m.errorTypes=m.errorTypes||{};m.errorTypes[b.dataset.kind]=(m.errorTypes[b.dataset.kind]||0)+1;q.lastErrorType=b.dataset.kind;updatePattern(s,b.dataset.kind);session.errorTypes[b.dataset.kind]=(session.errorTypes[b.dataset.kind]||0)+1;writeState(s);wrap.remove();appendNext(host);syncHubExtra()}))}
  function appendNext(host){if(Q('.v135-session-next',host))return;const row=document.createElement('div');row.className='v135-next-row';row.innerHTML=`<button class="v135-session-next" type="button">Próximo →</button>`;host.appendChild(row);Q('button',row).addEventListener('click',()=>{session.index++;renderSessionItem()})}
  function nextReinforcementText(s,ids){const dates=ids.map(id=>s.reviewMeta[id]?.nextReview).filter(Boolean).map(x=>new Date(x)).filter(x=>!isNaN(x));if(!dates.length)return'conforme fila adaptativa';const d=new Date(Math.min(...dates.map(x=>x.getTime()))),today=new Date();d.setHours(0,0,0,0);today.setHours(0,0,0,0);const days=Math.round((d-today)/86400000);return days<=0?'hoje':days===1?'amanhã':`em ${days} dias`}
  function renderSessionEnd(){clearInterval(timerId);const card=Q('.v135-session-card'),s=readState(),recent=s.v135.parkedThoughts.slice(-session.parked),answered=session.correct+session.wrong,pct=answered?Math.round(session.correct*100/answered):0,err=Object.entries(session.errorTypes).sort((a,b)=>b[1]-a[1])[0]?.[0]||'',weak=[...new Set(session.queue.map(t=>t.id))].map(id=>({id,m:masteryOf(s.reviewMeta[id]||{})})).sort((a,b)=>a.m-b.m)[0],weakName=weak?titleOf(document.getElementById(weak.id)):'';Q('.v135-session-progress').textContent='Sessão concluída';const diagnostic=`${session.correct}/${answered} · ${pct}%${session.wrong?` | ${session.wrong} erro${session.wrong>1?'s':''}`:''}${session.guessed?` | ${session.guessed} chute${session.guessed>1?'s':''}`:''}${session.insecure?` | ${session.insecure} acerto${session.insecure>1?'s':''} com insegurança`:''}${err?` | erro principal: ${err}`:''}${weakName?` | ponto mais fraco: ${weakName}`:''} | próximo reforço: ${nextReinforcementText(s,session.wrongTopics.length?session.wrongTopics:session.queue.map(t=>t.id))}`;card.innerHTML=`<section class="v135-end"><h2>Sessão concluída</h2><p>O motor adaptativo atualizou sua fila sem exigir configuração extra.</p><div class="v135-end-grid"><div class="v135-end-stat"><strong>${session.correct}</strong><span>acertos</span></div><div class="v135-end-stat"><strong>${session.wrong}</strong><span>erros</span></div><div class="v135-end-stat"><strong>${session.guessed}</strong><span>acertos por chute</span></div></div><div class="v158-diagnostic"><strong>Diagnóstico:</strong> ${esc(diagnostic)}</div>${recent.length?`<div class="v135-parked-list"><h4>💭 PENSAMENTOS ESTACIONADOS</h4>${recent.map(x=>`<div class="v135-parked-item">${esc(x.text)}</div>`).join('')}</div>`:''}<div class="v135-actions">${session.wrongTopics.length?'<button class="v135-primary v158-correct-now" type="button">Corrigir meus erros agora</button>':''}<button class="v135-primary v135-more10" type="button">Continuar 10 min</button><button class="v135-secondary v135-finish" type="button">Finalizar</button></div></section>`;if(session?.returnContext?.type==='checkpoint')Q('.v135-finish',card).textContent='Voltar ao ramo';const correctionIds=[...session.wrongTopics],ctx=session.returnContext;Q('.v158-correct-now',card)?.addEventListener('click',()=>{const queue=correctionIds.map(id=>document.getElementById(id)).filter(Boolean).sort((a,b)=>masteryOf(readState().reviewMeta[a.id]||{})-masteryOf(readState().reviewMeta[b.id]||{})).slice(0,3);startSession(queue,{title:'Correção de erros',duration:10,returnContext:ctx})});Q('.v135-more10',card).addEventListener('click',()=>startSession(buildPlan(10).queue,{title:'Continuação',duration:10,returnContext:ctx||null}));Q('.v135-finish',card).addEventListener('click',()=>finishSession(false));syncHubExtra()}
  function restoreReturnContext(ctx){if(!ctx)return false;const el=ctx.el,viewportTop=Number(ctx.viewportTop),scrollY=Number(ctx.scrollY);requestAnimationFrame(()=>requestAnimationFrame(()=>{if(el?.isConnected&&Number.isFinite(viewportTop)){const delta=el.getBoundingClientRect().top-viewportTop;if(Math.abs(delta)>1)window.scrollBy({top:delta,left:0,behavior:'auto'});else el.focus?.({preventScroll:true})}else if(Number.isFinite(scrollY))window.scrollTo({top:scrollY,left:0,behavior:'auto'})}));return true}
  function finishSession(early=false){clearInterval(timerId);const ctx=session?.returnContext||null;Q('#v135Session')?.classList.remove('open');Q('.v135-thought-pop')?.classList.remove('open');document.body.classList.remove('v135-session-active');session=null;if(restoreReturnContext(ctx))return;if(!early)window.scrollTo({top:0,behavior:'smooth'})}
  function checkpointLabel(n){return `🎯 Checkpoint do ramo · ${n} ${n===1?'questão':'questões'}`}
  function syncCheckpointButton(r){const b=Q('.v135-checkpoint-btn',r);if(!b)return;const cp=checkpointPool(t=>branchEl(t)===r);b.dataset.count=String(cp.count);b.disabled=cp.count===0;b.textContent=cp.count?checkpointLabel(cp.count):'🎯 Checkpoint do ramo · sem questões';b.title=cp.studied.length?`${cp.studied.length} tópico(s) já estudado(s) com questão disponível`:`${cp.all.length} tópico(s) com questão disponível`}
  function syncCheckpointButtons(){QA('main > .ramo').forEach(syncCheckpointButton)}
  function injectCheckpoints(){QA('main > .ramo').forEach(r=>{if(Q('.v135-checkpoint',r)){syncCheckpointButton(r);return}const wrap=document.createElement('div');wrap.className='v135-checkpoint';const b=document.createElement('button');b.type='button';b.className='v135-checkpoint-btn';b.addEventListener('click',()=>{const plan=buildPlan(15,{scope:t=>branchEl(t)===r,checkpoint:true,mixed:false});if(!plan.queue.length)return;const returnContext={type:'checkpoint',el:b,viewportTop:b.getBoundingClientRect().top,scrollY:window.scrollY};startSession(plan.queue,{title:`Checkpoint · ${Q('.ramo-title',r)?.textContent?.trim()||''}`,duration:15,returnContext})});wrap.appendChild(b);r.appendChild(wrap);syncCheckpointButton(r)})}
  function generalCheckpointReady(){const cp=checkpointPool(),branches=new Set(cp.studied.map(branchId));return cp.studied.length>=3&&branches.size>=2}
  function hubExtra(){const hub=Q('.v133-hub');if(!hub||Q('.v135-hub-extra',hub))return;const box=document.createElement('section');box.className='v135-hub-extra';box.innerHTML=`<h4>V158 · SESSÃO E ESTRATÉGIA</h4><div class="v135-settings-grid"><div class="v135-setting"><label>DATA DA PROVA</label><input class="v135-exam-date" type="date"></div><div class="v135-setting"><label>DURAÇÃO PADRÃO</label><select class="v135-default-duration">${[10,15,25,40].map(n=>`<option value="${n}">${n} minutos</option>`).join('')}</select></div></div><div style="height:8px"></div><div class="v135-plan-preview"></div><div style="height:12px"></div><h4>COBERTURA DO EDITAL</h4><div class="v135-coverage"></div><div style="height:12px"></div><h4>💭 PENSAMENTOS ESTACIONADOS</h4><div class="v135-parked-hub"></div>`;hub.appendChild(box);const exam=Q('.v135-exam-date',box),dur=Q('.v135-default-duration',box);exam.addEventListener('change',()=>{setCfg({examDate:exam.value});syncAll()});dur.addEventListener('change',()=>{setCfg({duration:+dur.value});syncAll()});syncHubExtra()}
  function syncHubExtra(){const box=Q('.v135-hub-extra');if(!box)return;const cfg=getCfg(),exam=Q('.v135-exam-date',box),dur=Q('.v135-default-duration',box);if(document.activeElement!==exam)exam.value=cfg.examDate||'';dur.value=String(cfg.duration);const p=buildPlan(cfg.duration),cov=coverage(),ready=generalCheckpointReady();Q('.v135-plan-preview',box).innerHTML=`<strong>Plano de ${cfg.duration} min:</strong> ${esc(planText(cfg.duration))}${cfg.examDate?` · prova em ${daysToExam()} dia(s)`:''}<br><button class="v135-primary v135-hub-start" type="button" style="margin-top:8px">COMEÇAR AGORA</button><button class="v135-secondary v158-general-checkpoint" type="button" style="margin-top:8px" ${ready?'':'disabled'}>🎯 Checkpoint geral</button>`;Q('.v135-hub-start',box)?.addEventListener('click',()=>{Q('.v133-hub-overlay')?.classList.remove('open');startSession(p.queue,{title:'Plano de hoje',duration:cfg.duration})});Q('.v158-general-checkpoint',box)?.addEventListener('click',()=>{if(!generalCheckpointReady())return;Q('.v133-hub-overlay')?.classList.remove('open');const plan=buildPlan(15,{checkpoint:true,mixed:true});startSession(plan.queue,{title:'Checkpoint Geral',duration:15})});const cv=Q('.v135-coverage',box);cv.innerHTML=`<div class="v135-coverage-overall"><div class="v135-coverage-track"><div class="v135-coverage-fill" style="width:${cov.pct}%"></div></div><strong>${cov.pct}%</strong></div>${cov.rows.map(r=>`<div class="v135-coverage-row"><span>${esc(r.label)}</span><strong>${r.done}/${r.total} · ${r.pct}%</strong></div>`).join('')}`;const parked=readState().v135.parkedThoughts||[];Q('.v135-parked-hub',box).innerHTML=parked.length?parked.slice(-8).reverse().map(x=>`<div class="v135-parked-hub-item">${esc(x.text)}</div>`).join(''):'<div class="v135-parked-hub-item">Nenhum pensamento estacionado.</div>'}
  function syncLauncher(){const box=Q('#v135Launcher');if(!box)return;const cfg=getCfg(),cov=coverage();QA('.v135-duration',box).forEach(x=>x.classList.toggle('active',+x.dataset.min===cfg.duration));Q('.v135-start-now span',box).textContent=`· ${cfg.duration} MIN`;Q('.v135-plan-text',box).textContent=planText(cfg.duration);const hint=Q('.v135-exam-hint',box);hint.classList.toggle('warn',!cfg.examDate);hint.textContent=cfg.examDate?`Prova: ${cfg.examDate.split('-').reverse().join('/')} · ${daysToExam()} dia(s) restantes · cobertura ${cov.pct}%`:`Defina a data da prova em Mais para adaptar os intervalos de revisão. · cobertura ${cov.pct}%`}
  function syncAll(){syncLauncher();syncHubExtra();syncCheckpointButtons()}
  document.addEventListener('mindmap:quiz-updated',()=>{syncCheckpointButtons();syncHubExtra()});
  launcher();injectCheckpoints();hubExtra();syncAll();
  window.MINDMAP_V139=Object.assign(window.MINDMAP_V139,{startSession,buildPlan,coverage,sync:syncAll,syncCheckpointButtons,masteryOf}); window.MINDMAP_V135=window.MINDMAP_V139;
})();

/* bloco compartilhado 23 */

(()=>{
  'use strict';
  const placeholderGlobal=/\[\[[^\]]+\]\]/g;
  const hasPlaceholder=s=>/\[\[[^\]]+\]\]/.test(String(s||''));
  const getMeta=n=>document.querySelector(`meta[name="${n}"]`)?.content?.trim()||'';
  const title=(document.title||'').trim();
  const issues=[];
  const emoji=getMeta('study-title-emoji');
  const code=getMeta('study-short-code');
  const shortTitle=getMeta('study-short-title');
  const version=getMeta('study-file-version');
  const appTitle=document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content?.trim()||'';
  const unresolved=[title,emoji,code,shortTitle,version,appTitle].filter(Boolean).flatMap(x=>x.match(placeholderGlobal)||[]);
  if(unresolved.length) issues.push(`placeholders não substituídos: ${[...new Set(unresolved)].join(', ')}`);
  if(!emoji||hasPlaceholder(emoji)) issues.push('emoji do estudo ausente');
  if(!code||hasPlaceholder(code)) issues.push('sigla do estudo ausente');
  if(!shortTitle||hasPlaceholder(shortTitle)) issues.push('título curto ausente');
  if(!hasPlaceholder(version)&&!/^V\d{2,}$/i.test(version)) issues.push('versão deve seguir VNN');
  if(/Caderno\s+Interativo/i.test(title)) issues.push('remover “Caderno Interativo” do <title> externo');
  if(title.length>82&&!hasPlaceholder(title)) issues.push(`título externo longo (${title.length} caracteres)`);
  if(emoji&&!hasPlaceholder(emoji)){
    if(!title.startsWith(emoji+' ')) issues.push('o <title> deve começar pelo emoji definido');
    else if(title.slice((emoji+' ').length).startsWith(emoji+' ')) issues.push('emoji duplicado no início do <title>');
  }
  if(code&&!hasPlaceholder(code)&&!title.includes(code)) issues.push('sigla não aparece no <title>');
  if(version&&!hasPlaceholder(version)&&!title.endsWith(version)) issues.push('versão não aparece no final do <title>');
  if(appTitle&&!hasPlaceholder(appTitle)){
    if(code&&!appTitle.includes(code)) issues.push('apple-mobile-web-app-title não contém a sigla');
    if(version&&!appTitle.includes(version)) issues.push('apple-mobile-web-app-title não contém a versão');
  }
  const result={ok:issues.length===0,issues,title,emoji,code,shortTitle,version,appTitle};
  window.MINDMAP_V139_IDENTITY_AUDIT=()=>({...result,issues:[...result.issues]});
  document.documentElement.dataset.identityAudit=result.ok?'ok':'review';
  if(!result.ok&&!hasPlaceholder(title)) console.warn('[V141 · auditoria de identidade]',issues);
})();

/* bloco compartilhado 24 */

(()=>{
  'use strict';
  const btn=document.getElementById('closeFileBtn');
  if(!btn)return;
  let busy=false,autoTimer=0;
  const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
  const flushPending=()=>{
    try{
      const active=document.activeElement;
      if(active&&active!==document.body&&typeof active.blur==='function')active.blur();
      window.dispatchEvent(new CustomEvent('mindmap:save-now',{detail:{reason:'exit-guide'}}));
      document.dispatchEvent(new CustomEvent('mindmap:save-now',{detail:{reason:'exit-guide'}}));
      try{localStorage.setItem('mindmap:last-safe-close',String(Date.now()))}catch(_){ }
    }catch(_){ }
  };
  const ensureGuide=()=>{
    let guide=document.getElementById('sitecaseExitGuide');
    if(guide)return guide;
    guide=document.createElement('div');
    guide.id='sitecaseExitGuide';
    guide.className='sitecase-exit-guide';
    guide.setAttribute('role','dialog');
    guide.setAttribute('aria-modal','true');
    guide.setAttribute('aria-label','Como sair do Focus Mode do Sitecase');
    guide.innerHTML=`
      <div class="sitecase-exit-guide-target" aria-hidden="true"></div>
      <div class="sitecase-exit-guide-arrow" aria-hidden="true">↗</div>
      <div class="sitecase-exit-guide-card">
        <button class="sitecase-exit-guide-close" type="button" aria-label="Fechar orientação">×</button>
        <div class="sitecase-exit-guide-title">ⓘ Como sair do Sitecase</div>
        <div class="sitecase-exit-guide-text">No <strong>Focus Mode</strong>, mantenha pressionado o <strong>canto superior direito</strong> por cerca de <strong>1,5 s</strong>. Enquanto esta orientação estiver aberta, o conteúdo ao fundo fica <strong>bloqueado</strong> para evitar toques acidentais; o canto destacado permanece livre para o gesto do Sitecase.</div>
        <div class="sitecase-exit-guide-status">✓ PROGRESSO SALVO</div>
      </div>`;
    document.body.appendChild(guide);
    const close=()=>{
      guide.classList.remove('show');
      document.body.classList.remove('sitecase-exit-guide-open');
      clearTimeout(autoTimer);
      btn.setAttribute('aria-expanded','false');
      try{btn.focus({preventScroll:true})}catch(_){try{btn.focus()}catch(__){}}
    };
    guide.querySelector('.sitecase-exit-guide-close')?.addEventListener('click',close);
    guide.addEventListener('click',e=>{if(e.target===guide)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&guide.classList.contains('show'))close();});
    return guide;
  };
  const showGuide=()=>{
    const guide=ensureGuide();
    guide.classList.add('show');
    document.body.classList.add('sitecase-exit-guide-open');
    btn.setAttribute('aria-expanded','true');
    try{guide.querySelector('.sitecase-exit-guide-close')?.focus({preventScroll:true})}catch(_){ }
    clearTimeout(autoTimer);
    autoTimer=setTimeout(()=>{
      guide.classList.remove('show');
      document.body.classList.remove('sitecase-exit-guide-open');
      btn.setAttribute('aria-expanded','false');
    },9000);
  };
  btn.innerHTML='ⓘ <span class="label-long">Como sair</span>';
  btn.setAttribute('aria-label','Como sair do Sitecase');
  btn.setAttribute('aria-expanded','false');
  btn.addEventListener('click',async()=>{
    if(busy)return;
    busy=true;
    btn.disabled=true;
    btn.classList.add('is-saving');
    flushPending();
    await wait(180);
    try{navigator.vibrate?.(8)}catch(_){ }
    btn.disabled=false;
    btn.classList.remove('is-saving');
    busy=false;
    showGuide();
  });
})();

/* bloco compartilhado 25 */

(()=>{
  'use strict';
  const hard=document.getElementById('hardBtn');
  const more=document.getElementById('v133HubBtn');
  if(!hard||!more)return;

  let raf=0;
  const px=v=>`${Math.max(0,Number(v)||0).toFixed(3).replace(/\.000$/,'')}px`;
  const sync=()=>{
    raf=0;
    // Limpa apenas a geometria inline criada por este runtime para medir o hard sem interferência.
    const cs=getComputedStyle(hard);
    const r=hard.getBoundingClientRect();
    if(!r.width||!r.height)return;

    // A caixa externa do Mais copia literalmente o botão Só difíceis já resolvido pela cascata.
    const pairs={
      'box-sizing':cs.boxSizing,
      'width':px(r.width),
      'min-width':px(r.width),
      'max-width':px(r.width),
      'height':px(r.height),
      'min-height':px(r.height),
      'max-height':px(r.height),
      'padding-top':cs.paddingTop,
      'padding-right':cs.paddingRight,
      'padding-bottom':cs.paddingBottom,
      'padding-left':cs.paddingLeft,
      'border-top-width':cs.borderTopWidth,
      'border-right-width':cs.borderRightWidth,
      'border-bottom-width':cs.borderBottomWidth,
      'border-left-width':cs.borderLeftWidth,
      'border-radius':cs.borderRadius,
      'font-size':cs.fontSize,
      'line-height':cs.lineHeight,
      'flex-basis':px(r.width),
      'flex-grow':'0',
      'flex-shrink':'0',
      'margin-top':cs.marginTop,
      'margin-right':cs.marginRight,
      'margin-bottom':cs.marginBottom,
      'margin-left':cs.marginLeft
    };
    for(const [k,v] of Object.entries(pairs)) more.style.setProperty(k,v,'important');
    more.style.setProperty('display','inline-flex','important');
    more.style.setProperty('align-items','center','important');
    more.style.setProperty('justify-content','center','important');
    more.style.setProperty('transform','none','important');
    more.dataset.peerWidth=r.width.toFixed(2);
    more.dataset.peerHeight=r.height.toFixed(2);
  };
  const schedule=()=>{if(!raf)raf=requestAnimationFrame(sync)};
  schedule();
  addEventListener('resize',schedule,{passive:true});
  addEventListener('orientationchange',schedule,{passive:true});
  visualViewport?.addEventListener('resize',schedule,{passive:true});
  document.fonts?.ready?.then(schedule).catch(()=>{});
  // Toolbar pode mudar entre fluxo/fixed após scroll; uma segunda leitura estabiliza a caixa.
  setTimeout(schedule,80);
  setTimeout(schedule,300);
})();

/* bloco compartilhado 26 */

(()=>{
  'use strict';
  const quick=document.getElementById('sitecaseQuickExitBtn');
  const source=document.getElementById('closeFileBtn');
  if(!quick||!source)return;
  quick.addEventListener('click',()=>{
    if(source.disabled)return;
    try{navigator.vibrate?.(8)}catch(_){ }
    source.click();
  });
})();

/* bloco compartilhado 27 */

(()=>{
'use strict';
const META=n=>(document.querySelector(`meta[name="${n}"]`)?.content||'').trim();
const slug=v=>String(v||'').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const rawId=META('mindmap-storage-id');
const ns=slug(rawId)||'mapa-mental';
const stateKey='mindmap_state::'+ns;
const notesKey='mindmap_notes::'+ns;
const safe=v=>{try{return JSON.parse(v)||{}}catch(_){return{}}};
const topics=()=>[...document.querySelectorAll('.topic-card')];

function selectiveLegacyMigration(){
  const legacy=slug(META('plano-arq-legacy-storage-id'));
  if(!legacy||legacy===ns)return false;
  const marker='planoarq:migrated::'+legacy+'::'+ns;
  if(localStorage.getItem(marker)==='1')return false;
  const ids=new Set(topics().map(t=>t.id).filter(Boolean));
  if(!ids.size)return false;
  const oldState=safe(localStorage.getItem('mindmap_state::'+legacy));
  const cur=safe(localStorage.getItem(stateKey));
  const oldNotes=safe(localStorage.getItem('mindmap_notes::'+legacy));
  const curNotes=safe(localStorage.getItem(notesKey));
  const pick=obj=>Object.fromEntries(Object.entries(obj||{}).filter(([k])=>ids.has(k)));
  const migratedTopic=pick(oldState.topicStates);
  const migratedReview=pick(oldState.reviewMeta);
  const migratedQuiz=pick(oldState.quizMeta);
  const migratedNotes=pick(oldNotes);
  const hasAnything=Object.keys(migratedTopic).length||Object.keys(migratedReview).length||Object.keys(migratedQuiz).length||Object.keys(migratedNotes).length;
  if(hasAnything){
    const next={
      ...cur,
      topicStates:{...migratedTopic,...(cur.topicStates||{})},
      reviewMeta:{...migratedReview,...(cur.reviewMeta||{})},
      quizMeta:{...migratedQuiz,...(cur.quizMeta||{})}
    };
    if(ids.has(oldState.lastAnchor)&&!next.lastAnchor){
      next.lastAnchor=oldState.lastAnchor;
      next.lastLabel=oldState.lastLabel||'';
    }
    if(oldState.v135){
      next.v135={
        duration:oldState.v135.duration,
        mixed:oldState.v135.mixed,
        examDate:oldState.v135.examDate,
        ...(next.v135||{})
      };
    }
    localStorage.setItem(stateKey,JSON.stringify(next));
    localStorage.setItem(notesKey,JSON.stringify({...migratedNotes,...curNotes}));
  }
  localStorage.setItem(marker,'1');
  return !!hasAnything;
}

function build(){
  const s=safe(localStorage.getItem(stateKey));
  const ts=topics();
  const values=Object.values(s.topicStates||{});
  const total=ts.length;
  const done=values.filter(v=>v==='done').length;
  const review=values.filter(v=>v==='review').length;
  const difficult=values.filter(v=>v==='difficult').length;
  const studied=done+review+difficult;
  let attempts=0,correct=0;
  Object.values(s.quizMeta||{}).forEach(q=>{
    attempts+=Number(q?.attempts||0);
    correct+=Number(q?.correct||0);
  });
  let due=0,errorCount=0;
  const now=Date.now();
  Object.values(s.reviewMeta||{}).forEach(m=>{
    if(m?.nextReview){
      const t=Date.parse(m.nextReview);
      if(Number.isFinite(t)&&t<=now)due++;
    }
    errorCount+=Number(m?.errorCount||0);
  });
  return {
    channel:'plano-arq',
    bridgeVersion:'1.3',
    type:'material-state',
    material:{
      id:rawId,
      storageNamespace:ns,
      title:META('study-display-title'),
      shortTitle:META('study-short-title'),
      shortCode:META('study-short-code'),
      emoji:META('study-title-emoji'),
      fileVersion:META('study-file-version'),
      board:META('study-exam-board'),
      contest:META('study-exam-contest'),
      libraryGroup:META('study-library-group')
    },
    progress:{total,done,review,difficult,studied,pending:Math.max(0,total-studied),pct:total?Math.round(studied*100/total):0},
    quiz:{attempts,correct,accuracy:attempts?Math.round(correct*100/attempts):0},
    review:{due,errorCount},
    resume:{anchor:s.lastAnchor||'',label:s.lastLabel||''},
    updatedAt:new Date().toISOString()
  };
}
function bridgeTargetOrigin(){
  if(location.protocol==='file:')return '*';
  if(location.origin&&location.origin!=='null')return location.origin;
  try{const ref=document.referrer?new URL(document.referrer):null;if(ref?.origin&&ref.origin!=='null')return ref.origin}catch(_){}
  return '*';
}
function emit(reason='update'){
  const payload=build();payload.reason=reason;
  if(parent&&parent!==window)parent.postMessage(payload,bridgeTargetOrigin());
}
function boot(){
  const migrated=selectiveLegacyMigration();
  const reloadKey='planoarq:migration-reload::'+ns;
  if(migrated&&sessionStorage.getItem(reloadKey)!=='1'){
    sessionStorage.setItem(reloadKey,'1');
    location.reload();
    return;
  }
  emit('ready');
  addEventListener('message',e=>{
    const d=e.data||{};
    if(d.channel==='plano-arq'&&d.type==='request-state')emit('requested');
    if(d.channel==='plano-arq'&&d.type==='review-grade'){
      document.dispatchEvent(new CustomEvent('plano-arq:review-grade-request',{detail:{topicId:d.topicId||'',grade:d.grade||'',requestId:d.requestId||''}}));
    }
    if(d.channel==='plano-arq'&&d.type==='question-session'){
      const api=window.MINDMAP_V139||window.MINDMAP_V135;
      const ids=Array.isArray(d.topicIds)?d.topicIds.map(String):[];
      const queue=ids.map(id=>document.getElementById(id)).filter(Boolean);
      if(api?.startSession&&queue.length){
        api.startSession(queue,{title:d.title||'Treino de questões',duration:Number(d.duration||15)});
        const payload=build();payload.type='question-session-started';payload.requestId=d.requestId||'';payload.topicIds=ids;
        if(parent&&parent!==window)parent.postMessage(payload,bridgeTargetOrigin());
      }
    }

  });
  document.addEventListener('click',e=>{
    if(e.target.closest('.state-btn'))setTimeout(()=>emit('topic-state'),0);
  },false);
  document.addEventListener('mindmap:quiz-updated',()=>setTimeout(()=>emit('quiz'),0));
  document.addEventListener('mindmap:quiz-updated',e=>{
    const d=e.detail||{},payload=build();
    payload.type='quiz-topic-result';payload.topicId=d.topicId||'';payload.correct=typeof d.correct==='boolean'?d.correct:null;payload.source=d.source||'';payload.variantId=d.variantId||'';payload.choice=d.choice||'';payload.confidence=d.confidence||'';
    if(parent&&parent!==window)parent.postMessage(payload,bridgeTargetOrigin());
  });

  document.addEventListener('plano-arq:review-grade-applied',e=>{
    const d=e.detail||{},payload=build();
    payload.type='review-grade-result';payload.reason='review-grade';payload.topicId=d.topicId||'';payload.grade=d.grade||'';payload.requestId=d.requestId||'';
    if(parent&&parent!==window)parent.postMessage(payload,bridgeTargetOrigin());
  });

  document.addEventListener('mindmap:study-state-changed',()=>emit('mutation'));
  addEventListener('pagehide',()=>emit('pagehide'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

