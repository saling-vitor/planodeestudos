(()=>{
'use strict';
const VERSION='1.0',SEVERITY={info:1,warning:2,error:3,critical:4};
let lastResult=null,running=null,timer=0,lastAutoAt=0;
const D=()=>window.PLANO_ARQ_DATA;
const safe=(v,f)=>{try{return JSON.parse(v)??f}catch(_){return f}};
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const iso=()=>new Date().toISOString();
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&!Number.isNaN(Date.parse(String(v)+'T12:00:00'));
function issue(code,severity,title,detail,meta={}){return{code,severity,title,detail,...meta}}
function parsed(key,issues,{requiredType=null,scope='global',contestId=null}={}){
 const raw=localStorage.getItem(key);if(raw===null)return{exists:false,value:null};
 try{const value=JSON.parse(raw);if(requiredType==='array'&&!Array.isArray(value))issues.push(issue('json-shape', 'error','Estrutura local inválida',`${key} deveria ser uma lista.`,{key,scope,contestId}));if(requiredType==='object'&&(value===null||Array.isArray(value)||typeof value!=='object'))issues.push(issue('json-shape','error','Estrutura local inválida',`${key} deveria ser um objeto.`,{key,scope,contestId}));return{exists:true,value}}
 catch(_){issues.push(issue('json-parse','critical','JSON local corrompido',`A chave ${key} não pode ser interpretada com segurança.`,{key,scope,contestId,blocksMutation:true}));return{exists:true,value:null,error:true}}
}
function uniqueProblems(rows,getId,label,issues,contestId){
 const seen=new Map();for(const row of rows||[]){const id=getId(row);if(!id)continue;if(seen.has(id))issues.push(issue('duplicate-id','error',`${label} duplicado`,`O identificador “${id}” aparece mais de uma vez.`,{contestId,ref:id,blocksMutation:true}));else seen.set(id,row)}
}
function topicCatalog(cid){return(window.PLANO_ARQ_QUESTION_CATALOG?.topics||[]).filter(t=>!t.contestId||t.contestId===cid)}
function localContestIds(issues){
 const p=parsed('planoarq:contests:v1',issues,{requiredType:'array'}),rows=Array.isArray(p.value)?p.value:[];uniqueProblems(rows,x=>x?.id,'Concurso local',issues,null);return rows.filter(x=>x&&typeof x==='object'&&x.id)
}
function schemaHealth(cid,contest,issues){
 const schema=D()?.examSchemaForContest?.(cid)||null,planRaw=localStorage.getItem(`planoarq:generated-plan::${cid}`),localSchema=localStorage.getItem(`planoarq:exam-schema::${cid}`),catalogReady=!!window.PLANO_ARQ_EXAM_SCHEMAS,expects=!!(contest?.examSchemaId||contest?.importedEdict||contest?.studyBlueprint||planRaw);
 if(!schema){if(expects&&(catalogReady||localSchema!==null))issues.push(issue('exam-schema-missing','critical','Estrutura da prova ausente','O concurso possui dados dependentes do edital, mas o ExamSchema não está disponível.',{contestId:cid,blocksMutation:true}));return null}
 if(schema.contestId&&schema.contestId!==cid)issues.push(issue('exam-schema-contest-mismatch','critical','ExamSchema ligado ao concurso errado',`O ExamSchema informa ${schema.contestId}, mas está sendo usado por ${cid}.`,{contestId:cid,blocksMutation:true}));
 const stages=Array.isArray(schema.stages)?schema.stages:[],objective=stages.find(x=>x?.type==='objective');
 if(!objective?.sections?.length&&expects)issues.push(issue('objective-structure-missing','error','Estrutura objetiva incompleta','Não há seções objetivas utilizáveis para o planejamento deste concurso.',{contestId:cid,blocksMutation:true}));
 if(objective?.sections?.length)uniqueProblems(objective.sections,x=>x?.id,'Seção da prova',issues,cid);
 return schema
}
function materialHealth(cid,issues){
 const rows=D()?.materialsForContest?.(cid)||[];uniqueProblems(rows,x=>x?.id,'Material',issues,cid);
 const namespaces=new Map();for(const m of rows){if(!m?.id)continue;if(m.src&&!m.storageNamespace)issues.push(issue('material-namespace-missing','warning','Material sem namespace de estudo',`${m.shortCode||m.title||m.id} possui arquivo de estudo, mas não define storageNamespace.`,{contestId:cid,materialId:m.id}));if(m.storageNamespace){const other=namespaces.get(m.storageNamespace);if(other&&other!==m.id)issues.push(issue('material-namespace-collision','critical','Dois materiais compartilham o mesmo estado',`${other} e ${m.id} usam o namespace ${m.storageNamespace}.`,{contestId:cid,materialId:m.id,namespace:m.storageNamespace,blocksMutation:true}));else namespaces.set(m.storageNamespace,m.id)}}
 const local=parsed(`planoarq:contest-materials::${cid}`,issues,{requiredType:'array',scope:'contest',contestId:cid});if(Array.isArray(local.value))uniqueProblems(local.value,x=>x?.id,'Material local',issues,cid);
 return rows
}
function planHealth(cid,materials,issues,validateMaterialRefs=true){
 const ids=new Set((materials||[]).map(x=>x?.id).filter(Boolean)),p=parsed(`planoarq:generated-plan::${cid}`,issues,{requiredType:'object',scope:'contest',contestId:cid});if(!p.exists||!p.value||p.error)return null;const plan=p.value;
 if(plan.contestId&&plan.contestId!==cid)issues.push(issue('plan-contest-mismatch','critical','Plano ligado ao concurso errado',`O plano armazenado informa ${plan.contestId}.`,{contestId:cid,blocksMutation:true}));
 if(!Array.isArray(plan.days)){issues.push(issue('plan-days-invalid','critical','Dias do planejamento inválidos','O planejamento não possui uma lista de dias válida.',{contestId:cid,blocksMutation:true}));return plan}
 const dates=new Set();for(const day of plan.days){if(!validDate(day?.date))issues.push(issue('plan-date-invalid','error','Data inválida no planejamento',`Há um dia de planejamento sem data ISO válida: ${String(day?.date||'—')}.`,{contestId:cid,blocksMutation:true}));else if(dates.has(day.date))issues.push(issue('plan-date-duplicate','error','Dia duplicado no planejamento',`A data ${day.date} aparece mais de uma vez.`,{contestId:cid,blocksMutation:true}));else dates.add(day.date);if(!Array.isArray(day?.sessions)){issues.push(issue('plan-sessions-invalid','error','Sessões inválidas no planejamento',`O dia ${day?.date||'—'} não possui lista de sessões válida.`,{contestId:cid,blocksMutation:true}));continue}day.sessions.forEach((s,index)=>{if(validateMaterialRefs&&s?.materialId&&!ids.has(s.materialId))issues.push(issue('plan-material-orphan','critical','Sessão aponta para material inexistente',`${day.date} · sessão ${index+1} referencia ${s.materialId}.`,{contestId:cid,date:day.date,index,materialId:s.materialId,blocksMutation:true}));if(s?.type&&!['study','questions','review'].includes(s.type))issues.push(issue('plan-session-type','warning','Tipo de sessão desconhecido',`${day.date} · ${String(s.type)}.`,{contestId:cid,date:day.date,index}))})}
 return plan
}
function logHealth(cid,materials,issues,validateMaterialRefs=true){
 const ids=new Set((materials||[]).map(x=>x?.id).filter(Boolean)),p=parsed(`planoarq:session-log::${cid}`,issues,{requiredType:'object',scope:'contest',contestId:cid});if(!p.exists||!p.value||p.error)return null;const log=p.value,sessions=log.sessions;
 if(sessions!=null&&(typeof sessions!=='object'||Array.isArray(sessions)))issues.push(issue('session-log-shape','error','Log de sessões inválido','O histórico de sessões não está em formato de objeto.',{contestId:cid,blocksMutation:true}));
 else for(const [key,row] of Object.entries(sessions||{})){const parts=String(key).split('|'),materialId=parts[2]||'';if(validateMaterialRefs&&materialId&&materialId!=='none'&&!ids.has(materialId))issues.push(issue('session-log-orphan','warning','Histórico aponta para material removido',`A sessão ${key} referencia ${materialId}, que não está no catálogo atual.`,{contestId:cid,key,materialId}));if(row?.status&&!['running','paused','done','skipped','planned'].includes(row.status))issues.push(issue('session-status-invalid','warning','Estado de sessão desconhecido',`${key} usa o estado ${row.status}.`,{contestId:cid,key}))}
 if(log.extras!=null&&!Array.isArray(log.extras))issues.push(issue('session-extras-invalid','warning','Estudos extras em formato inválido','O campo extras do log não é uma lista.',{contestId:cid}));
 if(log.dayClosures!=null&&(typeof log.dayClosures!=='object'||Array.isArray(log.dayClosures)))issues.push(issue('session-closures-invalid','warning','Fechamentos diários em formato inválido','O campo dayClosures do log não é um objeto.',{contestId:cid}));
 return log
}
function reviewHealth(cid,materials,issues,validateMaterialRefs=true){
 const ids=new Set((materials||[]).map(x=>x?.id).filter(Boolean)),topics=topicCatalog(cid),pairs=new Set(topics.map(x=>`${x.materialId}|${x.topicId}`)),catalogReady=topics.length>0;
 const activity=parsed(`planoarq:review-activity::${cid}`,issues,{requiredType:'array',scope:'contest',contestId:cid});if(Array.isArray(activity.value))for(const row of activity.value){if(validateMaterialRefs&&row?.materialId&&!ids.has(row.materialId))issues.push(issue('review-material-orphan','warning','Revisão ligada a material inexistente',`${row.materialId} não está no catálogo atual.`,{contestId:cid,materialId:row.materialId}));if(catalogReady&&row?.materialId&&row?.topicId&&!pairs.has(`${row.materialId}|${row.topicId}`))issues.push(issue('review-topic-orphan','warning','Revisão ligada a tópico inexistente',`${row.materialId} · ${row.topicId} não está no catálogo de questões/revisões atual.`,{contestId:cid,materialId:row.materialId,topicId:row.topicId}))}
 if(catalogReady){const byNs=new Map();for(const t of topics){if(!t.storageNamespace||!t.topicId)continue;const set=byNs.get(t.storageNamespace)||new Set();set.add(t.topicId);byNs.set(t.storageNamespace,set)}for(const m of materials||[]){if(!m?.storageNamespace)continue;const raw=localStorage.getItem('mindmap_state::'+m.storageNamespace);if(raw===null)continue;let st;try{st=JSON.parse(raw)||{}}catch(_){continue}const known=byNs.get(m.storageNamespace);if(!known?.size)continue;for(const bucket of ['topicStates','reviewMeta','quizMeta'])for(const topicId of Object.keys(st?.[bucket]||{}))if(!known.has(topicId))issues.push(issue('map-topic-orphan','warning','Estado de tópico sem vínculo atual',`${m.shortCode||m.id} · ${topicId} existe em ${bucket}, mas não no catálogo atual.`,{contestId:cid,materialId:m.id,topicId,bucket}))}}
}
function fileMetadataHealth(cid,contest,issues){
 const p=parsed(`planoarq:contest-files::${cid}`,issues,{requiredType:'array',scope:'contest',contestId:cid}),files=D()?.contestFiles?.(cid)||[];if(Array.isArray(p.value))uniqueProblems(p.value,x=>x?.id||x?.path||x?.storageKey,'Documento local',issues,cid);
 const ids=new Set();for(const x of files){if(x?.id)ids.add(x.id);if(x?.path)ids.add(x.path);if(x?.storageKey)ids.add(x.storageKey)}const fileCatalogReady=!!window.PLANO_ARQ_FILES||(contest?.source!=='seed'&&localStorage.getItem(`planoarq:contest-files::${cid}`)!==null);if(fileCatalogReady&&contest?.edital&&!ids.has(contest.edital))issues.push(issue('contest-edict-file-missing','error','Edital sem metadado de arquivo',`O concurso aponta para “${contest.edital}”, mas esse arquivo não está catalogado.`,{contestId:cid,fileId:contest.edital,blocksMutation:true}));
 for(const f of files){if(f?.storage==='indexeddb'){const expected=`${cid}::${f.id||''}`;if(f.storageKey&&f.id&&f.storageKey!==expected)issues.push(issue('file-storage-key-mismatch','warning','Vínculo local do PDF inconsistente',`${f.filename||f.title||f.id} usa ${f.storageKey}; esperado ${expected}.`,{contestId:cid,fileId:f.id}))}}
 return files
}
function scanSync(contestId=''){
 const data=D(),issues=[];if(!data)return{version:VERSION,status:'unavailable',checkedAt:iso(),contestId:contestId||null,issues:[],counts:{info:0,warning:0,error:0,critical:0},readOnly:true};
 const health=data.dataHealth?.()||{};if(health.parseErrors)issues.push(issue('tracked-json-errors','critical','Dados locais com JSON inválido',`${health.parseErrors} chave${health.parseErrors===1?'':'s'} rastreada${health.parseErrors===1?'':'s'} não pode${health.parseErrors===1?'':'m'} ser interpretada${health.parseErrors===1?'':'s'}.`,{blocksMutation:true}));
 const locals=localContestIds(issues),all=data.contests?.()||[],active=localStorage.getItem('planoarq:active-contest:v1')||localStorage.getItem('planoarq:active-contest')||'',allIds=new Set(all.map(x=>x.id));
 if(active&&!allIds.has(active))issues.push(issue('active-contest-orphan','warning','Concurso ativo não existe mais',`O dispositivo ainda aponta para ${active}.`,{ref:active}));
 const targets=contestId?all.filter(x=>x.id===contestId):all;
 if(contestId&&!targets.length)issues.push(issue('contest-missing','critical','Concurso não encontrado',`O concurso ${contestId} não está disponível no catálogo atual.`,{contestId,blocksMutation:true}));
 for(const contest of targets){const cid=contest.id;schemaHealth(cid,contest,issues);const mats=materialHealth(cid,issues),materialRefsReady=!!window.PLANO_ARQ_MATERIALS||localStorage.getItem(`planoarq:contest-materials::${cid}`)!==null;planHealth(cid,mats,issues,materialRefsReady);logHealth(cid,mats,issues,materialRefsReady);reviewHealth(cid,mats,issues,materialRefsReady);fileMetadataHealth(cid,contest,issues)}
 const counts={info:0,warning:0,error:0,critical:0};issues.forEach(x=>counts[x.severity]=(counts[x.severity]||0)+1);const max=issues.reduce((a,x)=>Math.max(a,SEVERITY[x.severity]||0),0),status=max>=4?'critical':max>=3?'error':max>=2?'warning':'ok',blockers=issues.filter(x=>x.blocksMutation===true||x.severity==='critical');
 return{version:VERSION,status,checkedAt:iso(),contestId:contestId||null,summary:{contests:targets.length,localContests:locals.length,keys:Number(health.keys||0),bytes:Number(health.bytes||0),jsonKeys:Number(health.jsonKeys||0),parseErrors:Number(health.parseErrors||0)},counts,issues,blockers,readOnly:true,coverage:{contests:!!window.PLANO_ARQ_CONTESTS,materials:!!window.PLANO_ARQ_MATERIALS,examSchemas:!!window.PLANO_ARQ_EXAM_SCHEMAS,topics:!!window.PLANO_ARQ_QUESTION_CATALOG,filesMetadata:!!window.PLANO_ARQ_FILES||targets.some(x=>localStorage.getItem(`planoarq:contest-files::${x.id}`)!==null),indexedDb:false,pwa:false}}
}
async function fileBlobHealth(result){
 const data=D();if(!data?.hasContestBlob)return result;const issues=[...(result.issues||[])],targets=result.contestId?[data.contestById?.(result.contestId)].filter(Boolean):(data.contests?.()||[]);
 for(const contest of targets){const cid=contest.id;for(const f of data.contestFiles?.(cid)||[]){if(f?.storage!=='indexeddb'||!f?.id)continue;try{const exists=await data.hasContestBlob(cid,f.id);if(!exists)issues.push(issue('file-blob-missing',f.localOnly===true?'critical':'error','PDF local não encontrado',`${f.filename||f.title||f.id} possui metadados, mas o arquivo não existe no IndexedDB deste dispositivo.`,{contestId:cid,fileId:f.id,blocksMutation:f.localOnly===true}))}catch(err){issues.push(issue('file-blob-check-failed','warning','Não foi possível verificar um PDF local',err?.message||String(err),{contestId:cid,fileId:f.id}))}}
 return finalize({...result,issues,coverage:{...(result.coverage||{}),indexedDb:true}})
}
async function environmentHealth(result){
 let issues=[...(result.issues||[])],coverage={...(result.coverage||{})};const P=window.PLANO_ARQ_PWA;
 if(P){coverage.pwa=true;try{const st=P.status?.()||{};if(st.lastError)issues.push(issue('pwa-runtime-error','warning','PWA registrou uma falha',st.lastError,{scope:'pwa'}));if(st.controller){const ci=await P.cacheInfo?.();if(ci?.ok&&Number(ci.coreCount||0)===0)issues.push(issue('pwa-core-cache-empty','warning','Cache principal vazio','O Service Worker está ativo, mas o cache principal não contém recursos.',{scope:'pwa'}))}}catch(err){issues.push(issue('pwa-health-check-failed','warning','Não foi possível verificar o PWA',err?.message||String(err),{scope:'pwa'}))}}
 try{const est=await navigator.storage?.estimate?.();if(est?.quota&&est?.usage){const ratio=est.usage/est.quota;if(ratio>=.92)issues.push(issue('storage-near-full','critical','Armazenamento do navegador quase cheio',`${Math.round(ratio*100)}% da cota estimada está em uso.`,{scope:'storage',blocksMutation:true,ratio}));else if(ratio>=.82)issues.push(issue('storage-high','warning','Armazenamento do navegador elevado',`${Math.round(ratio*100)}% da cota estimada está em uso.`,{scope:'storage',ratio}))}}catch(_){}
 return finalize({...result,issues,coverage})
}
function finalize(result){const counts={info:0,warning:0,error:0,critical:0};(result.issues||[]).forEach(x=>counts[x.severity]=(counts[x.severity]||0)+1);const max=(result.issues||[]).reduce((a,x)=>Math.max(a,SEVERITY[x.severity]||0),0),status=max>=4?'critical':max>=3?'error':max>=2?'warning':'ok',blockers=(result.issues||[]).filter(x=>x.blocksMutation===true||x.severity==='critical');return{...result,status,counts,blockers,checkedAt:iso(),readOnly:true}}
async function scan(contestId='',opts={}){if(running&&!contestId)return running;const work=(async()=>{let r=scanSync(contestId);if(opts.files!==false)r=await fileBlobHealth(r);if(opts.environment!==false)r=await environmentHealth(r);lastResult=clone(r);document.documentElement.dataset.paHealth=r.status;window.dispatchEvent(new CustomEvent('planoarq:health-check',{detail:clone(r)}));return r})();if(!contestId)running=work;try{return await work}finally{if(!contestId)running=null}}
function latest(){return clone(lastResult)}
function guard(contestId=''){const r=scanSync(contestId),blockers=(r.blockers||[]).filter(x=>!x.contestId||!contestId||x.contestId===contestId);return{ok:blockers.length===0,status:r.status,contestId:contestId||null,blockers,checkedAt:r.checkedAt,readOnly:true}}
function schedule(delay=1200){clearTimeout(timer);timer=setTimeout(()=>{const now=Date.now();if(now-lastAutoAt<45000)return;lastAutoAt=now;const run=()=>scan('',{files:true,environment:true}).catch(()=>{});if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:4000});else run()},Math.max(0,delay))}
function start(){schedule();window.addEventListener('focus',()=>schedule(800));window.addEventListener('planoarq:adaptive-replan-applied',()=>schedule(250));window.addEventListener('planoarq:post-sim-ready',()=>schedule(250));window.addEventListener('planoarq:error-book-updated',()=>schedule(250));window.addEventListener('storage',()=>schedule(450));return true}
window.PLANO_ARQ_HEALTH={version:VERSION,scanSync,scan,latest,guard,start};
start();
})();