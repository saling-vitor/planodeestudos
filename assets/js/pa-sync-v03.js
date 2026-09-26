(()=>{
'use strict';
const VERSION='3.1';
const CONFIG_KEY='planoarq:supabase-config:v1',SESSION_KEY='planoarq:supabase-session:v1',SETTINGS_KEY='planoarq:sync-settings:v1';
const D=()=>window.PLANO_ARQ_DATA;
const maintenance=()=>D()?.isMaintenanceMode?.()===true;
const staticCfg=()=>window.PLANO_ARQ_CLOUD||{};
const safeJSON=(v,f)=>{try{return JSON.parse(v)??f}catch(_){return f}};
const now=()=>new Date().toISOString();
let syncing=false,timer=null,queued=null,applyingRemote=false,patched=false;
function normalizeUrl(v){return String(v||'').trim().replace(/\/+$/,'')}
function config(){const l=safeJSON(localStorage.getItem(CONFIG_KEY),{}),s=staticCfg().supabase||{},storage=s.storage||{};return {url:normalizeUrl(l.url||s.url||''),key:String(l.key||l.publishableKey||l.anonKey||s.publishableKey||s.anonKey||'').trim(),storage:{enabled:storage.enabled!==false,bucket:String(storage.bucket||'plano-arq-contest-files').trim(),private:storage.private!==false,maxFileSizeBytes:Number(storage.maxFileSizeBytes||83886080)}}}
function saveConfig(c){const v={url:normalizeUrl(c.url),key:String(c.key||'').trim(),savedAt:now()};localStorage.setItem(CONFIG_KEY,JSON.stringify(v));const sess=session();if(sess&&sess.projectUrl!==v.url)clearSession();emit('config');return v}
function clearConfig(){localStorage.removeItem(CONFIG_KEY);clearSession();emit('config')}
function settings(){return {...{autoSync:true,intervalSeconds:60,firstSyncStrategy:'cloud'},...safeJSON(localStorage.getItem(SETTINGS_KEY),{})}}
function saveSettings(v){const next={...settings(),...v};next.intervalSeconds=Math.max(30,Number(next.intervalSeconds)||60);localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));restartTimer();emit('settings');return next}
function session(){return safeJSON(localStorage.getItem(SESSION_KEY),null)}
function saveSession(raw){if(!raw)return null;const c=config(),expiresAt=raw.expires_at||Math.floor(Date.now()/1000)+Number(raw.expires_in||3600),s={access_token:raw.access_token,refresh_token:raw.refresh_token,token_type:raw.token_type||'bearer',expires_at:expiresAt,user:raw.user||null,projectUrl:c.url,savedAt:now()};localStorage.setItem(SESSION_KEY,JSON.stringify(s));emit('auth');return s}
function clearSession(){localStorage.removeItem(SESSION_KEY);emit('auth')}
function configured(){const c=config();return /^https:\/\/.+\.supabase\.co$/i.test(c.url)&&c.key.length>20}
function headers(auth=false){const c=config(),h={'apikey':c.key,'Content-Type':'application/json'};const s=session();if(auth&&s?.access_token)h.Authorization=`Bearer ${s.access_token}`;return h}
function storageHeaders(contentType=''){const c=config(),s=session(),h={'apikey':c.key};if(s?.access_token)h.Authorization=`Bearer ${s.access_token}`;if(contentType)h['Content-Type']=contentType;return h}
function storageConfigured(){const c=config();return configured()&&c.storage.enabled&&!!c.storage.bucket}
function storagePath(path){return String(path||'').split('/').filter(Boolean).map(encodeURIComponent).join('/')}
function storageSegment(v,fallback='file'){const s=String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'');return s||fallback}
function cloudPathFor(uid,cid,file){const name=storageSegment(file?.filename||file?.name||((file?.id||'arquivo')+'.pdf'),'arquivo.pdf');return [storageSegment(uid,'user'),storageSegment(cid,'contest'),storageSegment(file?.id||'file','file'),name].join('/')}
async function storageUpload(path,blob,contentType='application/octet-stream'){
 const c=config();if(!storageConfigured())throw new Error('Supabase Storage não configurado');await ensureSession();
 let r;try{r=await fetch(`${c.url}/storage/v1/object/${encodeURIComponent(c.storage.bucket)}/${storagePath(path)}`,{method:'POST',headers:{...storageHeaders(contentType),'x-upsert':'true','cache-control':'3600'},body:blob})}catch(_){throw new Error(navigator.onLine===false?'Sem conexão com a internet':'Não foi possível enviar o arquivo ao Supabase Storage')}
 let body=null,text='';try{text=await r.text();body=text?JSON.parse(text):null}catch(_){body=text}
 if(!r.ok){const msg=body?.message||body?.error||body?.msg||`Storage HTTP ${r.status}`;const e=new Error(String(msg));e.status=r.status;throw e}
 return body||{path}
}
async function storageDownload(path){
 const c=config();if(!storageConfigured())throw new Error('Supabase Storage não configurado');await ensureSession();
 let r;try{r=await fetch(`${c.url}/storage/v1/object/authenticated/${encodeURIComponent(c.storage.bucket)}/${storagePath(path)}`,{headers:storageHeaders()})}catch(_){throw new Error(navigator.onLine===false?'Sem conexão com a internet':'Não foi possível baixar o arquivo do Supabase Storage')}
 if(!r.ok){let msg=`Storage HTTP ${r.status}`;try{const b=await r.json();msg=b?.message||b?.error||b?.msg||msg}catch(_){}const e=new Error(String(msg));e.status=r.status;throw e}
 return await r.blob()
}
async function ensureContestFileLocal(cid,file){
 const d=D();if(!d?.contestBlob||!d?.storeContestBlob)throw new Error('Armazenamento local de arquivos indisponível');
 let rec=await d.contestBlob(cid,file.id);if(rec?.blob)return rec;
 if(!file.cloudPath)throw new Error('Este arquivo ainda existe somente no dispositivo de origem');
 const blob=await storageDownload(file.cloudPath);
 await d.storeContestBlob(cid,file.id,blob,{name:file.filename||file.title||file.id,type:file.mimeType||blob.type||'application/pdf',size:blob.size});
 return await d.contestBlob(cid,file.id)
}
async function reconcileContestFiles(uid){
 const d=D(),out={ok:true,uploaded:0,downloaded:0,alreadyLocal:0,metadataChanged:0,errors:[]};if(!d?.contests||!d?.contestFiles||!d?.contestBlob)return out;
 if(!storageConfigured())return {...out,ok:false,reason:'storage-not-configured'};
 for(const contest of d.contests()){
  const cid=contest?.id;if(!cid)continue;
  const files=d.contestFiles(cid).filter(f=>f&&(String(f.storage||'').includes('indexeddb')||f.cloudPath||f.localOnly));
  for(const file of files){
   try{
    const local=await d.contestBlob(cid,file.id),contentAt=Date.parse(file.contentUpdatedAt||0)||0,cloudAt=Date.parse(file.cloudSyncedAt||0)||0;
    if(local?.blob&&(!file.cloudPath||!file.cloudSyncedAt||contentAt>cloudAt)){
      const path=file.cloudPath||cloudPathFor(uid,cid,file);
      await storageUpload(path,local.blob,file.mimeType||local.type||local.blob.type||'application/pdf');
      d.upsertContestFile(cid,{...file,storage:'supabase+indexeddb',cloudBucket:config().storage.bucket,cloudPath:path,cloudSyncedAt:now(),localOnly:false});
      out.uploaded++;out.metadataChanged++;continue
    }
    if(!local?.blob&&file.cloudPath){await ensureContestFileLocal(cid,file);out.downloaded++;continue}
    if(local?.blob)out.alreadyLocal++
   }catch(err){out.ok=false;out.errors.push({contestId:cid,fileId:file.id,message:err?.message||String(err),status:err?.status||0})}
  }
 }
 localStorage.setItem('planoarq:last-file-sync-summary',JSON.stringify({...out,at:now()}));return out
}
async function jsonFetch(url,opts={}){let r;try{r=await fetch(url,opts)}catch(err){throw new Error(navigator.onLine===false?'Sem conexão com a internet':'Não foi possível acessar o Supabase')};let body=null,text='';try{text=await r.text();body=text?JSON.parse(text):null}catch(_){body=text};if(!r.ok){const msg=body?.msg||body?.message||body?.error_description||body?.error||`Erro HTTP ${r.status}`;const e=new Error(String(msg));e.status=r.status;e.body=body;throw e}return body}
async function testConnection(){if(!configured())throw new Error('Informe a Project URL e a Publishable key');const c=config();await jsonFetch(`${c.url}/auth/v1/settings`,{headers:headers(false)});return {ok:true,url:c.url}}
async function sendOtp(email){email=String(email||'').trim().toLowerCase();if(!email||!email.includes('@'))throw new Error('Informe um e-mail válido');if(!configured())throw new Error('Configure o projeto Supabase primeiro');const c=config();await jsonFetch(`${c.url}/auth/v1/otp`,{method:'POST',headers:headers(false),body:JSON.stringify({email,create_user:true})});localStorage.setItem('planoarq:supabase-pending-email:v1',email);emit('otp-sent',{email});return {ok:true,email}}
async function verifyOtp(email,token){email=String(email||localStorage.getItem('planoarq:supabase-pending-email:v1')||'').trim().toLowerCase();token=String(token||'').trim();if(!email||!token)throw new Error('Informe e-mail e código');const c=config(),raw=await jsonFetch(`${c.url}/auth/v1/verify`,{method:'POST',headers:headers(false),body:JSON.stringify({email,token,type:'email'})});const s=saveSession(raw);localStorage.removeItem('planoarq:supabase-pending-email:v1');return s}
async function refreshSession(){const s=session();if(!s?.refresh_token)throw new Error('Sessão não encontrada');const c=config(),raw=await jsonFetch(`${c.url}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:headers(false),body:JSON.stringify({refresh_token:s.refresh_token})});return saveSession(raw)}
async function ensureSession(){let s=session();if(!s?.access_token)return null;if((Number(s.expires_at||0)*1000)-Date.now()<90000){try{s=await refreshSession()}catch(err){if([400,401,403].includes(err.status))clearSession();throw err}}return s}
async function signOut(){const s=session();if(s?.access_token&&configured()){const c=config();try{await fetch(`${c.url}/auth/v1/logout`,{method:'POST',headers:headers(true)})}catch(_){}}clearSession();return {ok:true}}
function syncable(k){if(!k)return false;if(k.startsWith('mindmap_state::')||k.startsWith('mindmap_notes::'))return true;if(!k.startsWith('planoarq:'))return false;return !(
 k==='planoarq:device-id:v1'||k==='planoarq:device-name:v1'||k==='planoarq:active-contest:v1'||k==='planoarq:active-contest'||k==='planoarq:activeContest'||k==='planoarq:preferences:v1'||k==='planoarq:runtime-flags:v1'||k==='planoarq:settings-lock:v1'||
 k.startsWith('planoarq:supabase-')||k.startsWith('planoarq:sync-')||k.startsWith('planoarq:drive-')||k.startsWith('planoarq:recovery::')||k==='planoarq:last-recovery:v1'||k.startsWith('planoarq:last-drive')||k.startsWith('planoarq:last-sync')||k.startsWith('planoarq:last-backup')||k.startsWith('planoarq:reset::')||k.startsWith('planoarq:preview-demo')
)}
function allLocalKeys(){const a=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(syncable(k))a.push(k)}return a.sort()}
function hash(s){s=String(s??'');let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
function keyContest(k){const prefix=k.startsWith('mindmap_state::')?'mindmap_state::':k.startsWith('mindmap_notes::')?'mindmap_notes::':'';if(prefix){const ns=k.slice(prefix.length),m=(window.PLANO_ARQ_MATERIALS?.materials||[]).find(x=>x.storageNamespace===ns);return m?.contestId||'global'}const local=safeJSON(localStorage.getItem('planoarq:contests:v1'),[]),ids=[...(window.PLANO_ARQ_CONTESTS?.contests||[]),...(Array.isArray(local)?local:[])].map(x=>x?.id).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>b.length-a.length);const hit=ids.find(id=>k.includes(`::${id}`));return hit||'global'}
function keyNamespace(k){if(k.startsWith('mindmap_state::'))return'mindmap_state';if(k.startsWith('mindmap_notes::'))return'mindmap_notes';const i=k.indexOf('::');return i>0?k.slice(0,i):k.split(':').slice(0,2).join(':')}
function metaKey(uid){return`planoarq:sync-meta:v2::${uid}`}
function loadMeta(uid){return {...{version:2,userId:uid,firstSyncCompleted:false,lastSyncAt:'',records:{}},...safeJSON(localStorage.getItem(metaKey(uid)),{})}}
function saveMeta(uid,m){m.userId=uid;m.version=2;localStorage.setItem(metaKey(uid),JSON.stringify(m))}
function scanLocal(meta){const current=new Set(allLocalKeys()),dev=D()?.deviceId?.()||'unknown',stamp=now();for(const k of current){const val=localStorage.getItem(k),h=hash(val),r=meta.records[k];if(!r){meta.records[k]={hash:h,updatedAt:stamp,deviceId:dev,deleted:false,dirty:true,remoteUpdatedAt:''}}else if(r.hash!==h||r.deleted){Object.assign(r,{hash:h,updatedAt:stamp,deviceId:dev,deleted:false,dirty:true})}}for(const [k,r] of Object.entries(meta.records)){if(!syncable(k))continue;if(!current.has(k)&&!r.deleted){Object.assign(r,{hash:'',updatedAt:stamp,deviceId:dev,deleted:true,dirty:true})}}return meta}
function rowFromLocal(k,r){return {contest_id:keyContest(k),namespace:keyNamespace(k),record_key:k,payload:r.deleted?{}:{value:localStorage.getItem(k)},updated_at:r.updatedAt,device_id:r.deviceId||D()?.deviceId?.()||'unknown',deleted:!!r.deleted}}
async function pullRemote(){if(maintenance())throw new Error('Sincronização pausada pelo modo manutenção');const c=config(),s=await ensureSession();if(!s)throw new Error('Entre na sua conta para sincronizar');const select='contest_id,namespace,record_key,payload,updated_at,device_id,deleted';return await jsonFetch(`${c.url}/rest/v1/plano_arq_sync_records?select=${encodeURIComponent(select)}&order=updated_at.asc`,{headers:headers(true)})||[]}
async function pushRemote(rows){if(maintenance())throw new Error('Sincronização pausada pelo modo manutenção');if(!rows.length)return[];const c=config();await ensureSession();return await jsonFetch(`${c.url}/rest/v1/rpc/plano_arq_upsert_sync_records`,{method:'POST',headers:{...headers(true),'Prefer':'return=representation'},body:JSON.stringify({p_records:rows})})||[]}
function cmp(aTime,aDev,bTime,bDev){const a=Date.parse(aTime||0)||0,b=Date.parse(bTime||0)||0;if(a!==b)return a>b?1:-1;return String(aDev||'').localeCompare(String(bDev||''))}
function applyRemoteRow(row,meta){const k=row.record_key,r=meta.records[k]||{};applyingRemote=true;try{if(row.deleted)localStorage.removeItem(k);else localStorage.setItem(k,String(row.payload?.value??''))}finally{applyingRemote=false}meta.records[k]={hash:row.deleted?'':hash(String(row.payload?.value??'')),updatedAt:row.updated_at,deviceId:row.device_id,deleted:!!row.deleted,dirty:false,remoteUpdatedAt:row.updated_at,remoteDeviceId:row.device_id};return meta.records[k]}
function firstSyncPreviewFrom(remote,meta){const byRemote=new Map((remote||[]).filter(r=>syncable(r?.record_key)).map(r=>[r.record_key,r])),keys=new Set([...Object.keys(meta.records||{}),...byRemote.keys()]),out={firstSync:!meta.firstSyncCompleted,remoteRecords:byRemote.size,additions:0,replacements:0,deletions:0,localOnly:0,unchanged:0,totalChanges:0,affectedKeys:[]};for(const k of keys){if(!syncable(k))continue;const lr=meta.records[k],rr=byRemote.get(k);if(rr&&lr){const remoteChanged=!lr.remoteUpdatedAt||lr.remoteUpdatedAt!==rr.updated_at||lr.remoteDeviceId!==rr.device_id;if(remoteChanged){out.affectedKeys.push(k);if(rr.deleted)out.deletions++;else out.replacements++}else out.unchanged++}else if(rr&&!lr){out.affectedKeys.push(k);if(rr.deleted)out.deletions++;else out.additions++}else if(lr&&!rr)out.localOnly++}out.affectedKeys=[...new Set(out.affectedKeys)];out.totalChanges=out.additions+out.replacements+out.deletions;return out}
async function previewFirstSync(){if(maintenance())return{ok:false,reason:'maintenance'};if(!configured())return{ok:false,reason:'not-configured'};const s=await ensureSession();if(!s?.user?.id)return{ok:false,reason:'not-authenticated'};const meta=scanLocal(loadMeta(s.user.id));if(meta.firstSyncCompleted)return{ok:true,firstSync:false,alreadyCompleted:true,totalChanges:0,affectedKeys:[]};const remote=await pullRemote();return{ok:true,...firstSyncPreviewFrom(remote,meta)}}
function createSyncRecovery(reason,affectedKeys,meta={}){const fn=D()?.createRecoveryPoint;if(typeof fn!=='function')throw new Error('Proteção de recuperação indisponível; sincronização cancelada por segurança.');return fn(reason,affectedKeys,meta)}
async function syncNow(opts={}){if(maintenance())return {ok:false,reason:'maintenance',maintenance:true};if(syncing)return {ok:false,reason:'already-syncing'};if(!configured())return {ok:false,reason:'not-configured'};let sess;try{sess=await ensureSession()}catch(err){emit('error',{message:err.message});throw err}if(!sess?.user?.id)return {ok:false,reason:'not-authenticated'};syncing=true;emit('syncing',{reason:opts.reason||'manual'});const uid=sess.user.id,meta=scanLocal(loadMeta(uid)),summary={ok:true,pulled:0,pushed:0,remoteApplied:0,localKept:0,conflicts:0,deletions:0,recoveryIds:[],startedAt:now()};try{
 const remote=await pullRemote();summary.pulled=remote.length;
 const firstPreview=!meta.firstSyncCompleted?firstSyncPreviewFrom(remote,meta):null;
 if(firstPreview?.totalChanges&&opts.firstSyncConfirmed!==true){summary.ok=false;summary.reason='first-sync-confirmation-required';summary.preview=firstPreview;summary.finishedAt=now();emit('first-sync-confirmation-required',{preview:firstPreview});return summary}
 if(firstPreview?.totalChanges){const rp=createSyncRecovery('first-sync',firstPreview.affectedKeys,{remoteRecords:firstPreview.remoteRecords,replacements:firstPreview.replacements,additions:firstPreview.additions,deletions:firstPreview.deletions});summary.recoveryIds.push(rp.id)}
 const byRemote=new Map(remote.map(r=>[r.record_key,r])),push=[],keys=new Set([...Object.keys(meta.records),...byRemote.keys()]);
 if(meta.firstSyncCompleted){const conflictKeys=[];for(const k of keys){if(!syncable(k))continue;const lr=meta.records[k],rr=byRemote.get(k);if(!lr||!rr||!lr.dirty)continue;const remoteChanged=!lr.remoteUpdatedAt||lr.remoteUpdatedAt!==rr.updated_at||lr.remoteDeviceId!==rr.device_id;if(remoteChanged)conflictKeys.push(k)}if(conflictKeys.length){const rp=createSyncRecovery('sync-conflict',conflictKeys,{count:conflictKeys.length});summary.recoveryIds.push(rp.id)}}
 for(const k of keys){if(!syncable(k))continue;const lr=meta.records[k],rr=byRemote.get(k);if(rr&&lr){const remoteChanged=!lr.remoteUpdatedAt||lr.remoteUpdatedAt!==rr.updated_at||lr.remoteDeviceId!==rr.device_id;const localDirty=!!lr.dirty;if(!meta.firstSyncCompleted&&remoteChanged){applyRemoteRow(rr,meta);summary.remoteApplied++;if(rr.deleted)summary.deletions++;continue}if(localDirty&&remoteChanged){summary.conflicts++;const c=cmp(lr.updatedAt,lr.deviceId,rr.updated_at,rr.device_id);if(c>0){push.push(rowFromLocal(k,lr));summary.localKept++}else{applyRemoteRow(rr,meta);summary.remoteApplied++;if(rr.deleted)summary.deletions++}continue}if(remoteChanged&&!localDirty){applyRemoteRow(rr,meta);summary.remoteApplied++;if(rr.deleted)summary.deletions++;continue}if(localDirty&&!remoteChanged){push.push(rowFromLocal(k,lr));continue}lr.remoteUpdatedAt=rr.updated_at;lr.remoteDeviceId=rr.device_id;lr.dirty=false
 }else if(lr&&!rr){if(!lr.deleted||lr.dirty)push.push(rowFromLocal(k,lr))}else if(rr&&!lr){applyRemoteRow(rr,meta);summary.remoteApplied++;if(rr.deleted)summary.deletions++}}
 if(push.length){await pushRemote(push);summary.pushed=push.length;const authoritative=await pullRemote();for(const row of authoritative){const lr=meta.records[row.record_key];if(!lr||cmp(row.updated_at,row.device_id,lr.updatedAt,lr.deviceId)>=0)applyRemoteRow(row,meta);else if(lr){lr.remoteUpdatedAt=row.updated_at;lr.remoteDeviceId=row.device_id}}}
 const fileSummary=await reconcileContestFiles(uid);summary.files=fileSummary;
 if(fileSummary.metadataChanged){scanLocal(meta);const fileRows=Object.entries(meta.records).filter(([k,r])=>k.startsWith('planoarq:contest-files::')&&r.dirty).map(([k,r])=>rowFromLocal(k,r));if(fileRows.length){await pushRemote(fileRows);const refreshed=await pullRemote(),wanted=new Set(fileRows.map(r=>r.record_key));refreshed.filter(r=>wanted.has(r.record_key)).forEach(r=>applyRemoteRow(r,meta));summary.pushed+=fileRows.length}}
 meta.firstSyncCompleted=true;meta.lastSyncAt=now();saveMeta(uid,meta);localStorage.setItem('planoarq:last-sync-at',meta.lastSyncAt);localStorage.setItem('planoarq:last-sync-summary',JSON.stringify(summary));summary.finishedAt=meta.lastSyncAt;emit('synced',summary);return summary
 }catch(err){emit('error',{message:err.message,status:err.status||0});throw err}finally{syncing=false}}
function status(){const c=config(),s=session(),set=settings(),last=safeJSON(localStorage.getItem('planoarq:last-sync-summary'),null),fileLast=safeJSON(localStorage.getItem('planoarq:last-file-sync-summary'),null),paused=maintenance(),meta=s?.user?.id?loadMeta(s.user.id):null;return {version:VERSION,mode:paused?'maintenance-local':'local-first',maintenance:paused,configured:configured(),project:{url:c.url,keyPresent:!!c.key},auth:{signedIn:!!s?.user?.id,email:s?.user?.email||'',userId:s?.user?.id||'',expiresAt:s?.expires_at||0},sync:{running:syncing,autoSync:paused?false:!!set.autoSync,configuredAutoSync:!!set.autoSync,paused,intervalSeconds:set.intervalSeconds,firstSyncCompleted:!!meta?.firstSyncCompleted,lastSyncAt:localStorage.getItem('planoarq:last-sync-at')||'',last},storage:{configured:storageConfigured(),bucket:c.storage.bucket,private:c.storage.private,last:fileLast},local:{keys:allLocalKeys().length},device:{id:D()?.deviceId?.()||'',name:D()?.deviceName?.()||''}}}
function emit(state,detail={}){const d={state,...detail,status:status()};window.dispatchEvent(new CustomEvent('planoarq:sync-status',{detail:d}))}
function queueAutoSync(delay=3500){if(maintenance()||applyingRemote||!settings().autoSync||!configured()||!session()?.user?.id)return;clearTimeout(queued);queued=setTimeout(()=>{if(document.visibilityState==='visible'&&navigator.onLine!==false)syncNow({reason:'local-change'}).catch(()=>{})},delay)}
function patchStorage(){if(patched)return;patched=true;const proto=Storage.prototype,origSet=proto.setItem,origRemove=proto.removeItem;proto.setItem=function(k,v){const old=this===localStorage?this.getItem(k):null,ret=origSet.call(this,k,v);if(this===localStorage&&syncable(k)&&old!==String(v)&&!applyingRemote)queueAutoSync();return ret};proto.removeItem=function(k){const had=this===localStorage?this.getItem(k)!==null:false,ret=origRemove.call(this,k);if(this===localStorage&&syncable(k)&&had&&!applyingRemote)queueAutoSync();return ret}}
function restartTimer(){if(timer)clearInterval(timer);timer=null;if(maintenance())return;const set=settings();if(set.autoSync)timer=setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine!==false&&configured()&&session()?.user?.id)syncNow({reason:'interval'}).catch(()=>{})},Math.max(30,Number(set.intervalSeconds)||60)*1000)}
function startAutoSync(){if(maintenance()){stopAutoSync();emit('maintenance',{paused:true});return status()}patchStorage();restartTimer();if(!document.documentElement.dataset.paSyncLifecycle){document.documentElement.dataset.paSyncLifecycle='1';window.addEventListener('online',()=>queueAutoSync(500));window.addEventListener('focus',()=>queueAutoSync(800));document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueAutoSync(900)});window.addEventListener('storage',e=>{if(syncable(e.key))queueAutoSync(1200)})}if(settings().autoSync&&configured()&&session()?.user?.id)queueAutoSync(1400);return status()}
function stopAutoSync(){if(timer)clearInterval(timer);timer=null;clearTimeout(queued);queued=null}
window.addEventListener('planoarq:runtime-flags',e=>{if(e.detail?.maintenanceMode){stopAutoSync();emit('maintenance',{paused:true})}else startAutoSync()});
window.PLANO_ARQ_SYNC={version:VERSION,config,saveConfig,clearConfig,settings,saveSettings,status,testConnection,sendOtp,verifyOtp,refreshSession,ensureSession,signOut,session,clearSession,previewFirstSync,syncNow,startAutoSync,stopAutoSync,syncable,storageConfigured,storageUpload,storageDownload,ensureContestFileLocal,reconcileContestFiles};
})();