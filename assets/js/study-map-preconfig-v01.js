/* bloco compartilhado 01 */
(()=>{'use strict';

(function(){
  const clean=t=>(t||'').replace(/\s+/g,' ').trim();
  function textOf(el){
    if(!el) return '';
    const clone=el.cloneNode(true);
    clone.querySelectorAll('b').forEach(b=>b.remove());
    return clean(clone.textContent);
  }
  function buildBranchStudyGuides(){
    const branches=[...document.querySelectorAll('#mindmap > .branch-card')];
    const ramos=[...document.querySelectorAll('main > .ramo')];
    ramos.forEach((ramo,i)=>{
      ramo.querySelector(':scope > .branch-study-guide')?.remove();
      const branch=branches[i]; if(!branch) return;
      const desc=clean(branch.querySelector('.branch-desc')?.textContent);
      const core=textOf(branch.querySelector('.essential--core'));
      const target=textOf(branch.querySelector('.essential--target'));
      const warning=textOf(branch.querySelector('.essential--warning'));
      const memory=textOf(branch.querySelector('.essential--memory'));
      const vals=[core||desc,target,warning,memory];
      if(!vals.some(Boolean)) return;
      const guide=document.createElement('aside');
      guide.className='branch-study-guide';
      guide.setAttribute('aria-label','Roteiro didático deste bloco');
      const labels=['Núcleo do bloco','Foco de prova','Atenção','Memória-chave'];
      const kinds=['core','target','warning','memory'];
      guide.innerHTML='<div class="branch-study-guide-head">Roteiro do bloco</div><div class="branch-study-guide-grid"></div>';
      const grid=guide.querySelector('.branch-study-guide-grid');
      vals.forEach((val,j)=>{if(!val)return;const item=document.createElement('div');item.className='branch-study-guide-item';item.dataset.kind=kinds[j];const b=document.createElement('b');b.textContent=labels[j];const span=document.createElement('span');span.textContent=val;item.append(b,span);grid.appendChild(item)});
      const head=ramo.querySelector(':scope > .ramo-head');
      if(head) head.insertAdjacentElement('afterend',guide);
    });
  }
  window.buildBranchStudyGuides=buildBranchStudyGuides;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',buildBranchStudyGuides,{once:true}); else buildBranchStudyGuides();
})();

const APP=document.body, MAP=document.getElementById('mindmap')||document.querySelector('.mindmap'), SEARCH=document.getElementById('search');if(MAP&&!MAP.id)MAP.id='mindmap';
const COLORS=["#B23A48","#486387","#BA87AE","#CFB291","#59614B","#5B3765","#D77A7D","#1E2840","#9E9B88","#6A040F","#83A2CD","#5A3122"];
const filters=new Set(); let highOnly=false, observerLock=false;

/* V1.1 · barramento único para mudanças de estado OK/REV/DIF.
   Um MutationObserver central substitui observers paralelos em dashboard,
   progresso e bridge. */
(()=>{
  const main=document.querySelector('main');
  if(!main||window.PLANO_ARQ_STUDY_STATE_BUS)return;
  const stats={batches:0,topics:0};
  let frame=0;
  const pending=new Set();
  const flush=()=>{
    frame=0;
    if(!pending.size)return;
    const topicIds=[...pending];
    pending.clear();
    stats.batches++;
    stats.topics+=topicIds.length;
    document.dispatchEvent(new CustomEvent('mindmap:study-state-changed',{detail:{topicIds}}));
  };
  const observer=new MutationObserver(mutations=>{
    for(const m of mutations){
      if(m.type!=='attributes'||m.attributeName!=='data-study-state')continue;
      const topic=m.target?.closest?.('.topic-card')||m.target;
      if(topic?.id)pending.add(topic.id);
    }
    if(pending.size&&!frame)frame=requestAnimationFrame(flush);
  });
  observer.observe(main,{subtree:true,attributes:true,attributeFilter:['data-study-state']});
  window.PLANO_ARQ_STUDY_STATE_BUS={version:'1.1',event:'mindmap:study-state-changed',observer,stats};
})();
const roman=n=>{const m=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];let s='';for(const[v,r]of m){while(n>=v){s+=r;n-=v}}return s||'I'};
const branches=()=>MAP?[...MAP.querySelectorAll(':scope > .branch-card')]:[]; const ramos=()=>[...document.querySelectorAll('main > .ramo')];
const accent=i=>COLORS[i%COLORS.length];
function normalize(){if(!MAP||observerLock)return;observerLock=true;const bs=branches(),rs=ramos(),count=Math.min(bs.length,rs.length);MAP.style.setProperty('--branch-count',count);bs.forEach((b,i)=>{const r=rs[i];if(!r)return;const id='r'+(i+1);r.id=id;b.dataset.target=id;b.style.setProperty('--accent',accent(i));r.style.setProperty('--accent',accent(i));const rr=roman(i+1);b.querySelector('.roman').textContent=rr;r.querySelector('.roman').textContent=rr;const n=r.querySelectorAll('.topic-card').length;b.querySelector('.branch-action').textContent=`Ver ${n} ${n===1?'ponto':'pontos'}`;});requestAnimationFrame(()=>{observerLock=false;window.buildBranchStudyGuides?.()})}
function setReviewState(active){APP.classList.toggle('review-mode',!!active);const btn=document.getElementById('reviewBtn');if(btn){btn.classList.toggle('active',!!active);btn.setAttribute('aria-pressed',String(!!active));}}
function setView(){const detailBtn=document.querySelector('[data-view="detail"]');detailBtn?.classList.add('active');detailBtn?.setAttribute('aria-pressed','true')}
function jump(el){if(!el)return;const dock=document.querySelector('.toolbar-dock');const offset=Math.max((dock?.getBoundingClientRect().height||0)+18,100);const top=Math.max(0,scrollY+el.getBoundingClientRect().top-offset);history.replaceState(null,'','#'+el.id);const root=document.documentElement,prev=root.style.scrollBehavior;root.style.scrollBehavior='auto';window.scrollTo({top,left:0,behavior:'auto'});requestAnimationFrame(()=>{root.style.scrollBehavior=prev});}
MAP?.addEventListener('click',e=>{const b=e.target.closest('.branch-card');if(!b)return;e.preventDefault();jump(ramos()[branches().indexOf(b)])});
document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',setView));
const markerOf=t=>t.dataset.markers?.split(',').filter(Boolean)||[];
function applyFilters(){const q=(SEARCH.value||'').trim().toLocaleLowerCase('pt-BR');let visible=0;document.querySelectorAll('.topic-card').forEach(t=>{const markers=markerOf(t);const text=t.textContent.toLocaleLowerCase('pt-BR');const searchOK=!q||text.includes(q);const filterOK=!filters.size||[...filters].some(f=>markers.includes(f));const highOK=!highOnly||markers.includes('star');const show=searchOK&&filterOK&&highOK;t.classList.toggle('filtered-out',!show);if(show)visible++});ramos().forEach((r,i)=>{const any=[...r.querySelectorAll('.topic-card')].some(t=>!t.classList.contains('filtered-out'));r.classList.toggle('section-empty',!any);branches()[i]?.classList.toggle('filter-empty',!any)});document.getElementById('searchInfo').textContent=`${visible} visíveis`;}
SEARCH.addEventListener('input',applyFilters);
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{const f=b.dataset.filter;if(filters.has(f)){filters.delete(f);b.classList.remove('active');b.setAttribute('aria-pressed','false')}else{filters.add(f);b.classList.add('active');b.setAttribute('aria-pressed','true')}applyFilters()}));
document.getElementById('highBtn').addEventListener('click',e=>{highOnly=!highOnly;e.currentTarget.classList.toggle('active',highOnly);e.currentTarget.setAttribute('aria-pressed',String(highOnly));applyFilters()});
document.getElementById('expandBtn').addEventListener('click',()=>document.querySelectorAll('.topic-card:not(.filtered-out)').forEach(t=>t.open=true));document.getElementById('collapseBtn').addEventListener('click',()=>document.querySelectorAll('.topic-card').forEach(t=>t.open=false));
document.getElementById('reviewBtn').addEventListener('click',()=>{const entering=!APP.classList.contains('review-mode');setView('detail');setReviewState(entering);document.querySelectorAll('.topic-card').forEach(t=>t.open=false);if(entering){requestAnimationFrame(()=>requestAnimationFrame(()=>{const first=[...document.querySelectorAll('main > .ramo .review-box')].find(el=>el.offsetParent!==null);if(first)jump(first.closest('.ramo'));}));}});
document.getElementById('clearBtn').addEventListener('click',()=>{SEARCH.value='';filters.clear();highOnly=false;document.querySelectorAll('[data-filter],#highBtn').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});document.querySelectorAll('.topic-card').forEach(t=>t.open=false);setReviewState(false);APP.classList.remove('search-open');applyFilters()});
document.getElementById('searchToggle').addEventListener('click',()=>{APP.classList.toggle('search-open');if(APP.classList.contains('search-open'))setTimeout(()=>SEARCH.focus(),30)});
document.querySelectorAll('.topic-card').forEach(t=>t.addEventListener('toggle',()=>{const s=t.querySelector('summary');s?.setAttribute('aria-expanded',String(t.open))}));
const topBtn=document.getElementById('topBtn');addEventListener('scroll',()=>{topBtn.style.display=scrollY>650?'block':'none'},{passive:true});topBtn.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
const obs=new MutationObserver(()=>normalize());if(MAP)obs.observe(MAP,{childList:true});const mainRoot=document.querySelector('main');if(mainRoot)obs.observe(mainRoot,{childList:true});
normalize();applyFilters();window.MindMapApp={normalize,setView,focus:i=>{const r=ramos()[Number(i)-1];if(r)jump(r)},clearFocus:()=>{},branchCount:()=>branches().length};
})();

