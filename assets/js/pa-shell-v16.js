(()=>{
'use strict';
const VERSION='canonical-2026-09',NAV=window.PLANO_ARQ_NAVIGATION||{groups:[],footer:[]};
const pageMap={'planejamento.html':'planning','edital.html':'edital','biblioteca.html':'maps','revisoes.html':'reviews','questoes.html':'questions','simulados.html':'simulations','erros.html':'errors','desempenho.html':'performance','diagnostico.html':'diagnostic','historico.html':'history','arquivos.html':'files','configuracoes.html':'settings','creditos.html':'credits'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJSON=(v,f)=>{try{return JSON.parse(v)??f}catch(_){return f}};
function applyPrefs(){const p=safeJSON(localStorage.getItem('planoarq:preferences:v1'),{});const root=document.documentElement;root.dataset.paDensity=p.density==='compact'?'compact':'comfortable';root.classList.toggle('pa-hide-future',p.showFuture===false);root.classList.toggle('pa-reduce-motion',p.reduceMotion===true)}
function contestId(){const q=new URLSearchParams(location.search).get('contest');if(q)return q;const m=location.hash.match(/^#contest\/([^/?#]+)/);if(m)return decodeURIComponent(m[1]);return localStorage.getItem('planoarq:active-contest:v1')||localStorage.getItem('planoarq:active-contest')||localStorage.getItem('planoarq:activeContest')||''}
function contests(){const seed=window.PLANO_ARQ_CONTESTS?.contests||[],local=safeJSON(localStorage.getItem('planoarq:contests:v1'),[]),m=new Map(seed.map(x=>[x.id,{...x}]));local.forEach(x=>m.set(x.id,{...(m.get(x.id)||{}),...x}));return[...m.values()]}
function contest(){const id=contestId();return contests().find(x=>x.id===id)||{}}
function pageKey(){if(document.body.dataset.paPage)return document.body.dataset.paPage;const f=location.pathname.split('/').pop()||'index.html';if(f==='index.html'||!f)return location.hash.startsWith('#contest/')?'today':'home';return pageMap[f]||''}
function href(item,id){const e=encodeURIComponent(id);return({today:`index.html#contest/${e}`,planning:`planejamento.html?contest=${e}`,edital:`edital.html?contest=${e}`,maps:`biblioteca.html?contest=${e}`,reviews:`revisoes.html?contest=${e}`,questions:`questoes.html?contest=${e}`,simulations:`simulados.html?contest=${e}`,errors:`erros.html?contest=${e}`,performance:`desempenho.html?contest=${e}`,diagnostic:`diagnostico.html?contest=${e}`,history:`historico.html?contest=${e}`,files:`arquivos.html?contest=${e}`,settings:`configuracoes.html?contest=${e}`,switch:'index.html#home'})[item.key]||'#'}
function iconHTML(item){return `<span class="pa-nav-icon-wrap"><img class="pa-nav-icon" src="${esc(item.icon)}" alt="" width="19" height="19" loading="eager" decoding="async" referrerpolicy="no-referrer" onerror="this.classList.add('is-broken')"></span>`}
function itemHTML(item,active){const cls=`${active?'active':''} ${item.status==='future'?'is-future':''}`.trim(),body=`${iconHTML(item)}<span class="pa-nav-label-text">${esc(item.label)}</span>${item.status==='future'?'<span class="pa-nav-soon" title="Em breve" aria-label="Em breve"></span>':'<span></span>'}`;if(item.status==='future')return `<button type="button" class="pa-nav-item ${cls}" data-pa-nav="${esc(item.key)}" data-pa-status="future" ${active?'aria-current="page"':''}>${body}</button>`;return `<a class="pa-nav-link ${cls}" data-pa-nav="${esc(item.key)}" data-pa-status="live" href="${esc(href(item,contestId()))}" ${active?'aria-current="page"':''}>${body}</a>`}
function sidebarHTML(){const c=contest(),id=contestId(),current=pageKey(),groups=NAV.groups.map(g=>`<section class="pa-nav-group"><div class="pa-nav-label">${esc(g.label)}</div><nav class="pa-nav">${g.items.map(i=>itemHTML(i,current===i.key)).join('')}</nav></section>`).join('');return `<div class="pa-brand"><div class="pa-brand-kicker">Estudos para concursos</div><div class="pa-brand-title">Plano ARQ</div><div class="pa-brand-rule"></div></div><div class="pa-contest-card"><small>Concurso ativo</small><strong>${esc((c.title||'Concurso')+(c.position?' · '+c.position:''))}</strong><span>${esc((c.board||'Banca')+(c.notice?' · '+c.notice:''))}</span></div><div class="pa-nav-scroll">${groups}</div><div class="pa-sidebar-footer"><nav class="pa-nav">${NAV.footer.map(i=>itemHTML(i,current===i.key)).join('')}</nav><a class="pa-icon-credits" href="creditos.html?contest=${encodeURIComponent(id)}">Ícones: Flaticon · créditos</a></div>`}
let __dialogConfirm=null,__dialogReturnFocus=null;
function ensureModal(){if(document.getElementById('paShellModal'))return;document.body.insertAdjacentHTML('beforeend',`<div class="pa-shell-modal" id="paShellModal" aria-hidden="true"><div class="pa-shell-dialog" role="dialog" aria-modal="true" aria-labelledby="paShellDialogTitle"><div class="pa-shell-dialog-k" id="paShellDialogK">Plano ARQ</div><h3 id="paShellDialogTitle">Área</h3><p id="paShellDialogText"></p><div class="pa-shell-dialog-actions"><button id="paShellDialogCancel">Fechar</button><button id="paShellDialogConfirm" hidden>Confirmar</button></div></div></div>`);const m=document.getElementById('paShellModal'),close=()=>{m.classList.remove('open');m.setAttribute('aria-hidden','true');__dialogConfirm=null;const back=__dialogReturnFocus;__dialogReturnFocus=null;requestAnimationFrame(()=>back?.focus?.())};document.getElementById('paShellDialogCancel').onclick=close;document.getElementById('paShellDialogConfirm').onclick=()=>{const fn=__dialogConfirm;close();fn?.()};m.addEventListener('pointerdown',e=>{if(e.target===m)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape')close()})}
function openDialog(title,text,k='Plano ARQ',onConfirm=null,confirmLabel='Confirmar'){ensureModal();document.getElementById('paShellDialogK').textContent=k;document.getElementById('paShellDialogTitle').textContent=title;document.getElementById('paShellDialogText').textContent=text;const cancel=document.getElementById('paShellDialogCancel'),confirm=document.getElementById('paShellDialogConfirm');__dialogConfirm=typeof onConfirm==='function'?onConfirm:null;confirm.hidden=!__dialogConfirm;confirm.textContent=confirmLabel;cancel.textContent=__dialogConfirm?'Cancelar':'Fechar';const m=document.getElementById('paShellModal');__dialogReturnFocus=document.activeElement;m.classList.add('open');m.setAttribute('aria-hidden','false');requestAnimationFrame(()=>document.getElementById(__dialogConfirm?'paShellDialogConfirm':'paShellDialogCancel')?.focus())}
function info(title,text,k='Plano ARQ'){openDialog(title,text,k)}
function confirmAction(title,text,onConfirm,k='Plano ARQ',confirmLabel='Confirmar'){openDialog(title,text,k,onConfirm,confirmLabel)}
function allItems(){return[...NAV.groups.flatMap(g=>g.items),...(NAV.footer||[])]}
function bindSidebar(side){side.querySelectorAll('[data-pa-status="future"]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.paNav,item=allItems().find(x=>x.key===key);info(item?.label||'Área indisponível',`${item?.label||'Esta área'} ainda não está disponível nesta versão.`,'Indisponível')}));side.querySelectorAll('a.pa-nav-link').forEach(a=>a.addEventListener('click',()=>closeDrawer()))}
function updateScrollState(scroll){if(!scroll)return;const sync=()=>{const overflow=scroll.scrollHeight>scroll.clientHeight+2;scroll.classList.toggle('can-scroll',overflow);scroll.classList.toggle('at-top',scroll.scrollTop<=2);scroll.classList.toggle('at-bottom',scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-2)};sync();scroll.addEventListener('scroll',sync,{passive:true});requestAnimationFrame(()=>{sync();const active=scroll.querySelector('.active');if(active)active.scrollIntoView({block:'nearest'});sync()});if('ResizeObserver'in window)new ResizeObserver(sync).observe(scroll)}
function build(side){if(!side||side.dataset.paShellBuilt===VERSION)return;side.innerHTML=sidebarHTML();side.dataset.paShellBuilt=VERSION;bindSidebar(side);updateScrollState(side.querySelector('.pa-nav-scroll'))}
function scan(){document.querySelectorAll('.pa-sidebar').forEach(build)}
function syncTopbar(){const c=contest(),label=[c.title||'Concurso',c.position||''].filter(Boolean).join(' · ');document.querySelectorAll('.pa-top-k').forEach(x=>x.textContent=label)}
function closeDrawer(){document.querySelector('.pa-sidebar')?.classList.remove('open');document.querySelector('.pa-backdrop')?.classList.remove('show');document.querySelectorAll('.pa-menu-btn').forEach(btn=>btn.setAttribute('aria-expanded','false'))}
function bindDrawer(){document.querySelectorAll('.pa-menu-btn').forEach(btn=>{btn.setAttribute('aria-label','Abrir menu');btn.setAttribute('aria-expanded','false')});document.addEventListener('click',e=>{const btn=e.target.closest('.pa-menu-btn');if(!btn)return;const side=document.querySelector('.pa-sidebar'),back=document.querySelector('.pa-backdrop');if(side){side.classList.add('open');back?.classList.add('show');btn.setAttribute('aria-expanded','true')}});document.addEventListener('click',e=>{if(!e.target.classList.contains('pa-backdrop'))return;closeDrawer()});document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const side=document.querySelector('.pa-sidebar');if(side?.classList.contains('open')){closeDrawer();document.querySelector('.pa-menu-btn')?.focus()}})}
function ensureCommonMenu(){let m=document.getElementById('paCommonMenu');const id=contestId();if(!m){document.body.insertAdjacentHTML('beforeend',`<div class="pa-common-menu" id="paCommonMenu" hidden><button type="button" data-common="focus">Foco automático</button><button type="button" data-common="install">Instalar aplicativo</button><a href="index.html#home">Trocar concurso</a><button type="button" data-common="settings">Configurações</button><div class="sep"></div><a data-common="credits" href="creditos.html?contest=${encodeURIComponent(id)}">Créditos dos ícones</a><button type="button" data-common="reload">Recarregar página</button></div>`);m=document.getElementById('paCommonMenu');document.querySelector('[data-common="focus"]')?.addEventListener('click',()=>{closeCommonMenu();location.href=`index.html#contest/${encodeURIComponent(contestId())}`});document.querySelector('[data-common="install"]')?.addEventListener('click',async()=>{closeCommonMenu();const r=await window.PLANO_ARQ_PWA?.install?.();if(r?.manual)info('Instalar Plano ARQ',r.message,'Aplicativo')});document.querySelector('[data-common="settings"]')?.addEventListener('click',()=>{closeCommonMenu();location.href=`configuracoes.html?contest=${encodeURIComponent(contestId())}`});document.querySelector('[data-common="reload"]')?.addEventListener('click',()=>location.reload())}m.querySelector('[data-common="credits"]')?.setAttribute('href',`creditos.html?contest=${encodeURIComponent(id)}`)}
function closeCommonMenu(){const m=document.getElementById('paCommonMenu');if(m)m.hidden=true;document.querySelectorAll('[data-pa-more-bound]').forEach(btn=>btn.setAttribute('aria-expanded','false'))}
function openCommonMenu(btn){ensureCommonMenu();const m=document.getElementById('paCommonMenu'),r=btn.getBoundingClientRect();m.hidden=false;btn.setAttribute('aria-expanded','true');const w=m.offsetWidth,h=m.offsetHeight,pad=10;let left=Math.min(innerWidth-w-pad,Math.max(pad,r.right-w)),top=r.bottom+6;if(top+h>innerHeight-pad)top=Math.max(pad,r.top-h-6);m.style.left=`${Math.round(left)}px`;m.style.top=`${Math.round(top)}px`}
function bindCommonMore(){
 document.querySelectorAll('.pa-top-actions').forEach(actions=>{
   [...actions.querySelectorAll('button')].filter(b=>b.textContent.trim()==='•••').forEach(btn=>{
     if(btn.dataset.paMoreBound)return;
     btn.dataset.paMoreBound='1';btn.setAttribute('aria-label','Mais opções');btn.setAttribute('aria-haspopup','true');btn.setAttribute('aria-expanded','false');
     btn.addEventListener('click',e=>{
       e.preventDefault();e.stopImmediatePropagation();
       const m=document.getElementById('paCommonMenu');
       if(m&&!m.hidden){closeCommonMenu();return}
       openCommonMenu(btn)
     },true)
   })
 });
 if(document.documentElement.dataset.paCommonClosersBound)return;
 document.documentElement.dataset.paCommonClosersBound='1';
 document.addEventListener('pointerdown',e=>{const m=document.getElementById('paCommonMenu');if(m&&!m.hidden&&!m.contains(e.target)&&!e.target.closest?.('[data-pa-more-bound]'))closeCommonMenu()});
 window.addEventListener('resize',closeCommonMenu,{passive:true});
 window.addEventListener('scroll',closeCommonMenu,{passive:true,capture:true})
}
function mobileItem(key,label){const item=allItems().find(x=>x.key===key),active=pageKey()===key;if(!item)return'';return `<a class="${active?'active':''}" href="${esc(href(item,contestId()))}">${iconHTML(item)}<span>${esc(label||item.label)}</span></a>`}
function bindMobileMoreCloser(){
 if(document.documentElement.dataset.paMobileCloserBound)return;
 document.documentElement.dataset.paMobileCloserBound='1';
 document.addEventListener('pointerdown',e=>{
   const more=document.getElementById('paMobileMore'),btn=document.getElementById('paMobileMoreBtn');
   if(more?.classList.contains('open')&&!more.contains(e.target)&&!e.target.closest?.('#paMobileMoreBtn')){
     more.classList.remove('open');btn?.setAttribute('aria-expanded','false')
   }
 });
 document.addEventListener('keydown',e=>{
   if(e.key!=='Escape')return;
   const more=document.getElementById('paMobileMore'),btn=document.getElementById('paMobileMoreBtn');
   if(more?.classList.contains('open')){more.classList.remove('open');btn?.setAttribute('aria-expanded','false');btn?.focus()}
 })
}
function mobileMoreEntry(item,current){
 const active=current===item.key,classes=active?'active':'';
 if(item.status==='future'){
   return `<button type="button" class="${classes}" data-pa-mobile-future="${esc(item.key)}">${iconHTML(item)}<span>${esc(item.label)}</span></button>`
 }
 return `<a class="${classes}" href="${esc(href(item,contestId()))}" ${active?'aria-current="page"':''}>${iconHTML(item)}<span>${esc(item.label)}</span></a>`
}
function mobileMoreHTML(){
 const current=pageKey(),excluded=new Set(['today','edital','maps']);
 const groups=(NAV.groups||[]).map(group=>{
   const items=(group.items||[]).filter(item=>!excluded.has(item.key));
   if(!items.length)return'';
   return `<section class="pa-mobile-more-group"><div class="pa-mobile-more-label">${esc(group.label)}</div><div class="pa-mobile-more-grid">${items.map(i=>mobileMoreEntry(i,current)).join('')}</div></section>`
 }).join('');
 const footer=(NAV.footer||[]).filter(i=>['switch','settings'].includes(i.key));
 return `<div class="pa-mobile-more-head"><div><strong>Mais</strong><span>Navegação do concurso</span></div></div>${groups}<section class="pa-mobile-more-group pa-mobile-more-footer"><div class="pa-mobile-more-grid">${footer.map(i=>mobileMoreEntry(i,current)).join('')}</div></section>`
}
function ensureMobileNav(){
 document.querySelectorAll('.mobile-bottom').forEach(x=>x.remove());
 if(document.getElementById('paMobileNav'))return;
 document.body.insertAdjacentHTML('beforeend',
   `<nav class="pa-mobile-nav" id="paMobileNav">${mobileItem('today','Hoje')}${mobileItem('edital','Edital')}${mobileItem('maps','Mapas')}<button type="button" id="paMobileMoreBtn" aria-expanded="false" aria-controls="paMobileMore">•••<span>Mais</span></button></nav><div class="pa-mobile-more" id="paMobileMore" aria-label="Mais áreas do concurso"></div>`
 );
 const more=document.getElementById('paMobileMore'),btn=document.getElementById('paMobileMoreBtn');
 more.innerHTML=mobileMoreHTML();
 more.querySelectorAll('[data-pa-mobile-future]').forEach(b=>b.addEventListener('click',()=>{
   const item=allItems().find(x=>x.key===b.dataset.paMobileFuture);
   info(item?.label||'Área indisponível',`${item?.label||'Esta área'} ainda não está disponível nesta versão.`,'Indisponível')
 }));
 btn.onclick=()=>{
   const open=more.classList.toggle('open');
   btn.setAttribute('aria-expanded',open?'true':'false')
 };
 bindMobileMoreCloser()
}
function normalizeControls(){document.querySelectorAll('button').forEach(btn=>{if(btn.textContent.trim()==='×'&&!btn.hasAttribute('aria-label'))btn.setAttribute('aria-label','Fechar')})}
function init(){applyPrefs();ensureModal();scan();syncTopbar();normalizeControls();bindDrawer();bindCommonMore();ensureMobileNav();new MutationObserver(m=>{let needShell=false,needMore=false;for(const x of m){for(const n of x.addedNodes){if(n.nodeType!==1)continue;if(n.matches?.('.pa-sidebar')||n.querySelector?.('.pa-sidebar'))needShell=true;if(n.matches?.('.pa-top-actions')||n.querySelector?.('.pa-top-actions'))needMore=true;if(needShell&&needMore)break}if(needShell&&needMore)break}if(needShell)requestAnimationFrame(scan);if(needMore)requestAnimationFrame(bindCommonMore);if(needShell||needMore)requestAnimationFrame(normalizeControls)}).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('planoarq:preferences',applyPrefs);window.addEventListener('storage',e=>{if(e.key==='planoarq:preferences:v1')applyPrefs()});window.addEventListener('hashchange',()=>{closeCommonMenu();document.querySelectorAll('.pa-sidebar').forEach(x=>delete x.dataset.paShellBuilt);scan();syncTopbar();bindCommonMore();document.getElementById('paMobileNav')?.remove();document.getElementById('paMobileMore')?.remove();ensureMobileNav()})}
window.PLANO_ARQ_SHELL={version:VERSION,info,confirm:confirmAction,scan,closeDrawer,closeCommonMenu};
window.addEventListener('planoarq:sync-status',e=>{document.documentElement.dataset.paSyncState=e.detail?.state||''});window.addEventListener('planoarq:drive-status',e=>{document.documentElement.dataset.paDriveState=e.detail?.state||''});window.addEventListener('planoarq:pwa-status',e=>{document.documentElement.dataset.paOnline=e.detail?.online?'online':'offline';document.documentElement.dataset.paInstalled=e.detail?.installed?'1':'0'});
function initWithSync(){init();const maintenance=window.PLANO_ARQ_DATA?.isMaintenanceMode?.()===true;document.documentElement.dataset.paMaintenance=maintenance?'1':'0';if(maintenance){window.PLANO_ARQ_SYNC?.stopAutoSync?.();window.PLANO_ARQ_DRIVE?.stopAutoSnapshot?.();return}setTimeout(()=>{window.PLANO_ARQ_SYNC?.startAutoSync?.();window.PLANO_ARQ_DRIVE?.startAutoSnapshot?.()},0)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initWithSync,{once:true});else initWithSync();
})();
