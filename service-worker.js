const VERSION='19.4-source';
const MAINTENANCE_MODE=true;
const CORE=`plano-arq-core-${VERSION}`;
const RUNTIME=`plano-arq-runtime-${VERSION}`;
const OFFLINE='plano-arq-offline-user-v1';

const CORE_URLS=[
  './','./index.html','./offline.html','./manifest.webmanifest',
  './assets/css/pa-tokens-v01.css','./assets/css/pa-components-v01.css','./assets/css/pa-shell-v16.css',
  './assets/js/pa-pwa-v01.js','./assets/js/pa-shell-v16.js','./assets/js/pa-data-v03.js',
  './assets/js/pa-sync-v03.js','./assets/js/pa-drive-v01.js','./assets/js/pa-actions-v01.js',
  './data/navigation.js','./data/contests.js','./data/materials.js','./data/exam-schemas.js',
  './data/question-catalog.js','./data/review-catalog.js','./data/simulations.js',
  './data/cloud-config.js','./data/offline-pack.json'
];

const isPlanoCache=name=>name.startsWith('plano-arq-');
const currentCaches=()=>new Set([CORE,RUNTIME,OFFLINE]);

function normalizedNavigationKey(req){
  const url=new URL(req.url);
  return new Request(url.origin+url.pathname,{method:'GET'});
}

async function putSafe(cache,key,response){
  if(!response||!response.ok)return;
  try{await cache.put(key,response.clone())}catch(_){}
}

async function fallbackFor(req,{navigation=false}={}){
  const runtime=await caches.open(RUNTIME);
  const key=navigation?normalizedNavigationKey(req):req;
  return (await runtime.match(key))
    ||(await caches.match(key))
    ||(navigation?await caches.match('./offline.html'):null)
    ||Response.error();
}

async function networkFirst(req,{navigation=false}={}){
  const runtime=await caches.open(RUNTIME);
  const key=navigation?normalizedNavigationKey(req):req;
  try{
    const response=await fetch(req,{cache:'no-store'});
    if(response&&response.ok){
      await putSafe(runtime,key,response);
      return response;
    }
    if(response&&response.status>=500){
      const cached=await fallbackFor(req,{navigation});
      if(cached&&cached.type!=='error')return cached;
    }
    return response;
  }catch(_){
    return fallbackFor(req,{navigation});
  }
}

async function cacheFirst(req){
  const hit=await caches.match(req);
  if(hit)return hit;
  try{
    const response=await fetch(req,{cache:'force-cache'});
    if(response&&(response.ok||response.type==='opaque')){
      const runtime=await caches.open(RUNTIME);
      try{await runtime.put(req,response.clone())}catch(_){}
    }
    return response;
  }catch(_){
    return Response.error();
  }
}

self.addEventListener('install',event=>{
  if(MAINTENANCE_MODE){
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil((async()=>{
    const cache=await caches.open(CORE);
    for(const url of CORE_URLS){
      try{
        const response=await fetch(url,{cache:'no-store'});
        if(response.ok)await cache.put(url,response);
      }catch(_){}
    }
  })());
});

self.addEventListener('activate',event=>{
  if(MAINTENANCE_MODE){
    event.waitUntil((async()=>{
      for(const name of await caches.keys()){
        if(isPlanoCache(name))await caches.delete(name);
      }
      await self.registration.unregister();
      const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      await Promise.all(windows.map(client=>client.navigate(client.url).catch(()=>null)));
    })());
    return;
  }
  event.waitUntil((async()=>{
    const keep=currentCaches();
    for(const name of await caches.keys()){
      if(isPlanoCache(name)&&!keep.has(name))await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;

  if(MAINTENANCE_MODE){
    event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>Response.error()));
    return;
  }

  const url=new URL(req.url);

  if(req.mode==='navigate'){
    event.respondWith(networkFirst(req,{navigation:true}));
    return;
  }

  if(url.origin!==location.origin){
    if(req.destination==='image')event.respondWith(cacheFirst(req));
    return;
  }

  const path=url.pathname;

  if(
    /\/(materials|simulados|edital)\//.test(path)
    ||['style','script','font'].includes(req.destination)
    ||/\/data\//.test(path)
    || path.endsWith('/manifest.webmanifest')
  ){
    event.respondWith(networkFirst(req));
    return;
  }

  if(req.destination==='image'){
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(networkFirst(req));
});

async function cacheUrls(urls){
  const temp=`${OFFLINE}-next`;
  await caches.delete(temp);
  const next=await caches.open(temp);
  let cached=0,failed=0;

  for(const rel of urls||[]){
    try{
      const url=new URL(rel,self.registration.scope).href;
      const response=await fetch(url,{cache:'no-store'});
      if(response.ok){
        await next.put(url,response.clone());
        cached++;
      }else failed++;
    }catch(_){failed++}
  }

  if(failed){
    await caches.delete(temp);
    return{ok:false,cached,failed,error:'Pacote offline não foi substituído porque alguns arquivos falharam.'};
  }

  const entries=await next.keys();
  await caches.delete(OFFLINE);
  const stable=await caches.open(OFFLINE);
  for(const key of entries){
    const response=await next.match(key);
    if(response)await stable.put(key,response);
  }
  await caches.delete(temp);
  return{ok:true,cached,failed:0};
}

async function cacheCounts(){
  const offline=await caches.open(OFFLINE);
  const runtime=await caches.open(RUNTIME);
  const core=await caches.open(CORE);
  return{
    ok:true,
    offlineCount:(await offline.keys()).length,
    runtimeCount:(await runtime.keys()).length,
    coreCount:(await core.keys()).length,
    version:VERSION
  };
}

self.addEventListener('message',event=>{
  const msg=event.data||{};
  const port=event.ports?.[0];
  const reply=value=>port?.postMessage(value);

  if(MAINTENANCE_MODE){
    reply({ok:false,maintenance:true,error:'Service Worker desativado durante manutenção.'});
    return;
  }

  if(msg.type==='SKIP_WAITING'){
    event.waitUntil(self.skipWaiting().then(()=>reply({ok:true})));
    return;
  }
  if(msg.type==='CACHE_URLS'){
    event.waitUntil(cacheUrls(msg.payload?.urls).then(reply).catch(error=>reply({ok:false,error:error.message})));
    return;
  }
  if(msg.type==='CLEAR_OFFLINE'){
    event.waitUntil(caches.delete(OFFLINE).then(()=>reply({ok:true})).catch(error=>reply({ok:false,error:error.message})));
    return;
  }
  if(msg.type==='CACHE_INFO'){
    event.waitUntil(cacheCounts().then(reply).catch(error=>reply({ok:false,error:error.message})));
  }
});