/* bloco compartilhado 02 */

(()=>{
  'use strict';
  const root=document.documentElement, body=document.body, ambient=document.querySelector('.ambient');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const touchLite=matchMedia('(pointer:coarse)');
  const touchDevice=root.classList.contains('touch-performance')||((navigator.maxTouchPoints||0)>0)||touchLite.matches;
  let touchTick=0;
  const targets=[...document.querySelectorAll('main > .ramo, main > .global')];
  let raf=0, lastY=scrollY, lastT=performance.now(), velocity=0, reading=null, idleTimer=0;
  let current={x:20,y:45,x2:82,y2:68,a:.105,b:1};
  let target={...current};

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const rgbFromCss=(value)=>{
    if(!value)return '109,130,152'; value=value.trim();
    if(value.startsWith('#')){let h=value.slice(1);if(h.length===3)h=h.split('').map(x=>x+x).join('');if(h.length>=6){const n=parseInt(h.slice(0,6),16);return `${(n>>16)&255},${(n>>8)&255},${n&255}`}}
    const m=value.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);
    return m?`${Math.round(+m[1])},${Math.round(+m[2])},${Math.round(+m[3])}`:'109,130,152';
  };
  const accentOf=el=>{const cs=getComputedStyle(el);return cs.getPropertyValue(el.classList.contains('global')?'--section-accent':'--accent')||'#6d8298'};
  const findReading=()=>{
    const focusY=innerHeight*.46;let best=null,dist=Infinity;
    for(const el of targets){if(el.offsetParent===null)continue;const r=el.getBoundingClientRect();const center=r.top+Math.min(r.height,innerHeight)*.40;const d=Math.abs(center-focusY);if(d<dist){dist=d;best=el}}
    return best;
  };
  const calculate=()=>{
    const now=performance.now(),dy=scrollY-lastY,dt=Math.max(8,now-lastT);velocity=lerp(velocity,Math.abs(dy)/dt,.32);lastY=scrollY;lastT=now;
    const max=Math.max(1,document.documentElement.scrollHeight-innerHeight),p=clamp(scrollY/max,0,1);
    const next=findReading();
    if(next!==reading){reading?.classList.remove('is-reading');next?.classList.add('is-reading');reading=next}
    body.style.setProperty('--scroll-glow-rgb',rgbFromCss(reading?accentOf(reading):'#6d8298'));
    const wave1=Math.sin(p*Math.PI*2.35), wave2=Math.cos(p*Math.PI*1.72);
    target.x=clamp(14+p*70+wave1*7,10,91);
    target.y=clamp(38+Math.sin(p*Math.PI*3.25)*10,27,67);
    target.x2=clamp(88-p*57+wave2*8,14,92);
    target.y2=clamp(72+Math.cos(p*Math.PI*2.55)*9,48,86);
    const motion=clamp(velocity*1.9,0,.075);
    target.a=reduce.matches?.07:.105+motion;
    target.b=reduce.matches?1:1+clamp(velocity*.65,0,.055);
    body.classList.add('is-scrolling');clearTimeout(idleTimer);idleTimer=setTimeout(()=>{body.classList.remove('is-scrolling');target.a=reduce.matches?.065:.095;target.b=1;animate()},145);
    if(ambient){ambient.style.setProperty('--ambient-shift',`${(-p*34).toFixed(1)}px`);ambient.style.setProperty('--grid-shift-x',`${(wave2*7).toFixed(1)}px`);ambient.style.setProperty('--orb-shift',`${(wave1*18).toFixed(1)}px`)}
  };
  const paint=()=>{
    raf=0;const ease=(reduce.matches||touchDevice)?1:.115;
    current.x=lerp(current.x,target.x,ease);current.y=lerp(current.y,target.y,ease);current.x2=lerp(current.x2,target.x2,ease);current.y2=lerp(current.y2,target.y2,ease);current.a=lerp(current.a,target.a,.16);current.b=lerp(current.b,target.b,.14);
    body.style.setProperty('--light-x',current.x.toFixed(2)+'%');body.style.setProperty('--light-y',current.y.toFixed(2)+'%');body.style.setProperty('--light-2-x',current.x2.toFixed(2)+'%');body.style.setProperty('--light-2-y',current.y2.toFixed(2)+'%');body.style.setProperty('--light-alpha',current.a.toFixed(3));body.style.setProperty('--light-bloom',current.b.toFixed(3));
    if(!touchDevice&&(Math.abs(current.x-target.x)>.08||Math.abs(current.y-target.y)>.08||Math.abs(current.x2-target.x2)>.08||Math.abs(current.y2-target.y2)>.08||Math.abs(current.a-target.a)>.002||Math.abs(current.b-target.b)>.002))raf=requestAnimationFrame(paint);
  };
  const animate=()=>{if(!raf)raf=requestAnimationFrame(paint)};
  const update=()=>{if(touchDevice){const now=performance.now();if(now-touchTick<180)return;touchTick=now;}calculate();animate()};
  addEventListener('scroll',update,{passive:true});addEventListener('resize',update,{passive:true});reduce.addEventListener?.('change',update);update();
})();

/* bloco compartilhado 03 */

