(()=>{
'use strict';
const API={version:'3.5'};
const RUNTIME_KEY='planoarq:runtime-flags:v1';
const CONTESTS_KEY='planoarq:contests:v1',EXAM_SCHEMA_PREFIX='planoarq:exam-schema::',CONTEST_FILES_PREFIX='planoarq:contest-files::',CONTEST_MATERIALS_PREFIX='planoarq:contest-materials::',IMPORT_DRAFT_PREFIX='planoarq:contest-import-draft::';
const safeJSON=(v,f)=>{try{return JSON.parse(v)??f}catch(_){return f}};
const iso=()=>new Date().toISOString();
function runtimeFlags(){
 const raw=safeJSON(localStorage.getItem(RUNTIME_KEY),null);
 return raw&&typeof raw==='object'?{maintenanceMode:raw.maintenanceMode!==false}:{maintenanceMode:true};
}
function isMaintenanceMode(){return runtimeFlags().maintenanceMode===true}
function canRunBackgroundServices(){return !isMaintenanceMode()}
function setMaintenanceMode(enabled){
 const next={maintenanceMode:!!enabled,updatedAt:iso()};
 localStorage.setItem(RUNTIME_KEY,JSON.stringify(next));
 document.documentElement.dataset.paMaintenance=next.maintenanceMode?'1':'0';
 window.dispatchEvent(new CustomEvent('planoarq:runtime-flags',{detail:{...next}}));
 return next;
}
if(localStorage.getItem(RUNTIME_KEY)===null)localStorage.setItem(RUNTIME_KEY,JSON.stringify({maintenanceMode:true,updatedAt:iso(),source:'temporary-development-mode'}));
document.documentElement.dataset.paMaintenance=isMaintenanceMode()?'1':'0';
const privateKey=k=>!!k&&(
  k==='planoarq:device-id:v1'||k==='planoarq:device-name:v1'||k==='planoarq:active-contest:v1'||k==='planoarq:active-contest'||k==='planoarq:activeContest'||
  k===RUNTIME_KEY||k==='planoarq:settings-lock:v1'||k==='planoarq:preferences:v1'||k.startsWith('planoarq:supabase-')||k.startsWith('planoarq:sync-')||k.startsWith('planoarq:drive-')||k.startsWith('planoarq:last-drive')||
  k.startsWith('planoarq:last-sync')||k.startsWith('planoarq:reset::')||k.startsWith('planoarq:preview-demo')
);
const tracked=k=>!!k&&(k.startsWith('planoarq:')||k.startsWith('mindmap_state::')||k.startsWith('mindmap_notes::'))&&!privateKey(k);
function uuid(){if(globalThis.crypto?.randomUUID)return crypto.randomUUID();return 'dev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}
function deviceId(){let id=localStorage.getItem('planoarq:device-id:v1');if(!id){id=uuid();localStorage.setItem('planoarq:device-id:v1',id)}return id}
function deviceName(){let n=localStorage.getItem('planoarq:device-name:v1');if(n)return n;const ua=navigator.userAgent||'';const os=/Windows/i.test(ua)?'Windows':/iPad|Macintosh.*Mobile/i.test(ua)?'iPad':/iPhone/i.test(ua)?'iPhone':/Macintosh/i.test(ua)?'Mac':/Android/i.test(ua)?'Android':'Dispositivo';const br=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':/Firefox\//.test(ua)?'Firefox':'Navegador';n=`${br} · ${os}`;localStorage.setItem('planoarq:device-name:v1',n);return n}
function setDeviceName(n){n=String(n||'').trim();if(n)localStorage.setItem('planoarq:device-name:v1',n);else localStorage.removeItem('planoarq:device-name:v1');return deviceName()}
function keys(){const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(tracked(k))out.push(k)}return out.sort()}
function localContests(){const v=safeJSON(localStorage.getItem(CONTESTS_KEY),[]);return Array.isArray(v)?v.filter(x=>x&&typeof x==='object'&&x.id):[]}
function contests(){const seed=window.PLANO_ARQ_CONTESTS?.contests||[],by=new Map(seed.filter(x=>x?.id).map(x=>[x.id,{...x}]));localContests().forEach(x=>by.set(x.id,{...(by.get(x.id)||{}),...x}));return [...by.values()]}
function contestById(cid){return contests().find(x=>x.id===cid)||null}
function saveContest(record){if(!record||!record.id)throw new Error('Concurso sem ID');const local=localContests(),i=local.findIndex(x=>x.id===record.id),next={...(i>=0?local[i]:{}),...record,updatedAt:iso()};if(i>=0)local[i]=next;else local.push(next);localStorage.setItem(CONTESTS_KEY,JSON.stringify(local));return next}
function examSchemaKey(cid){return EXAM_SCHEMA_PREFIX+cid}
function examSchemaForContest(cid){const local=safeJSON(localStorage.getItem(examSchemaKey(cid)),null);if(local&&typeof local==='object')return local;const c=contestById(cid)||{},id=c.examSchemaId||cid;return (window.PLANO_ARQ_EXAM_SCHEMAS?.schemas||[]).find(x=>x.id===id)||null}
function saveExamSchema(cid,schema){if(!cid||!schema||typeof schema!=='object'||Array.isArray(schema))throw new Error('Estrutura da prova inválida');const next={...schema,id:schema.id||cid,contestId:cid,source:schema.source||'user-import',updatedAt:iso()};localStorage.setItem(examSchemaKey(cid),JSON.stringify(next));return next}
function contestFilesKey(cid){return CONTEST_FILES_PREFIX+cid}
function contestFiles(cid){const staticFiles=(window.PLANO_ARQ_FILES?.files||[]).filter(f=>!f.contestId||f.contestId===cid),local=safeJSON(localStorage.getItem(contestFilesKey(cid)),[]),by=new Map();staticFiles.forEach(f=>by.set(f.id||f.path,{...f}));(Array.isArray(local)?local:[]).forEach(f=>{if(f&&typeof f==='object'){const id=f.id||f.path||f.storageKey;if(id)by.set(id,{...(by.get(id)||{}),...f,contestId:cid})}});return [...by.values()]}
function saveContestFiles(cid,files){if(!cid||!Array.isArray(files))throw new Error('Lista de documentos inválida');const clean=files.filter(f=>f&&typeof f==='object'&&(f.id||f.path||f.storageKey)).map(f=>({...f,contestId:cid}));localStorage.setItem(contestFilesKey(cid),JSON.stringify(clean));return clean}
function upsertContestFile(cid,file){const files=safeJSON(localStorage.getItem(contestFilesKey(cid)),[]),list=Array.isArray(files)?files:[],id=file?.id||file?.path||file?.storageKey;if(!cid||!id)throw new Error('Documento sem identificação');const i=list.findIndex(x=>(x.id||x.path||x.storageKey)===id),next={...(i>=0?list[i]:{}),...file,contestId:cid,updatedAt:iso()};if(i>=0)list[i]=next;else list.push(next);saveContestFiles(cid,list);return next}
function importDraftKey(id){return IMPORT_DRAFT_PREFIX+id}
function loadImportDraft(id){return safeJSON(localStorage.getItem(importDraftKey(id)),null)}
function saveImportDraft(id,draft){if(!id||!draft||typeof draft!=='object')throw new Error('Rascunho de importação inválido');const next={...draft,id,updatedAt:iso()};localStorage.setItem(importDraftKey(id),JSON.stringify(next));return next}
function clearImportDraft(id){localStorage.removeItem(importDraftKey(id))}
const LOCAL_FILE_DB='planoarq-local-files-v1',LOCAL_FILE_STORE='files';
let localFileDbPromise=null;
function localFileDb(){
 if(!('indexedDB' in globalThis))return Promise.reject(new Error('Armazenamento local de arquivos indisponível neste navegador'));
 if(localFileDbPromise)return localFileDbPromise;
 localFileDbPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(LOCAL_FILE_DB,1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(LOCAL_FILE_STORE)){const s=db.createObjectStore(LOCAL_FILE_STORE,{keyPath:'key'});s.createIndex('contestId','contestId',{unique:false})}};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Falha ao abrir armazenamento local de arquivos'));
 });
 return localFileDbPromise
}
async function storeContestBlob(cid,fileId,blob,meta={}){
 if(!cid||!fileId||!blob)throw new Error('Arquivo local inválido');
 const db=await localFileDb(),key=cid+'::'+fileId,record={key,contestId:cid,fileId,blob,name:meta.name||blob.name||'',type:meta.type||blob.type||'application/octet-stream',size:Number(meta.size||blob.size||0),updatedAt:iso()};
 await new Promise((resolve,reject)=>{const tx=db.transaction(LOCAL_FILE_STORE,'readwrite');tx.objectStore(LOCAL_FILE_STORE).put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Falha ao salvar arquivo local'));tx.onabort=()=>reject(tx.error||new Error('Gravação do arquivo local cancelada'))});
 return{...record,blob:undefined}
}
async function contestBlob(cid,fileId){
 const db=await localFileDb(),key=cid+'::'+fileId;
 return await new Promise((resolve,reject)=>{const tx=db.transaction(LOCAL_FILE_STORE,'readonly'),req=tx.objectStore(LOCAL_FILE_STORE).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||new Error('Falha ao ler arquivo local'))})
}
async function deleteContestBlob(cid,fileId){
 const db=await localFileDb(),key=cid+'::'+fileId;
 await new Promise((resolve,reject)=>{const tx=db.transaction(LOCAL_FILE_STORE,'readwrite');tx.objectStore(LOCAL_FILE_STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Falha ao remover arquivo local'))});
 return true
}
async function hasContestBlob(cid,fileId){return !!(await contestBlob(cid,fileId))}
function contestMaterialsKey(cid){return CONTEST_MATERIALS_PREFIX+cid}
function localMaterialsForContest(cid){const v=safeJSON(localStorage.getItem(contestMaterialsKey(cid)),[]);return Array.isArray(v)?v.filter(x=>x&&typeof x==='object'&&x.id).map(x=>({...x,contestId:cid,dynamic:true})):[]}
function saveContestMaterials(cid,materials){if(!cid||!Array.isArray(materials))throw new Error('Lista de materiais inválida');const clean=materials.filter(m=>m&&typeof m==='object'&&m.id).map(m=>({...m,contestId:cid,dynamic:true}));localStorage.setItem(contestMaterialsKey(cid),JSON.stringify(clean));return clean}
function upsertContestMaterial(cid,material){if(!cid||!material?.id)throw new Error('Material sem identificação');const list=localMaterialsForContest(cid),i=list.findIndex(x=>x.id===material.id),next={...(i>=0?list[i]:{}),...material,contestId:cid,dynamic:true,updatedAt:iso()};if(i>=0)list[i]=next;else list.push(next);saveContestMaterials(cid,list);return next}
function removeContestMaterial(cid,id){const list=localMaterialsForContest(cid),next=list.filter(x=>x.id!==id);saveContestMaterials(cid,next);return list.length-next.length}
function materialsForContest(cid){const seed=(window.PLANO_ARQ_MATERIALS?.materials||[]).filter(m=>!m.contestId||m.contestId===cid),by=new Map(seed.filter(x=>x?.id).map(x=>[x.id,{...x}]));localMaterialsForContest(cid).forEach(x=>by.set(x.id,{...(by.get(x.id)||{}),...x,contestId:cid,dynamic:true}));return [...by.values()]}
function contestBundle(cid){return {contest:contestById(cid),examSchema:examSchemaForContest(cid),files:contestFiles(cid),materials:materialsForContest(cid)}}
function contestKeys(cid){const materials=materialsForContest(cid),exact=[`planoarq:planning::${cid}`,`planoarq:generated-plan::${cid}`,`planoarq:session-log::${cid}`,`planoarq:review-activity::${cid}`,`planoarq:file-favorites::${cid}`,examSchemaKey(cid),contestFilesKey(cid),contestMaterialsKey(cid)],namespaces=new Set(materials.map(m=>m.storageNamespace).filter(Boolean)),materialIds=new Set(materials.map(m=>m.id).filter(Boolean));const dynamic=keys().filter(k=>exact.includes(k)||[...namespaces].some(ns=>k===`mindmap_state::${ns}`||k===`mindmap_notes::${ns}`)||[...materialIds].some(id=>k===`planoarq:material-summary::${id}`)||k.includes(`::${cid}`));return [...new Set(dynamic)].sort()}
function collect(scope='all',cid=''){const wanted=scope==='contest'?contestKeys(cid):keys(),data={};wanted.forEach(k=>data[k]=localStorage.getItem(k));return data}
function byteSize(data){return new Blob([JSON.stringify(data)]).size}
function buildBackup(scope='all',cid=''){const data=collect(scope,cid);return {schema:'planoarq-backup-v2',version:2,exportedAt:iso(),scope,contestId:scope==='contest'?cid:null,device:{id:deviceId(),name:deviceName()},app:{stage:'12.2',origin:location.origin||'file://'},data,summary:{keys:Object.keys(data).length,bytes:byteSize(data)}}}
function download(payload,name){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);localStorage.setItem('planoarq:last-backup-export',iso())}
function exportBackup(scope='all',cid=''){const p=buildBackup(scope,cid),date=new Date().toISOString().slice(0,10),slug=(cid||'global').replace(/[^a-z0-9-]+/gi,'-');download(p,`Plano_ARQ_${scope==='contest'?slug:'Backup_Global'}_${date}.json`);return p}
function inspect(payload){if(!payload||!['planoarq-backup-v1','planoarq-backup-v2'].includes(payload.schema))throw new Error('Formato de backup incompatível');const data=payload.data||payload.keys;if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Backup sem dados');const entries=Object.entries(data).filter(([k])=>tracked(k));if(!entries.length)throw new Error('Nenhum dado do Plano ARQ encontrado');if(entries.some(([,v])=>typeof v!=='string'))throw new Error('Backup contém registros inválidos');return {entries,scope:payload.scope||'legacy',contestId:payload.contestId||'',exportedAt:payload.exportedAt||'',device:payload.device||null}}
async function readFile(file){return inspect(JSON.parse(await file.text()))}
function importEntries(entries){entries.filter(([k])=>tracked(k)).forEach(([k,v])=>localStorage.setItem(k,String(v)));localStorage.setItem('planoarq:last-backup-import',iso());return entries.length}
function dataHealth(){let parseErrors=0,jsonKeys=0;keys().forEach(k=>{const v=localStorage.getItem(k);if(v&&(/^[\[{]/.test(v.trim()))){jsonKeys++;try{JSON.parse(v)}catch(_){parseErrors++}}});const all=collect();return {keys:Object.keys(all).length,bytes:byteSize(all),parseErrors,jsonKeys,lastExport:localStorage.getItem('planoarq:last-backup-export')||'',lastImport:localStorage.getItem('planoarq:last-backup-import')||''}}
function resetContest(cid){const ks=contestKeys(cid);ks.forEach(k=>localStorage.removeItem(k));localStorage.setItem(`planoarq:reset::${cid}`,iso());return ks.length}
function resetDeviceId(){const id=uuid();localStorage.setItem('planoarq:device-id:v1',id);return id}
Object.assign(API,{RUNTIME_KEY,CONTESTS_KEY,EXAM_SCHEMA_PREFIX,CONTEST_FILES_PREFIX,CONTEST_MATERIALS_PREFIX,IMPORT_DRAFT_PREFIX,runtimeFlags,isMaintenanceMode,canRunBackgroundServices,setMaintenanceMode,deviceId,deviceName,setDeviceName,keys,tracked,privateKey,contestKeys,collect,buildBackup,exportBackup,inspect,readFile,importEntries,dataHealth,resetContest,resetDeviceId,materialsForContest,contestMaterialsKey,localMaterialsForContest,saveContestMaterials,upsertContestMaterial,removeContestMaterial,localContests,contests,contestById,saveContest,examSchemaKey,examSchemaForContest,saveExamSchema,contestFilesKey,contestFiles,saveContestFiles,upsertContestFile,importDraftKey,loadImportDraft,saveImportDraft,clearImportDraft,LOCAL_FILE_DB,LOCAL_FILE_STORE,storeContestBlob,contestBlob,deleteContestBlob,hasContestBlob,contestBundle});
window.PLANO_ARQ_DATA=API;
})();