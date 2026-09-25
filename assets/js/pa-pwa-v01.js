(()=>{
'use strict';
const VERSION='19.3';
const MAINTENANCE_RELOAD_KEY='planoarq:maintenance-sw-reload:v1';
const RUNTIME_KEY='planoarq:runtime-flags:v1';
const maintenance=()=>{
  if(window.PLANO_ARQ_DATA?.isMaintenanceMode)return window.PLANO_ARQ_DATA.isMaintenanceMode()===true;
  try{
    const raw=localStorage.getItem(RUNTIME_KEY);
    if(raw===null)return true;
    return JSON.parse(raw)?.maintenanceMode!==false;
  }catch(_){return true}
};
let deferredPrompt=null;
let registration=null;
let updateReady=false;
let activationRequested=false;
let controllerReloaded=false;
let initialized=false;
let lastUpdateCheck=0;
let lastError='';
const $=id=>document.getElementById(id);
const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches===true||window.navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
const supportedProtocol=()=>location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1';
const executionMode=()=>!supportedProtocol()?'MODO_NAO_SUPORTADO':isStandalone()?(isIOS()?'IOS_INSTALADO':'STANDALONE'):'NAVEGADOR';
function installationState(){
  if(maintenance())return'PAUSADO';
  if(isStandalone())return'INSTALADO';
  if(!supportedProtocol()||!('serviceWorker'in navigator))return'NAO_SUPORTADO';
  if(isIOS())return'MANUAL';
  if(deferredPrompt)return'DISPONIVEL';
  if(lastError)return'INDISPONIVEL';
  return'AGUARDANDO';
}
function status(){
  return{
    version:VERSION,
    maintenance:maintenance(),
    online:navigator.onLine,
    protocol:location.protocol,
    hostname:location.hostname,
    supportedProtocol:supportedProtocol(),
    serviceWorker:'serviceWorker'in navigator,
    registered:!!registration,
    controller:!!navigator.serviceWorker?.controller,
    installed:isStandalone(),
    installable:!!deferredPrompt,
    ios:isIOS(),
    execution:executionMode(),
    installation:installationState(),
    updateReady,
    lastError:lastError||''
  };
}
function ensureNotice(){
  if($('paPwaNotice')||!document.body)return;
  document.body.insertAdjacentHTML('beforeend','<button type="button" class="pa-pwa-notice" id="paPwaNotice" hidden></button>');
  $('paPwaNotice').onclick=()=>{
    if(updateReady){activateUpdate();return}
    location.href='configuracoes.html'+(new URLSearchParams(location.search).get('contest')?'?contest='+encodeURIComponent(new URLSearchParams(location.search).get('contest')):'')+'#pwa';
  };
}
function renderNotice(){
  ensureNotice();
  const b=$('paPwaNotice');
  if(!b)return;
  if(maintenance()){b.hidden=true;b.textContent='';return}
  if(!navigator.onLine){b.hidden=false;b.dataset.kind='offline';b.textContent='Offline · dados locais ativos';return}
  if(updateReady){b.hidden=false;b.dataset.kind='update';b.textContent='Nova versão disponível · atualizar';return}
  b.hidden=true;b.textContent='';
}
function emit(){
  const detail=status();
  window.dispatchEvent(new CustomEvent('planoarq:pwa-status',{detail}));
  renderNotice();
  return detail;
}
async function refreshRegistration(minInterval=300000){
  if(maintenance())return null;
  if(!registration)return null;
  const now=Date.now();
  if(minInterval&&now-lastUpdateCheck<minInterval)return registration;
  lastUpdateCheck=now;
  try{await registration.update();lastError=''}catch(error){lastError=error?.message||String(error)}
  updateReady=!!registration.waiting;
  emit();
  return registration;
}
function bindRegistration(reg){
  if(!reg||reg.__planoArqBound)return;
  reg.__planoArqBound=true;
  if(reg.waiting){updateReady=true;emit()}
  reg.addEventListener('updatefound',()=>{
    const w=reg.installing;
    if(!w)return;
    emit();
    w.addEventListener('statechange',()=>{
      if(w.state==='installed'&&navigator.serviceWorker.controller)updateReady=true;
      if(w.state==='activated'&&!navigator.serviceWorker.controller)updateReady=false;
      emit();
    });
  });
}
async function clearTechnicalCaches(){
  if(!globalThis.caches)return[];
  const removed=[];
  for(const name of await caches.keys()){
    if(name.startsWith('plano-arq-')&&await caches.delete(name))removed.push(name);
  }
  return removed;
}
async function unregisterAppWorkers(){
  if(!('serviceWorker'in navigator))return 0;
  const regs=await navigator.serviceWorker.getRegistrations();
  let removed=0;
  const currentDir=new URL('./',location.href).pathname.toLowerCase();
  for(const reg of regs){
    const path=new URL(reg.scope).pathname.toLowerCase();
    const ours=path===currentDir||path.includes('/planodeestudos/');
    if(ours&&await reg.unregister())removed++;
  }
  return removed;
}
async function enterMaintenanceMode({reloadIfControlled=true}={}){
  deferredPrompt=null;updateReady=false;activationRequested=false;lastError='';
  const hadController=!!navigator.serviceWorker?.controller;
  const unregistered=await unregisterAppWorkers();
  const removedCaches=await clearTechnicalCaches();
  registration=null;
  emit();
  if(hadController&&reloadIfControlled&&sessionStorage.getItem(MAINTENANCE_RELOAD_KEY)!=='1'){
    sessionStorage.setItem(MAINTENANCE_RELOAD_KEY,'1');
    location.reload();
    return{ok:true,reloading:true,unregistered,removedCaches};
  }
  sessionStorage.removeItem(MAINTENANCE_RELOAD_KEY);
  return{ok:true,reloading:false,unregistered,removedCaches};
}
async function register(){
  if(maintenance()){await enterMaintenanceMode();return null}
  if(!supportedProtocol()){lastError='Protocolo sem suporte a Service Worker.';emit();return null}
  if(!('serviceWorker'in navigator)){lastError='Este navegador não oferece Service Worker.';emit();return null}
  try{
    registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
    bindRegistration(registration);
    registration=await navigator.serviceWorker.ready;
    bindRegistration(registration);
    updateReady=!!registration.waiting;
    lastError='';
    await refreshRegistration(0);
    emit();
    return registration;
  }catch(error){
    lastError=error?.message||String(error);
    console.warn('[Plano ARQ PWA] service worker:',error);
    emit();
    return null;
  }
}
async function install(){
  if(maintenance())return{ok:false,state:'PAUSADO',maintenance:true,message:'Instalação pausada durante o modo manutenção.'};
  if(isStandalone())return{ok:true,installed:true,state:'INSTALADO'};
  if(!supportedProtocol())return{ok:false,state:'NAO_SUPORTADO',message:'A instalação exige HTTPS ou localhost.'};
  if(isIOS())return{ok:false,manual:true,state:'MANUAL',message:'No iPhone/iPad: abra Compartilhar no Safari e escolha “Adicionar à Tela de Início”.'};
  if(deferredPrompt){
    const p=deferredPrompt;
    deferredPrompt=null;
    await p.prompt();
    const choice=await p.userChoice;
    emit();
    return{ok:choice.outcome==='accepted',outcome:choice.outcome,state:choice.outcome==='accepted'?'ACEITO':'RECUSADO'};
  }
  return{ok:false,state:installationState(),message:'O navegador não disponibilizou o prompt de instalação neste momento.'};
}
async function send(type,payload={}){
  if(maintenance())throw new Error('PWA e cache offline pausados pelo modo manutenção.');
  const reg=registration||await navigator.serviceWorker?.ready;
  if(!reg?.active)throw new Error('Service Worker ainda não está ativo.');
  return new Promise((resolve,reject)=>{
    const ch=new MessageChannel();
    const timer=setTimeout(()=>reject(new Error('Tempo esgotado ao comunicar com o cache offline.')),120000);
    ch.port1.onmessage=e=>{
      clearTimeout(timer);
      e.data?.ok===false?reject(new Error(e.data.error||'Falha no Service Worker')):resolve(e.data);
    };
    reg.active.postMessage({type,payload},[ch.port2]);
  });
}
async function pack(kind='full'){
  if(maintenance())return{ok:false,maintenance:true,cached:0,failed:0,total:0,state:'PAUSADO'};
  const r=await fetch('./data/offline-pack.json',{cache:'no-store'});
  if(!r.ok)throw new Error('Manifesto offline indisponível.');
  const data=await r.json();
  const items=(kind==='essential'?data.essential:data.full)||[];
  const result=await send('CACHE_URLS',{urls:items.map(x=>x.path),kind});
  return{...result,bytes:kind==='essential'?data.essentialBytes:data.fullBytes,total:items.length,manifestVersion:data.version||null};
}
async function clearOffline(){if(maintenance())return{ok:false,maintenance:true,state:'PAUSADO'};return send('CLEAR_OFFLINE')}
async function cacheInfo(){
  if(maintenance()){
    const rows=globalThis.caches?await caches.keys():[];
    return{ok:true,maintenance:true,offlineCount:0,runtimeCount:0,coreCount:0,technicalCaches:rows.filter(x=>x.startsWith('plano-arq-')).length,version:VERSION};
  }
  try{return await send('CACHE_INFO')}
  catch(error){return{ok:false,offlineCount:0,runtimeCount:0,coreCount:0,error:error?.message||String(error)}}
}
async function storageEstimate(){
  if(!navigator.storage?.estimate)return null;
  try{return await navigator.storage.estimate()}catch(_){return null}
}
async function waitInstalling(reg,timeout=15000){
  const worker=reg?.installing;
  if(!worker)return;
  if(worker.state==='installed'||worker.state==='activated')return;
  await new Promise(resolve=>{
    const timer=setTimeout(resolve,timeout);
    worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'||worker.state==='activated'||worker.state==='redundant'){clearTimeout(timer);resolve()}
    });
  });
}
async function checkUpdate(){
  if(maintenance())return{...status(),checked:true,maintenance:true,state:'PAUSADO'};
  if(!registration)await register();
  if(!registration)return{...status(),checked:true};
  try{
    lastUpdateCheck=Date.now();
    await registration.update();
    await waitInstalling(registration);
    updateReady=!!registration.waiting;
    lastError='';
  }catch(error){lastError=error?.message||String(error)}
  emit();
  return{...status(),checked:true};
}
async function activateUpdate(){
  if(maintenance())return{ok:false,maintenance:true,state:'PAUSADO'};
  if(!registration)await register();
  const waiting=registration?.waiting;
  if(!waiting)return{ok:false,state:'SEM_ATUALIZACAO'};
  activationRequested=true;
  waiting.postMessage({type:'SKIP_WAITING'});
  return{ok:true,state:'ATIVANDO'};
}
async function diagnose(){
  const out={status:status(),manifest:null,serviceWorker:null,caches:null,serviceWorkerFile:null};
  try{
    const mr=await fetch('./manifest.webmanifest',{cache:'no-store'});
    const mj=mr.ok?await mr.json():null;
    const icons=[];
    for(const icon of mj?.icons||[]){
      try{
        const ir=await fetch(new URL(icon.src,mr.url),{cache:'no-store'});
        icons.push({src:icon.src,sizes:icon.sizes||'',purpose:icon.purpose||'any',ok:ir.ok,status:ir.status,mime:ir.headers.get('content-type')||''});
      }catch(error){icons.push({src:icon.src,sizes:icon.sizes||'',purpose:icon.purpose||'any',ok:false,error:error?.message||String(error)})}
    }
    out.manifest={ok:mr.ok,status:mr.status,mime:mr.headers.get('content-type')||'',url:mr.url,data:mj,icons};
  }catch(error){out.manifest={ok:false,error:error?.message||String(error)}}
  try{
    const reg=maintenance()?null:(registration||await navigator.serviceWorker?.getRegistration('./'));
    if(reg&&!registration){registration=reg;bindRegistration(registration)}
    out.serviceWorker={
      supported:'serviceWorker'in navigator,
      registered:!!reg,
      scope:reg?.scope||null,
      active:reg?.active?.scriptURL||null,
      activeState:reg?.active?.state||null,
      waiting:reg?.waiting?.scriptURL||null,
      installing:reg?.installing?.scriptURL||null,
      controller:navigator.serviceWorker?.controller?.scriptURL||null,
      controllerState:navigator.serviceWorker?.controller?.state||null
    };
  }catch(error){out.serviceWorker={supported:'serviceWorker'in navigator,registered:false,error:error?.message||String(error)}}
  try{
    const sr=await fetch('./service-worker.js',{cache:'no-store'});
    const text=await sr.text();
    out.serviceWorkerFile={ok:sr.ok,status:sr.status,mime:sr.headers.get('content-type')||'',url:sr.url,version:(text.match(/const VERSION='([^']+)'/)||[])[1]||null};
  }catch(error){out.serviceWorkerFile={ok:false,error:error?.message||String(error)}}
  try{
    const names=await caches.keys();
    const rows=[];
    for(const name of names){const c=await caches.open(name);rows.push({name,count:(await c.keys()).length})}
    out.caches=rows;
  }catch(error){out.caches=[];out.cacheError=error?.message||String(error)}
  out.status=status();
  return out;
}
async function init(){
  if(initialized)return registration;
  initialized=true;
  if(document.body)ensureNotice();else document.addEventListener('DOMContentLoaded',ensureNotice,{once:true});
  window.addEventListener('planoarq:runtime-flags',e=>{
    if(e.detail?.maintenanceMode)enterMaintenanceMode().catch(()=>{});
    else location.reload();
  });
  if(maintenance()){
    emit();
    return enterMaintenanceMode();
  }
  window.addEventListener('online',()=>{emit();refreshRegistration(0)});
  window.addEventListener('offline',emit);
  window.addEventListener('pageshow',e=>{if(e.persisted)refreshRegistration(0)});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshRegistration()});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;emit()});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;emit()});
  if('serviceWorker'in navigator){
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      registration=navigator.serviceWorker.controller?registration:null;
      if(activationRequested&&!controllerReloaded){
        controllerReloaded=true;
        location.reload();
        return;
      }
      emit();
    });
  }
  emit();
  return register();
}
window.PLANO_ARQ_PWA={version:VERSION,init,status,install,pack,clearOffline,cacheInfo,storageEstimate,checkUpdate,activateUpdate,diagnose,enterMaintenanceMode,clearTechnicalCaches,unregisterAppWorkers};
init();
})();