(()=>{
  'use strict';
  const VERSION='V134.0';
  const slug=v=>(v||'').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const clean=v=>(v||'').replace(/\s+/g,' ').trim();
  const metaRaw=(document.querySelector('meta[name="mindmap-storage-id"]')?.content||'').trim();
  const isPlaceholder=v=>!v||/\[\[|\]\]|nome\s+do\s+material\s+de\s+estudo/i.test(v);
  const ns=(()=>{
    if(!isPlaceholder(metaRaw)) return slug(metaRaw)||'mapa-mental';
    const hero=clean(document.querySelector('.hero-title,h1')?.textContent);
    const eyebrow=clean(document.querySelector('.eyebrow')?.textContent);
    const semantic=[hero,eyebrow].filter(Boolean).join(' | ');
    if(semantic&&!isPlaceholder(semantic)) return slug(semantic)||'mapa-mental';
    const branch=[...document.querySelectorAll('.ramo-title')].slice(0,3).map(el=>clean(el.textContent)).filter(Boolean).join(' | ');
    if(branch&&!isPlaceholder(branch)) return slug(branch)||'mapa-mental';
    return slug(document.title)||'mapa-mental';
  })();
  const mappings=[];
  const used=new Set();
  [...document.querySelectorAll('main > .ramo')].forEach((ramo,ri)=>{
    const rslug=slug(clean(ramo.querySelector('.ramo-title')?.textContent))||`ramo-${ri+1}`;
    [...ramo.querySelectorAll('.topic-card')].forEach((topic,ti)=>{
      const legacy=topic.getAttribute('data-legacy-id')||`${ramo.id||'r'+(ri+1)}-t${ti+1}`;
      let semantic=(topic.getAttribute('data-topic-id')||'').trim();
      if(isPlaceholder(semantic)) semantic='';
      if(!semantic){
        const name=slug(clean(topic.querySelector('.topic-name')?.textContent))||`topico-${ti+1}`;
        semantic=`topic-${rslug}--${name}`;
      }
      let unique=semantic, n=2;
      while(used.has(unique)) unique=`${semantic}-${n++}`;
      used.add(unique);
      topic.dataset.legacyId=legacy;
      topic.dataset.topicId=unique;
      topic.id=unique;
      mappings.push([legacy,unique]);
    });
  });
  const mergeObject=(a,b)=>Object.assign({},a||{},b||{});
  const migrateKey=(fromKey,toKey,transform)=>{
    if(!fromKey||fromKey===toKey)return;
    try{
      const raw=localStorage.getItem(fromKey); if(!raw)return;
      const incoming=JSON.parse(raw)||{};
      const current=JSON.parse(localStorage.getItem(toKey)||'{}')||{};
      localStorage.setItem(toKey,JSON.stringify(transform?transform(incoming,current):mergeObject(incoming,current)));
    }catch(_){ }
  };
  const stateTransform=(incoming,current)=>{
    const out={...incoming,...current};
    out.topicStates={...(incoming.topicStates||{}),...(current.topicStates||{})};
    out.reviewMeta={...(incoming.reviewMeta||{}),...(current.reviewMeta||{})};
    out.quizMeta={...(incoming.quizMeta||{}),...(current.quizMeta||{})};
    mappings.forEach(([oldId,newId])=>{
      if(out.topicStates[oldId]&&!out.topicStates[newId]) out.topicStates[newId]=out.topicStates[oldId];
      if(out.reviewMeta[oldId]&&!out.reviewMeta[newId]) out.reviewMeta[newId]=out.reviewMeta[oldId];
      delete out.topicStates[oldId]; delete out.reviewMeta[oldId];
      if(out.lastAnchor===oldId)out.lastAnchor=newId;
    });
    return out;
  };
  const notesTransform=(incoming,current)=>{
    const out={...incoming,...current};
    mappings.forEach(([oldId,newId])=>{if(out[oldId]&&!out[newId])out[newId]=out[oldId];delete out[oldId]});
    return out;
  };
  const stateKey='mindmap_state::'+ns, notesKey='mindmap_notes::'+ns;
  try{
    const current=JSON.parse(localStorage.getItem(stateKey)||'{}')||{};
    localStorage.setItem(stateKey,JSON.stringify(stateTransform(current,{})));
    const ncur=JSON.parse(localStorage.getItem(notesKey)||'{}')||{};
    localStorage.setItem(notesKey,JSON.stringify(notesTransform(ncur,{})));
  }catch(_){ }
  const aliases=(document.querySelector('meta[name="mindmap-storage-aliases"]')?.content||'').split(',').map(x=>slug(x)).filter(Boolean);
  aliases.forEach(alias=>{
    migrateKey('mindmap_state::'+alias,stateKey,stateTransform);
    migrateKey('mindmap_notes::'+alias,notesKey,notesTransform);
  });
  window.MINDMAP_V134={version:VERSION,ns,stateKey,notesKey,mappings};
  window.MINDMAP_V133=window.MINDMAP_V134;
})();

/* bloco compartilhado 04 */

