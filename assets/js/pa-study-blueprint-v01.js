(()=>{
'use strict';
const VERSION='1.0',PREFIX='planoarq:study-blueprint::';
const safeJSON=(v,f)=>{try{return JSON.parse(v)??f}catch(_){return f}};
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const fold=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const slug=v=>fold(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'mapa';
const key=cid=>PREFIX+cid;
function hash(v){let h=2166136261;for(const ch of String(v||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function splitTopics(text){
 const src=clean(text);if(!src)return[];
 let parts=src.split(/;\s+|\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g).map(x=>clean(x).replace(/[.;]+$/,'')).filter(x=>x.length>=3);
 if(parts.length<=1&&src.length>260)parts=src.split(/,\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g).map(x=>clean(x).replace(/[.;]+$/,'')).filter(x=>x.length>=3);
 return parts.length?parts:[src]
}
function objective(schema){return (schema?.stages||[]).find(s=>s?.type==='objective')||null}
function sectionWeight(sec,sections){
 const explicit=Number(sec?.planWeight);if(Number.isFinite(explicit)&&explicit>=0)return explicit;
 const pts=sections.map(s=>Number.isFinite(Number(s?.totalPoints))?Number(s.totalPoints):null),allPts=pts.length&&pts.every(v=>v!==null),denPts=allPts?pts.reduce((a,b)=>a+b,0):0;
 if(allPts&&denPts>0)return Math.round((Number(sec.totalPoints)||0)*10000/denPts)/100;
 const qs=sections.map(s=>Number.isFinite(Number(s?.questions))?Number(s.questions):null),allQ=qs.length&&qs.every(v=>v!==null),denQ=allQ?qs.reduce((a,b)=>a+b,0):0;
 if(allQ&&denQ>0)return Math.round((Number(sec.questions)||0)*10000/denQ)/100;
 return sections.length?Math.round(10000/sections.length)/100:0
}
function matchSection(label,sections){
 const target=fold(label);if(!target)return null;
 let exact=sections.find(s=>fold(s.label)===target);if(exact)return exact;
 exact=sections.find(s=>target.includes(fold(s.label))||fold(s.label).includes(target));if(exact)return exact;
 const words=new Set(target.split(/[^a-z0-9]+/).filter(x=>x.length>3));let best=null,score=0;
 for(const s of sections){const sw=fold(s.label).split(/[^a-z0-9]+/).filter(x=>x.length>3),hit=sw.filter(x=>words.has(x)).length,val=hit/Math.max(1,new Set([...words,...sw]).size);if(val>score){score=val;best=s}}
 return score>=.2?best:null
}
function signature(schema){const obj=objective(schema);return hash(JSON.stringify({sections:obj?.sections||[],content:schema?.content||[],notice:schema?.notice||'',position:schema?.position||''}))}
function load(cid){return safeJSON(localStorage.getItem(key(cid)),null)}
function save(cid,blueprint){const next={...blueprint,contestId:cid,updatedAt:new Date().toISOString()};localStorage.setItem(key(cid),JSON.stringify(next));window.dispatchEvent(new CustomEvent('planoarq:study-blueprint',{detail:{contestId:cid,blueprint:next}}));return next}
function build(cid,schema,contest={},previous=load(cid)){
 const obj=objective(schema),sections=Array.isArray(obj?.sections)?obj.sections:[],content=Array.isArray(schema?.content)?schema.content:[],prevBy=new Map((previous?.maps||[]).map(x=>[x.id,x])),covered=new Set(),maps=[],sourceBlocks=[];
 const weights=new Map(sections.map(s=>[s.id||slug(s.label),sectionWeight(s,sections)]));
 for(const block of content){
  const label=clean(block?.label)||'Conteúdo do edital',text=clean(block?.text),sec=matchSection(label,sections),sectionId=sec?.id||slug(sec?.label||label),sectionLabel=clean(sec?.label)||label,topics=splitTopics(text),max=10,parts=Math.max(1,Math.ceil(Math.max(1,topics.length)/max));
  if(sec)covered.add(sec.id||slug(sec.label));
  sourceBlocks.push({label,sectionId,sectionLabel,text,topics,source:block?.source||'edital'});
  for(let i=0;i<parts;i++){
   const slice=topics.slice(i*max,(i+1)*max),id='map-'+slug(sectionId)+'-'+hash(label)+'-'+(i+1),old=prevBy.get(id)||{},title=parts>1?label+' · Parte '+(i+1):label;
   maps.push({id,sectionId,sectionLabel,group:sectionLabel,title,part:i+1,parts,topics:slice,topicCount:slice.length,source:'edital',sourceLabel:label,sourceText:text,weightPct:weights.get(sectionId)||0,status:old.materialId?'linked':'planned',materialId:old.materialId||'',createdFrom:'programa-do-edital'})
  }
 }
 for(const sec of sections){
  const sectionId=sec.id||slug(sec.label);if(covered.has(sectionId))continue;
  const id='map-'+slug(sectionId)+'-pendente',old=prevBy.get(id)||{};
  maps.push({id,sectionId,sectionLabel:clean(sec.label)||sectionId,group:clean(sec.label)||sectionId,title:clean(sec.label)||'Componente da prova',part:1,parts:1,topics:[],topicCount:0,source:'estrutura-da-prova',sourceLabel:clean(sec.label),sourceText:'',weightPct:weights.get(sectionId)||0,status:old.materialId?'linked':'awaiting-content',materialId:old.materialId||'',createdFrom:'estrutura-da-prova'})
 }
 const linked=maps.filter(x=>x.materialId).length,awaiting=maps.filter(x=>x.status==='awaiting-content').length,totalTopics=maps.reduce((a,x)=>a+x.topicCount,0);
 return {schema:1,version:VERSION,contestId:cid,sourceSignature:signature(schema),source:'post-import-edital',contest:{title:contest?.title||'',position:contest?.position||schema?.position||'',board:contest?.board||schema?.board||''},sections:sections.map(s=>({id:s.id||slug(s.label),label:s.label||'',weightPct:weights.get(s.id||slug(s.label))||0,questions:s.questions??null,totalPoints:s.totalPoints??null})),sourceBlocks,maps,summary:{sections:sections.length,sectionsWithProgram:covered.size,maps:maps.length,topics:totalTopics,linked,awaiting,coveragePct:sections.length?Math.round(covered.size*100/sections.length):0},createdAt:previous?.createdAt||new Date().toISOString()}
}
function buildAndSave(cid,schema,contest={}){return save(cid,build(cid,schema,contest,load(cid)))}
function loadOrBuild(cid){const existing=load(cid);if(existing)return existing;const schema=safeJSON(localStorage.getItem('planoarq:exam-schema::'+cid),null);return schema?buildAndSave(cid,schema,{id:cid}):null}
function mapsForSection(blueprint,section){const id=section?.id||slug(section?.label);return (blueprint?.maps||[]).filter(m=>m.sectionId===id||fold(m.sectionLabel)===fold(section?.label))}
function linkMaterial(cid,mapId,material){const b=load(cid);if(!b)return null;const maps=(b.maps||[]).map(m=>m.id===mapId?{...m,materialId:material?.id||'',status:material?.id?'linked':'planned',linkedAt:material?.id?new Date().toISOString():null}:m);return save(cid,{...b,maps,summary:{...b.summary,linked:maps.filter(x=>x.materialId).length}})}
window.PLANO_ARQ_STUDY_BLUEPRINT={version:VERSION,PREFIX,key,splitTopics,matchSection,signature,load,save,build,buildAndSave,loadOrBuild,mapsForSection,linkMaterial};
})();