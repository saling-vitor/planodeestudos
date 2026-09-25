(()=>{
'use strict';
const API={version:'3.1'};
const RUNTIME_KEY='planoarq:runtime-flags:v1';
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
  k===RUNTIME_KEY||k==='planoarq:preferences:v1'||k.startsWith('planoarq:supabase-')||k.startsWith('planoarq:sync-')||k.startsWith('planoarq:drive-')||k.startsWith('planoarq:last-drive')||
  k.startsWith('planoarq:last-sync')||k.startsWith('planoarq:reset::')||k.startsWith('planoarq:preview-demo')
);
const tracked=k=>!!k&&(k.startsWith('planoarq:')||k.startsWith('mindmap_state::')||k.startsWith('mindmap_notes::'))&&!privateKey(k);
function uuid(){if(globalThis.crypto?.randomUUID)return crypto.randomUUID();return 'dev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}
function deviceId(){let id=localStorage.getItem('planoarq:device-id:v1');if(!id){id=uuid();localStorage.setItem('planoarq:device-id:v1',id)}return id}
function deviceName(){let n=localStorage.getItem('planoarq:device-name:v1');if(n)return n;const ua=navigator.userAgent||'';const os=/Windows/i.test(ua)?'Windows':/iPad|Macintosh.*Mobile/i.test(ua)?'iPad':/iPhone/i.test(ua)?'iPhone':/Macintosh/i.test(ua)?'Mac':/Android/i.test(ua)?'Android':'Dispositivo';const br=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':/Firefox\//.test(ua)?'Firefox':'Navegador';n=`${br} · ${os}`;localStorage.setItem('planoarq:device-name:v1',n);return n}
function setDeviceName(n){n=String(n||'').trim();if(n)localStorage.setItem('planoarq:device-name:v1',n);else localStorage.removeItem('planoarq:device-name:v1');return deviceName()}
function keys(){const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(tracked(k))out.push(k)}return out.sort()}
function materialsForContest(cid){return (window.PLANO_ARQ_MATERIALS?.materials||[]).filter(m=>!m.contestId||m.contestId===cid)}
function contestKeys(cid){const materials=materialsForContest(cid),exact=[`planoarq:planning::${cid}`,`planoarq:generated-plan::${cid}`,`planoarq:session-log::${cid}`,`planoarq:review-activity::${cid}`,`planoarq:file-favorites::${cid}`],namespaces=new Set(materials.map(m=>m.storageNamespace).filter(Boolean)),materialIds=new Set(materials.map(m=>m.id).filter(Boolean));const dynamic=keys().filter(k=>exact.includes(k)||[...namespaces].some(ns=>k===`mindmap_state::${ns}`||k===`mindmap_notes::${ns}`)||[...materialIds].some(id=>k===`planoarq:material-summary::${id}`)||k.includes(`::${cid}`));return [...new Set(dynamic)].sort()}
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
Object.assign(API,{RUNTIME_KEY,runtimeFlags,isMaintenanceMode,canRunBackgroundServices,setMaintenanceMode,deviceId,deviceName,setDeviceName,keys,tracked,privateKey,contestKeys,collect,buildBackup,exportBackup,inspect,readFile,importEntries,dataHealth,resetContest,resetDeviceId,materialsForContest});
window.PLANO_ARQ_DATA=API;
})();