(()=>{
  'use strict';
  const body=document.body;
  const main=document.querySelector('main');
  const toolbarDock=document.querySelector('.toolbar-dock');
  const toolbar=document.querySelector('.toolbar');
  const search=document.getElementById('search');
  const searchInfo=document.getElementById('searchInfo');
  const clearBtn=document.getElementById('clearBtn');
  const reviewBtn=document.getElementById('reviewBtn');
  const actionsGroup=document.querySelector('.tool-group.actions');
  const viewButtons=[...document.querySelectorAll('[data-view]')];
  const MAP_STORAGE_NS=(()=>{
    const slug=v=>(v||'').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const metaRaw=(document.querySelector('meta[name="mindmap-storage-id"]')?.content||'').trim();
    const metaIsTemplatePlaceholder=!metaRaw || /\[\[|\]\]|nome\s+do\s+material\s+de\s+estudo/i.test(metaRaw);
    if(!metaIsTemplatePlaceholder) return slug(metaRaw)||'mapa-mental';
    const text=v=>(v||'').replace(/\s+/g,' ').trim();
    const usable=v=>{const t=text(v);return t&&!/\[\[|\]\]/.test(t)?t:''};
    const hero=usable(document.querySelector('.hero-title,h1')?.textContent);
    const eyebrow=usable(document.querySelector('.eyebrow')?.textContent);
    const semanticSeed=[hero,eyebrow].filter(Boolean).join(' | ');
    if(semanticSeed) return slug(semanticSeed)||'mapa-mental';
    const branchSeed=[...document.querySelectorAll('.ramo-title')].slice(0,3).map(el=>usable(el.textContent)).filter(Boolean).join(' | ');
    if(branchSeed) return slug(branchSeed)||'mapa-mental';
    let fileSeed=''; try{fileSeed=decodeURIComponent((location.pathname||'').split('/').pop()||'').replace(/\.[^.]+$/,'').trim()}catch{}
    return slug(fileSeed)||slug(document.title)||'mapa-mental';
  })(); const KEY='mindmap_state::'+MAP_STORAGE_NS;
  const E=(sel,root=document)=>root.querySelector(sel);
  const EE=(sel,root=document)=>[...root.querySelectorAll(sel)];
  const safeJSON=(v,fallback)=>{try{return JSON.parse(v)||fallback}catch{return fallback}};
  const state=safeJSON(localStorage.getItem(KEY),{topicStates:{},lastAnchor:'',lastLabel:'',hardOnly:false});
  let matches=[]; let activeMatch=-1; let searchFrame=0;

  // helper refs
  const ramos=()=>EE('main > .ramo');
  const branches=()=>EE('.mindmap .branch-card');
  const allTopics=()=>EE('.topic-card');

  // contextual bar
  const ctx=document.createElement('div');
  ctx.className='context-bar';
  ctx.innerHTML=`<div class="context-main"><span class="context-chip" id="ctxPrimary">📍 <strong>Início</strong></span><span id="ctxSecondary">Pronto para estudo</span></div><div class="context-side"><span id="studyProgressText">0/0 tópicos</span><button class="meta-mini-btn" id="hardBtn" type="button">⚡ Só difíceis</button></div>`;
  toolbarDock.insertAdjacentElement('afterend',ctx);
  const hardBtn=E('#hardBtn',ctx), progressText=E('#studyProgressText',ctx), ctxPrimary=E('#ctxPrimary',ctx), ctxSecondary=E('#ctxSecondary',ctx);

  const resume=document.createElement('div');
  resume.className='resume-chip';
  resume.innerHTML=`<div class="resume-text"><span class="resume-title">Continuar de onde parei</span><span class="resume-label" id="resumeLabel">Último ponto salvo</span></div><button id="resumeGo" type="button">Abrir</button>`;
  
  const resumeLabel=E('#resumeLabel',resume), resumeGo=E('#resumeGo',resume);

  // enhance toolbar search/nav
  if(search){
    const nav=document.createElement('div');
    nav.className='search-nav';
    nav.innerHTML=`<span class="search-count" id="searchCount">0 ocorrência</span><button type="button" id="searchPrev" aria-label="Resultado anterior">↑</button><button type="button" id="searchNext" aria-label="Próximo resultado">↓</button>`;
    search.parentElement.appendChild(nav);
  }
  const searchCount=E('#searchCount'), searchPrev=E('#searchPrev'), searchNext=E('#searchNext');

  // add véspera button
  const eveBtn=document.createElement('button');
  eveBtn.className='tool-btn'; eveBtn.id='eveBtn'; eveBtn.type='button';
  eveBtn.innerHTML='⏳ <span class="label-long">Véspera</span>';
  clearBtn.parentElement.insertBefore(eveBtn, clearBtn);

  // assign ids and study buttons
  ramos().forEach((ramo,ri)=>{
    const roman=E('.ramo-badge .roman',ramo)?.textContent?.trim()||String(ri+1);
    const ramoTitle=E('.ramo-title',ramo)?.textContent?.trim()||`Ramo ${ri+1}`;
    EE('.topic-card',ramo).forEach((topic,ti)=>{
      if(!topic.id) topic.id=`${ramo.id || 'r'+(ri+1)}-t${ti+1}`;
      topic.dataset.ramoIndex=String(ri+1);
      topic.dataset.topicIndex=String(ti+1);
      topic.dataset.ramoRoman=roman;
      topic.dataset.ramoTitle=ramoTitle;
      const summary=topic.querySelector('.topic-summary');
      if(!summary) return;
      summary.querySelectorAll('.study-state-group').forEach(el=>el.remove());
      const group=document.createElement('div');
      group.className='study-state-group';
      group.innerHTML=`<button class="state-btn" data-state="done" type="button" title="Dominei" aria-pressed="false">OK</button><button class="state-btn" data-state="review" type="button" title="Revisar" aria-pressed="false">REV</button><button class="state-btn" data-state="difficult" type="button" title="Difícil" aria-pressed="false">DIF</button>`;
      const markers=summary.querySelector('.topic-markers');
      if(markers) summary.insertBefore(group, markers); else summary.appendChild(group);
      const current=state.topicStates[topic.id]||'';
      if(current){topic.dataset.studyState=current;const currentBtn=group.querySelector(`[data-state="${current}"]`);currentBtn?.classList.add('active');currentBtn?.setAttribute('aria-pressed','true')}
      group.addEventListener('click',ev=>{
        const btn=ev.target.closest('.state-btn'); if(!btn) return; ev.preventDefault(); ev.stopPropagation();
        const chosen=btn.dataset.state; const same=topic.dataset.studyState===chosen;
        topic.dataset.studyState=same?'':chosen;
        group.querySelectorAll('.state-btn').forEach(b=>{const on=!same && b.dataset.state===chosen;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
        if(same) delete state.topicStates[topic.id]; else state.topicStates[topic.id]=chosen;
        requestAnimationFrame(()=>btn.blur());
        persist(); updateProgress(); applyHardMode();
      });
      topic.addEventListener('toggle',()=>saveLastFrom(topic));
      summary.addEventListener('click',()=>saveLastFrom(topic));
    });
  });

  // focus card enriched for map mode
  branches().forEach((card,idx)=>{
    const ramo=ramos()[idx]; if(!ramo) return;
    const focus=document.createElement('div'); focus.className='focus-panel';
    const essentials=EE('.topic-name',ramo).map(el=>el.textContent.trim()).filter(Boolean).slice(0,3);
    const warnings=EE('.note--warning',ramo).map(el=>el.textContent.replace(/\s+/g,' ').trim().replace(/^⚠️?/,'')).slice(0,1);
    const memos=EE('.review-box li',ramo).map(li=>li.textContent.trim()).filter(Boolean).slice(0,2);
    const numbers=EE('.topic-card[data-markers*="num"] .topic-name',ramo).map(el=>el.textContent.trim()).slice(0,2);
    focus.innerHTML=`<div class="focus-grid">
      <div class="focus-block"><h5>Essencial</h5><ul>${(essentials.length?essentials:['Preencha os tópicos essenciais do ramo.']).map(v=>`<li>${v}</li>`).join('')}</ul></div>
      <div class="focus-block"><h5>Não confunda</h5><ul>${(warnings.length?warnings:['Use este espaço para pegadinhas, diferenças-chave e alertas.']).map(v=>`<li>${v}</li>`).join('')}</ul></div>
      <div class="focus-block"><h5>Âncora mental</h5><ul>${(memos.length?memos:numbers.length?numbers:['Números, prazos ou itens de memorização rápida.']).map(v=>`<li>${v}</li>`).join('')}</ul></div>
      <button class="open-rame" type="button">Abrir ramo completo →</button>
    </div>`;
    focus.querySelector('.open-rame').addEventListener('click',e=>{e.preventDefault(); window.MindMapApp?.setView?.('detail'); setTimeout(()=>jumpTo(ramo),30)});
    card.appendChild(focus);
  });

  function persist(){
    
    try{
      const latest=safeJSON(localStorage.getItem(KEY),{});
      const merged={...latest,...state,
        topicStates:{...(latest.topicStates||{}),...(state.topicStates||{})},
        reviewMeta:{...(latest.reviewMeta||{})},
        quizMeta:{...(latest.quizMeta||{})},
        v135:{...(latest.v135||{})}
      };
      Object.keys(state).forEach(k=>{ if(k!=='reviewMeta'&&k!=='quizMeta'&&k!=='v135'&&k!=='topicStates') merged[k]=state[k]; });
      Object.assign(state,merged);
      localStorage.setItem(KEY,JSON.stringify(merged));
    }catch(_){ localStorage.setItem(KEY,JSON.stringify(state)); }
    updateResumeChip();
  }
  function topicLabel(topic){ const ramo=topic.dataset.ramoRoman||topic.dataset.ramoIndex; const ramoTitle=topic.dataset.ramoTitle||''; const name=topic.querySelector('.topic-name')?.textContent?.trim()||''; return `${ramo} · ${ramoTitle} · ${name}`; }
  function saveLastFrom(topic){ if(!topic) return; const label=topicLabel(topic); if(state.lastAnchor===topic.id&&state.lastLabel===label) return; state.lastAnchor=topic.id; state.lastLabel=label; persist(); }
  function updateResumeChip(){  return; }
  function jumpTo(el){ if(!el) return; const dock=document.querySelector('.toolbar-dock'); const ctxH=ctx.getBoundingClientRect().height||0; const offset=Math.max((dock?.getBoundingClientRect().height||0)+ctxH+18,110); const top=Math.max(0, window.scrollY + el.getBoundingClientRect().top - offset); window.scrollTo({top, behavior:'smooth'}); }
  resumeGo.addEventListener('click',()=>{ const topic=state.lastAnchor ? document.getElementById(state.lastAnchor) : null; if(topic){ window.MindMapApp?.setView?.('detail'); if(topic.tagName.toLowerCase()==='details') topic.open=true; jumpTo(topic); }});

  // progress
  function updateProgress(){
    const topics=allTopics();
    const total=topics.length;
    const done=topics.filter(t=>t.dataset.studyState==='done').length;
    const review=topics.filter(t=>t.dataset.studyState==='review').length;
    const hard=topics.filter(t=>t.dataset.studyState==='difficult').length;
    const touched=done+review+hard;
    progressText.textContent=`${touched}/${total} tópicos marcados · ${hard} difíceis`;
    body.style.setProperty('--study-progress', `${total?Math.round((touched/total)*100):0}%`);
  }

  // hard mode
  function applyHardMode(){ body.classList.toggle('hard-mode', !!state.hardOnly); hardBtn.classList.toggle('active', !!state.hardOnly); hardBtn.setAttribute('aria-pressed', String(!!state.hardOnly)); }
  hardBtn.addEventListener('click',()=>{ state.hardOnly=!state.hardOnly; persist(); applyHardMode(); });

  // eve mode
  function setEve(active){ body.classList.toggle('eve-mode', !!active); eveBtn.classList.toggle('active', !!active); eveBtn.setAttribute('aria-pressed', String(!!active)); if(active){ body.classList.remove('review-mode'); document.querySelector('[data-view="detail"]')?.click(); EE('.topic-card').forEach(t=>t.open=true);} }
  eveBtn.addEventListener('click',()=> setEve(!body.classList.contains('eve-mode')));
  reviewBtn?.addEventListener('click',()=> setEve(false), true);
  clearBtn?.addEventListener('click',()=>{ setEve(false); body.classList.remove('hard-mode'); state.hardOnly=false; clearHighlights(); updateSearchUi(); persist(); }, true);
  viewButtons.forEach(btn=>btn.addEventListener('click',()=>{ if(btn.dataset.view==='map') setEve(false); }));

  // search highlight and nav
  const searchableSelectors=['.topic-name','.topic-code','.topic-body p','.topic-body li','.review-box li','.review-box h4','.ramo-title','.ramo-desc','.branch-title','.branch-desc','.essential'].join(',');
  function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
  function clearHighlights(){
    EE('mark.search-hit').forEach(mark=>{ const parent=mark.parentNode; parent.replaceChild(document.createTextNode(mark.textContent), mark); parent.normalize(); });
    matches=[]; activeMatch=-1;
  }
  function highlightNode(el, term){
    const escaped=escapeRegExp(term),rx=new RegExp(escaped,'gi'),testRx=new RegExp(escaped,'i');
    const walker=document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node){ if(!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT; if(node.parentElement?.closest('mark.search-hit')) return NodeFilter.FILTER_REJECT; return testRx.test(node.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT; }
    });
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const frag=document.createDocumentFragment(); let last=0; const text=node.nodeValue; text.replace(rx,(m,off)=>{ if(off>last) frag.appendChild(document.createTextNode(text.slice(last,off))); const mk=document.createElement('mark'); mk.className='search-hit'; mk.textContent=m; frag.appendChild(mk); last=off+m.length; return m; });
      if(last<text.length) frag.appendChild(document.createTextNode(text.slice(last))); node.parentNode.replaceChild(frag,node);
    });
  }
  function collectMatches(){ matches=EE('mark.search-hit').filter(m=>m.offsetParent!==null); }
  function updateSearchUi(){
    const c=matches.length;
    if(searchCount) searchCount.textContent=`${c} ocorrência${c===1?'':'s'}`;
    if(searchPrev) searchPrev.disabled=c<2;
    if(searchNext) searchNext.disabled=c<2;
    if(searchInfo) searchInfo.textContent=`${c} ocorrências encontradas`;
    matches.forEach((m,i)=>m.classList.toggle('active', i===activeMatch));
  }
  function goToMatch(i){ if(!matches.length) return; activeMatch=(i+matches.length)%matches.length; const mark=matches[activeMatch]; matches.forEach((m,idx)=>m.classList.toggle('active', idx===activeMatch)); const topic=mark.closest('.topic-card'); const details=topic?.tagName?.toLowerCase()==='details'?topic:mark.closest('details.topic-card'); if(details){ details.open=true; saveLastFrom(details); } jumpTo(details||mark.closest('.ramo')||mark); }
  function refreshSearch(){ cancelAnimationFrame(searchFrame); searchFrame=requestAnimationFrame(()=>{
    const term=(search?.value||'').trim(); clearHighlights(); if(!term){ updateSearchUi(); return; }
    EE(searchableSelectors, main).forEach(el=>{ if(el.offsetParent!==null) highlightNode(el,term); });
    collectMatches(); activeMatch=matches.length?0:-1; updateSearchUi(); if(activeMatch===0) matches[0].classList.add('active');
  }); }
  search?.addEventListener('input',()=>setTimeout(refreshSearch,0));
  searchPrev?.addEventListener('click',()=>goToMatch(activeMatch-1));
  searchNext?.addEventListener('click',()=>goToMatch(activeMatch+1));

  // contextual header + saved last position
  function updateToolbarOffset(){ body.style.setProperty('--toolbar-offset', `${toolbarDock.getBoundingClientRect().height||0}px`); }
  function nearestContext(){
    const els=EE('main > .ramo, main > .global, .page-shell');
    const focusY=window.innerHeight*0.28; let best=null, dist=Infinity;
    els.forEach(el=>{ if(el.offsetParent===null) return; const r=el.getBoundingClientRect(); const y=r.top + Math.min(r.height, innerHeight)*0.18; const d=Math.abs(y-focusY); if(d<dist){ dist=d; best=el; } });
    return best;
  }
  function updateContext(){
    updateToolbarOffset();
    const el=nearestContext();
    if(!el) return;
    let primary='📚 Estrutura de estudo', secondary='Visão geral e organização didática do conteúdo';
    if(el.classList.contains('ramo')){
      const roman=E('.ramo-badge .roman',el)?.textContent?.trim()||''; const title=E('.ramo-title',el)?.textContent?.trim()||''; const topics=EE('.topic-card',el); const visible=topics.filter(t=>t.offsetParent!==null); const inView=visible.find(t=>t.getBoundingClientRect().top>=0 && t.getBoundingClientRect().top<innerHeight*.55) || visible[0]; primary=`${roman} · ${title}`; secondary=inView?`Tópico ${inView.dataset.topicIndex||1} de ${topics.length}`:`${topics.length} tópico(s)`; if(inView) saveLastFrom(inView); body.style.setProperty('--ctx-x', `${Math.min(88, Math.max(12, ((el.getBoundingClientRect().left + el.getBoundingClientRect().width/2)/innerWidth)*100))}%`);
    } else if(el.id==='memorizacao-tabela' || /memorização/i.test(el.textContent.slice(0,80))){ primary='🧠 Tabela Mestre de Memorização'; secondary='Números, prazos, fórmulas e diferenças-chave'; }
    else if(el.id==='arquitetura'){ primary='📐 Foco do Cargo'; secondary='Aplicação técnica e leitura prática'; }
    else if(el.id==='revisao-final'){ primary='🎯 Revisão Final'; secondary='Síntese de véspera'; }
    else if(el.id==='fontes'){ primary='📚 Fontes'; secondary='Bases legais e materiais utilizados'; }
    else if(el.classList.contains('page-shell')){ primary='📚 Estrutura de estudo'; secondary='Visão geral e organização didática do conteúdo'; }
    ctxPrimary.innerHTML=`<span>📍</span> <strong>${primary}</strong>`; ctxSecondary.textContent=secondary;
  }
  const contextTouch=matchMedia('(pointer:coarse)'); let contextFrame=0,contextLast=0;
  const scheduleContext=()=>{if(contextFrame)return;contextFrame=requestAnimationFrame(()=>{contextFrame=0;const now=performance.now();if(contextTouch.matches&&now-contextLast<90)return;contextLast=now;updateContext();});};
  window.addEventListener('resize', scheduleContext, {passive:true});
  window.addEventListener('scroll', scheduleContext, {passive:true});

  // if search filter script changes DOM class, keep search results synced
  let uiObserverRaf=0;const mo=new MutationObserver((mut)=>{ if(mut.some(m=>m.type==='childList' || (m.type==='attributes' && (m.attributeName==='class' || m.attributeName==='open')))){ if(!uiObserverRaf)uiObserverRaf=requestAnimationFrame(()=>{uiObserverRaf=0;updateProgress();updateContext();}); }});
  mo.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class','open']});

  // init
  updateResumeChip(); updateProgress(); applyHardMode(); updateToolbarOffset(); updateContext(); refreshSearch();
})();

