(()=>{
'use strict';
const VERSION='1.0',ACTIVE='planoarq:active-contest:v1',LEGACY=['planoarq:active-contest','planoarq:activeContest'];
const safeJSON=(v,f)=>{try{return JSON.parse(v)??f}catch(_){return f}};
function contests(){const seed=window.PLANO_ARQ_CONTESTS?.contests||[],local=safeJSON(localStorage.getItem('planoarq:contests:v1'),[]),by=new Map(seed.filter(x=>x?.id).map(x=>[x.id,{...x}]));(Array.isArray(local)?local:[]).forEach(x=>{if(x?.id)by.set(x.id,{...(by.get(x.id)||{}),...x})});return [...by.values()].filter(x=>x.status!=='deleted')}
function explicitId(){const q=new URLSearchParams(location.search).get('contest');if(q)return q;const m=location.hash.match(/^#contest\/([^/?#]+)/);if(m){try{return decodeURIComponent(m[1])}catch(_){return m[1]}}return''}
function storedId(){try{const id=localStorage.getItem(ACTIVE);if(id)return id;for(const k of LEGACY){const v=localStorage.getItem(k);if(v)return v}}catch(_){}return''}
function validId(id){return !!id&&contests().some(x=>x.id===id)}
function clearStored(id=''){try{[ACTIVE,...LEGACY].forEach(k=>{const v=localStorage.getItem(k);if(v&&(!id||v===id))localStorage.removeItem(k)})}catch(_){}}
function setActive(id){id=String(id||'').trim();if(!validId(id)){if(id)clearStored(id);return''}try{localStorage.setItem(ACTIVE,id)}catch(_){}return id}
function fallbackId(){return contests().find(x=>x.status!=='archived')?.id||''}
function resolveId(options={}){
 const explicit=explicitId();if(explicit&&validId(explicit)){if(options.persistExplicit!==false)setActive(explicit);return explicit}
 if(explicit)clearStored(explicit);
 const stored=storedId();if(stored&&validId(stored))return stored;if(stored)clearStored(stored);
 const fallback=fallbackId();if(fallback&&options.persistFallback===true)setActive(fallback);return fallback
}
function current(){const id=resolveId();return id?contests().find(x=>x.id===id)||null:null}
window.PLANO_ARQ_CONTEST_CONTEXT={version:VERSION,ACTIVE,explicitId,storedId,validId,clearStored,setActive,fallbackId,resolveId,contests,current};
})();