/* bloco compartilhado 05 */

(()=>{
  'use strict';
  const body=document.body;
  const dock=document.querySelector('.toolbar-dock');
  const toolbar=document.querySelector('.toolbar');
  const actions=document.querySelector('.tool-group.actions');
  if(!dock||!toolbar||!actions) return;
  const mq=matchMedia('(pointer:coarse) and (max-width:1400px)');

  // Botão Mais + painel de comandos secundários.
  let moreBtn=document.querySelector('.touch-more-btn');
  if(!moreBtn){
    moreBtn=document.createElement('button');
    moreBtn.type='button';
    moreBtn.className='tool-btn touch-more-btn';
    moreBtn.setAttribute('aria-label','Mais ferramentas');
    moreBtn.setAttribute('aria-expanded','false');
    moreBtn.innerHTML='🧰 <span class="label-long">Mais</span>';
    actions.appendChild(moreBtn);
  }
  let panel=document.querySelector('.touch-more-panel');
  if(!panel){
    panel=document.createElement('div');
    panel.className='touch-more-panel';
    panel.innerHTML=`
      <div class="touch-more-head"><span class="touch-more-title">Ferramentas</span><span class="touch-more-status" id="touchMoreStatus">0/0 tópicos</span></div>
      <div class="touch-more-grid">
        <button class="touch-more-action" data-proxy="highBtn" type="button">⭐ Alta incidência</button>
        <button class="touch-more-action" data-proxy="hardBtn" type="button">⚡ Só difíceis</button>
        <button class="touch-more-action" data-proxy="expandBtn" type="button">📖 Expandir tudo</button>
        <button class="touch-more-action" data-proxy="collapseBtn" type="button">📕 Recolher tudo</button>
        <button class="touch-more-action" data-proxy="clearBtn" type="button">🧹 Limpar filtros</button>
        <button class="touch-more-action" data-proxy="closeFileBtn" type="button">ⓘ Como sair</button>
      </div>`;
    dock.appendChild(panel);
  }
  const status=panel.querySelector('#touchMoreStatus');
  const setMore=(open)=>{
    const on=!!open;
    if(on){
      body.classList.remove('branch-index-open');
      document.querySelector('.branch-index-toggle')?.setAttribute('aria-expanded','false');
    }
    body.classList.toggle('touch-more-open',on);
    moreBtn.setAttribute('aria-expanded',String(on));
  };
  moreBtn.addEventListener('click',e=>{e.stopPropagation();setMore(!body.classList.contains('touch-more-open'))});
  panel.addEventListener('click',e=>{
    const btn=e.target.closest('.touch-more-action'); if(!btn) return;
    const target=document.getElementById(btn.dataset.proxy);
    target?.click();
    syncPanel();
    if(btn.dataset.proxy==='clearBtn'||btn.dataset.proxy==='expandBtn'||btn.dataset.proxy==='collapseBtn'||btn.dataset.proxy==='closeFileBtn') setMore(false);
  });
  document.addEventListener('click',e=>{if(body.classList.contains('touch-more-open')&&!panel.contains(e.target)&&e.target!==moreBtn)setMore(false)});

  function syncPanel(){
    const progress=document.getElementById('studyProgressText');
    if(status) status.textContent=(progress?.textContent||'').replace(' tópicos marcados · ',' · ');
    panel.querySelectorAll('[data-proxy]').forEach(p=>{
      const t=document.getElementById(p.dataset.proxy);
      p.classList.toggle('active',!!(t?.classList.contains('active')||t?.getAttribute('aria-pressed')==='true'));
    });
  }

  // Estado de leitura: reduz elementos flutuantes em iPad e smartphone.
  let raf=0;
  const update=()=>{
    raf=0;
    if(!mq.matches){body.classList.remove('touch-reading','touch-more-open','branch-index-open');return}
    const reading=scrollY>140; if(body.classList.contains('touch-reading')!==reading) body.classList.toggle('touch-reading',reading);
  };
  addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(update)},{passive:true});
  addEventListener('resize',update,{passive:true});
  mq.addEventListener?.('change',update);

  // Fecha o menu quando muda de modo e mantém busca independente.
  document.querySelectorAll('[data-view],#reviewBtn,#eveBtn').forEach(b=>b?.addEventListener('click',()=>setMore(false)));
  ['highBtn','hardBtn','expandBtn','collapseBtn','clearBtn','reviewBtn','eveBtn'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>setTimeout(syncPanel,0)));
  document.addEventListener('mindmap:study-state-changed',()=>requestAnimationFrame(syncPanel));
  update();syncPanel();
})();

/* bloco compartilhado 06 */

(()=>{
  'use strict';
  const body=document.body;
  const main=document.querySelector('main');
  const dock=document.querySelector('.toolbar-dock');
  const map=document.getElementById('mindmap')||document.querySelector('.mindmap');
  if(!main||!map) return; if(!map.id)map.id='mindmap';
  const Q=(s,r=document)=>r.querySelector(s), QA=(s,r=document)=>[...r.querySelectorAll(s)];
  const touch=matchMedia('(pointer:coarse) and (max-width:1400px)');
  const MAP_STORAGE_NS=(()=>{
    const slug=v=>(v||'').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const metaRaw=(document.querySelector('meta[name="mindmap-storage-id"]')?.content||'').trim();
    const metaIsTemplatePlaceholder=!metaRaw || /\[\[|\]\]|nome\s+do\s+material\s+de\s+estudo/i.test(metaRaw);
    if(!metaIsTemplatePlaceholder) return slug(metaRaw)||'mapa-mental';
    const text=v=>(v||'').replace(/\s+/g,' ').trim();
    const usable=v=>{const t=text(v);return t&&!/\[\[|\]\]/.test(t)?t:''};
    const hero=usable(document.querySelector('.hero-title,h1')?.textContent);
    const eyebrow=usable(document.querySelector('.eyebrow')?.textContent);
    const semanticSeed=[hero,eyebrow].filter(Boolean).join(' | ');
    if(semanticSeed) return slug(semanticSeed)||'mapa-mental';
    const branchSeed=[...document.querySelectorAll('.ramo-title')].slice(0,3).map(el=>usable(el.textContent)).filter(Boolean).join(' | ');
    if(branchSeed) return slug(branchSeed)||'mapa-mental';
    let fileSeed=''; try{fileSeed=decodeURIComponent((location.pathname||'').split('/').pop()||'').replace(/\.[^.]+$/,'').trim()}catch{}
    return slug(fileSeed)||slug(document.title)||'mapa-mental';
  })(); const NOTES_KEY='mindmap_notes::'+MAP_STORAGE_NS;
  let notes={}; try{notes=JSON.parse(localStorage.getItem(NOTES_KEY)||'{}')||{}}catch{}
  const saveNotes=()=>{try{localStorage.setItem(NOTES_KEY,JSON.stringify(notes))}catch{}};
  const ramos=()=>QA('main > .ramo'); const branches=()=>QA('.mindmap .branch-card');

  /* ---------------- Toolbar touch sempre visível ---------------- */
  body.classList.remove('smart-toolbar-hidden');

  /* ---------------- Índice lateral ---------------- */
  const indexToggle=document.createElement('button');
  indexToggle.className='branch-index-toggle'; indexToggle.type='button'; indexToggle.setAttribute('aria-label','Abrir índice de ramos'); indexToggle.textContent='Ⅰ–Ⅻ';
  const index=document.createElement('aside'); index.className='branch-index'; index.setAttribute('aria-label','Índice de ramos');
  index.innerHTML='<div class="branch-index-head"><strong>Índice de ramos</strong><button class="branch-index-close" type="button" aria-label="Fechar índice">×</button></div><div class="branch-index-list"></div>';
  
  indexToggle.hidden=true; index.hidden=true;
  const indexList=Q('.branch-index-list',index);
  indexToggle.setAttribute('aria-expanded','false');
  const setIndex=open=>{
    const on=!!open;
    if(on){
      body.classList.remove('touch-more-open');
      document.querySelector('.touch-more-btn')?.setAttribute('aria-expanded','false');
    }
    body.classList.toggle('branch-index-open',on);
    indexToggle.setAttribute('aria-expanded',String(on));
    body.classList.remove('smart-toolbar-hidden');
  };
  indexToggle.addEventListener('click',()=>setIndex(!body.classList.contains('branch-index-open')));
  Q('.branch-index-close',index).addEventListener('click',()=>setIndex(false));
  document.addEventListener('pointerdown',e=>{if(body.classList.contains('branch-index-open')&&!index.contains(e.target)&&e.target!==indexToggle)setIndex(false)},{passive:true});

  const accentOf=(el)=>getComputedStyle(el).getPropertyValue('--accent').trim()||'#c3aa84';
  function buildIndex(){
    indexList.innerHTML='';
    const rs=ramos();
    const firstRoman=Q('.ramo-badge .roman',rs[0])?.textContent?.trim()||'I';
    const lastRoman=Q('.ramo-badge .roman',rs[rs.length-1])?.textContent?.trim()||String(rs.length||1);
    indexToggle.textContent=rs.length>1?`${firstRoman}–${lastRoman}`:firstRoman;
    indexToggle.setAttribute('aria-label',`Abrir índice de ${rs.length} ramo${rs.length===1?'':'s'}`);
    rs.forEach((r,i)=>{
      const roman=Q('.ramo-badge .roman',r)?.textContent?.trim()||String(i+1);
      const title=Q('.ramo-title',r)?.textContent?.trim()||`Ramo ${i+1}`;
      const b=document.createElement('button'); b.type='button'; b.className='branch-index-item'; b.dataset.target=r.id; b.style.setProperty('--idx-accent',accentOf(r));
      b.innerHTML=`<span class="branch-index-roman">${roman}</span><span class="branch-index-name">${title}</span><span class="branch-index-pct">0%</span>`;
      b.addEventListener('click',()=>{window.MindMapApp?.setView?.('detail');setTimeout(()=>{jumpTo(r);setIndex(false)},20)});
      indexList.appendChild(b);
    });
  }
  function jumpTo(el){if(!el)return;const dh=dock?.getBoundingClientRect().height||0;const top=Math.max(0,scrollY+el.getBoundingClientRect().top-dh-18);scrollTo({top,behavior:'smooth'})}

  /* ---------------- Progress + indicators ---------------- */
  function statsFor(r){
    const topics=QA('.topic-card',r), total=topics.length;
    const done=topics.filter(t=>t.dataset.studyState==='done').length;
    const reviewed=topics.filter(t=>t.dataset.studyState==='review').length;
    const difficult=topics.filter(t=>t.dataset.studyState==='difficult').length;
    const marked=done+reviewed+difficult;
    const pct=total?Math.round(marked/total*100):0;
    const markerCount=k=>topics.filter(t=>(t.dataset.markers||'').split(',').includes(k)).length;
    return {topics,total,done,reviewed,difficult,marked,pct,
      star:markerCount('star'),warn:markerCount('warn'),decore:markerCount('decore'),imp:markerCount('imp'),
      update:markerCount('update'),target:markerCount('target'),arch:markerCount('arch'),num:markerCount('num')
    };
  }
  function ensureProgress(){
    ramos().forEach((r,i)=>{
      const card=branches()[i]; if(!card)return;
      if(!Q('.branch-progress',card)){
        const p=document.createElement('div');p.className='branch-progress';p.innerHTML='<div class="branch-progress-row"><span class="branch-progress-label">0/0 estudados</span><span class="branch-progress-pct">0%</span></div><div class="branch-progress-track"><div class="branch-progress-fill"></div></div>';card.appendChild(p);
      }
      QA('.branch-signals',card).forEach(el=>el.remove());
      if(!Q('.branch-content-indicators',card)){
        const ind=document.createElement('div');ind.className='branch-content-indicators';
        const desc=Q('.branch-desc',card), action=Q('.branch-action',card); (desc||action)?.insertAdjacentElement('afterend',ind);
      }
      if(!Q('.ramo-progress',r)){
        const headText=Q('.ramo-head>div:last-child',r); if(headText){const rp=document.createElement('div');rp.className='ramo-progress';rp.innerHTML='<div class="ramo-progress-track"><div class="ramo-progress-fill"></div></div><span class="ramo-progress-label">0/0</span>';headText.appendChild(rp)}
      }
      if(!Q('.adaptive-review-badge',r)){
        const headText=Q('.ramo-head>div:last-child',r); if(headText){const ab=document.createElement('span');ab.className='adaptive-review-badge';headText.appendChild(ab)}
      }
    });
  }
  function updateProgress(){
    const setText=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value};
    const setHtml=(el,value)=>{if(el&&el.innerHTML!==value)el.innerHTML=value};
    ramos().forEach((r,i)=>{
      const s=statsFor(r), card=branches()[i];
      if(card){
        card.style.setProperty('--branch-progress',`${s.pct}%`);
        const lab=Q('.branch-progress-label',card),pc=Q('.branch-progress-pct',card);
        setText(lab,`${s.marked}/${s.total} marcados`);setText(pc,`${s.pct}%`);
        const ind=Q('.branch-content-indicators',card);
        if(ind){const chips=[];
          if(s.star)chips.push(`<span class="content-indicator" data-kind="star" aria-label="Alta incidência: ${s.star}"><span class="indicator-emoji" aria-hidden="true">⭐</span><span class="indicator-count">${s.star}</span></span>`);
          if(s.warn)chips.push(`<span class="content-indicator" data-kind="warn" aria-label="Pegadinha: ${s.warn}"><span class="indicator-emoji" aria-hidden="true">⚠️</span><span class="indicator-count">${s.warn}</span></span>`);
          if(s.decore)chips.push(`<span class="content-indicator" data-kind="decore" aria-label="Fixação: ${s.decore}"><span class="indicator-emoji" aria-hidden="true">🧠</span><span class="indicator-count">${s.decore}</span></span>`);
          if(s.imp)chips.push(`<span class="content-indicator" data-kind="imp" aria-label="Importante: ${s.imp}"><span class="indicator-emoji" aria-hidden="true">📌</span><span class="indicator-count">${s.imp}</span></span>`);
          if(s.update)chips.push(`<span class="content-indicator" data-kind="update" aria-label="Atualização: ${s.update}"><span class="indicator-emoji" aria-hidden="true">🆕</span><span class="indicator-count">${s.update}</span></span>`);
          if(s.target)chips.push(`<span class="content-indicator" data-kind="target" aria-label="Revisão: ${s.target}"><span class="indicator-emoji" aria-hidden="true">🎯</span><span class="indicator-count">${s.target}</span></span>`);
          if(s.arch)chips.push(`<span class="content-indicator" data-kind="arch" aria-label="Foco Arquiteto: ${s.arch}"><span class="indicator-emoji" aria-hidden="true">📐</span><span class="indicator-count">${s.arch}</span></span>`);
          if(s.num)chips.push(`<span class="content-indicator" data-kind="num" aria-label="Número-chave: ${s.num}"><span class="indicator-emoji" aria-hidden="true">🔢</span><span class="indicator-count">${s.num}</span></span>`);
          setHtml(ind,chips.join('')||`<span class="content-indicator" data-kind="topics"><span class="indicator-emoji" aria-hidden="true">📚</span><span class="indicator-count">${s.total} tópico${s.total===1?'':'s'}</span></span>`)}
      }
      r.style.setProperty('--branch-progress',`${s.pct}%`);
      setText(Q('.ramo-progress-label',r),`${s.marked}/${s.total} · ${s.pct}%`);
      setHtml(Q('.adaptive-review-badge',r),`<strong>${s.difficult} DIF</strong> · ${s.reviewed} REV · ${s.done} OK`);
      const idx=Q(`.branch-index-item[data-target="${CSS.escape(r.id)}"]`,index);if(idx)setText(Q('.branch-index-pct',idx),`${s.pct}%`);
    });
    const totalTopics=QA('.topic-card').length,totalBranches=ramos().length;const ov=Q('#studyOverviewText');
    setText(ov,`${totalBranches} ramo${totalBranches===1?'':'s'} · ${totalTopics} tópico${totalTopics===1?'':'s'} · revisão, memorização e progresso integrados.`);
  }

  /* ---------------- Notas pessoais ---------------- */
  function initNotes(){
    QA('.topic-card').forEach((topic,idx)=>{
      if(!topic.id) topic.id=`note-topic-${idx+1}`;
      if(Q('.personal-note-panel',topic))return;
      const group=Q('.study-state-group',topic)||Q('.topic-summary',topic); if(!group)return;
      const btn=document.createElement('button');btn.type='button';btn.className='note-personal-btn';btn.title='Nota pessoal';btn.setAttribute('aria-label','Abrir nota pessoal');btn.setAttribute('aria-pressed','false');btn.textContent='📝';if(notes[topic.id])btn.classList.add('has-note');group.appendChild(btn);
      const panel=document.createElement('div');panel.className='personal-note-panel';panel.innerHTML=`<div class="personal-note-head"><strong>📝 Minha nota</strong><span class="personal-note-saved">salva localmente</span></div><textarea placeholder="Escreva sua observação, associação, pegadinha da banca ou lembrete pessoal…"></textarea>`;
      topic.appendChild(panel);const ta=Q('textarea',panel);ta.value=notes[topic.id]||'';
      btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();topic.open=true;const isOpen=panel.classList.toggle('open');btn.classList.toggle('active',isOpen);btn.setAttribute('aria-pressed',String(isOpen));if(isOpen)setTimeout(()=>ta.focus(),30)});
      let tm=0;ta.addEventListener('input',()=>{clearTimeout(tm);tm=setTimeout(()=>{const v=ta.value.trim();if(v)notes[topic.id]=v;else delete notes[topic.id];btn.classList.toggle('has-note',!!v);saveNotes()},180)});
    });
  }

  /* ---------------- Memorização clicável ---------------- */
  function initMemoryQuiz(){
    QA('#memorizacao tbody tr').forEach(row=>{row.classList.add('memory-card');row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-expanded','false');const toggle=()=>{const on=row.classList.toggle('revealed');row.setAttribute('aria-expanded',String(on))};row.addEventListener('click',toggle);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}})});
  }

  /* ---------------- Revisão adaptativa ---------------- */
  function adaptiveOrder(){
    ramos().forEach((r,i)=>{const s=statsFor(r);let rank=30;if(s.difficult)rank=10;else if(s.reviewed)rank=20;else if(s.marked===s.total&&s.total)rank=50;else if(s.done)rank=40;r.style.setProperty('--adaptive-order',String(rank*100+i))});
  }
  document.getElementById('reviewBtn')?.addEventListener('click',()=>setTimeout(()=>{adaptiveOrder();updateProgress()},0));

  /* ---------------- Índice ativo ---------------- */
  const activeObs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){QA('.branch-index-item',index).forEach(b=>b.classList.toggle('active',b.dataset.target===e.target.id))}})},{rootMargin:'-28% 0px -58% 0px',threshold:0});
  ramos().forEach(r=>activeObs.observe(r));

  /* ---------------- Performance mapas gigantes ---------------- */
  const topicCount=QA('.topic-card').length, branchCount=ramos().length;
  if(topicCount>60||branchCount>12){
    body.classList.add('giant-map');
    const nearObs=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('near-viewport',e.isIntersecting)),{rootMargin:'900px 0px 900px 0px',threshold:0});
    QA('main > .ramo, main > .global').forEach(el=>nearObs.observe(el));
    let fastTimer=0,prev=scrollY,prevT=performance.now();addEventListener('scroll',()=>{const now=performance.now(),v=Math.abs(scrollY-prev)/Math.max(8,now-prevT);prev=scrollY;prevT=now;if(v>.9){body.classList.add('is-fast-scrolling');clearTimeout(fastTimer);fastTimer=setTimeout(()=>body.classList.remove('is-fast-scrolling'),140)}},{passive:true});
  }

  /* Recalcula uma vez por lote de mudanças OK/REV/DIF. */
  let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;updateProgress();adaptiveOrder()})};
  document.addEventListener('mindmap:study-state-changed',schedule);

  buildIndex();ensureProgress();initNotes();initMemoryQuiz();adaptiveOrder();updateProgress();
})();

