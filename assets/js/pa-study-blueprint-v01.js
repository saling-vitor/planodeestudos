(()=>{
'use strict';
const VERSION='1.3',PREFIX='planoarq:study-blueprint::',GENERATION_CONTRACT='H1',IMPORT_CONTRACT='H2',AUDIT_CONTRACT='H3';
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
   maps.push({id,sectionId,sectionLabel,group:sectionLabel,title,part:i+1,parts,topics:slice,topicCount:slice.length,source:'edital',sourceLabel:label,sourceText:text,weightPct:weights.get(sectionId)||0,status:old.materialId?'active':old.import?.stored?'imported-pending-audit':'ready-to-generate',materialId:old.materialId||'',generation:old.generation||null,import:old.import||null,createdFrom:'programa-do-edital'})
  }
 }
 for(const sec of sections){
  const sectionId=sec.id||slug(sec.label);if(covered.has(sectionId))continue;
  const id='map-'+slug(sectionId)+'-pendente',old=prevBy.get(id)||{};
  maps.push({id,sectionId,sectionLabel:clean(sec.label)||sectionId,group:clean(sec.label)||sectionId,title:clean(sec.label)||'Componente da prova',part:1,parts:1,topics:[],topicCount:0,source:'estrutura-da-prova',sourceLabel:clean(sec.label),sourceText:'',weightPct:weights.get(sectionId)||0,status:old.materialId?'active':'awaiting-content',materialId:old.materialId||'',generation:old.generation||null,import:old.import||null,createdFrom:'estrutura-da-prova'})
 }
 const linked=maps.filter(x=>x.materialId).length,awaiting=maps.filter(x=>x.status==='awaiting-content').length,totalTopics=maps.reduce((a,x)=>a+x.topicCount,0);
 return {schema:1,version:VERSION,contestId:cid,sourceSignature:signature(schema),source:'post-import-edital',contest:{title:contest?.title||'',position:contest?.position||schema?.position||'',board:contest?.board||schema?.board||''},sections:sections.map(s=>({id:s.id||slug(s.label),label:s.label||'',weightPct:weights.get(s.id||slug(s.label))||0,questions:s.questions??null,totalPoints:s.totalPoints??null})),sourceBlocks,maps,summary:{sections:sections.length,sectionsWithProgram:covered.size,maps:maps.length,topics:totalTopics,linked,awaiting,coveragePct:sections.length?Math.round(covered.size*100/sections.length):0},createdAt:previous?.createdAt||new Date().toISOString()}
}
function buildAndSave(cid,schema,contest={}){return save(cid,build(cid,schema,contest,load(cid)))}
function loadOrBuild(cid){const existing=load(cid);if(existing)return existing;const schema=safeJSON(localStorage.getItem('planoarq:exam-schema::'+cid),null);return schema?buildAndSave(cid,schema,{id:cid}):null}
function mapsForSection(blueprint,section){const id=section?.id||slug(section?.label);return (blueprint?.maps||[]).filter(m=>m.sectionId===id||fold(m.sectionLabel)===fold(section?.label))}
function generationPackage(cid,mapId,contest={},schema=null){
 const blueprint=load(cid),map=(blueprint?.maps||[]).find(x=>x.id===mapId);if(!blueprint||!map)throw new Error('Mapa preparado não encontrado');
 const obj=schema?objective(schema):null,section=(obj?.sections||[]).find(s=>(s.id||slug(s.label))===map.sectionId)||null;
 const topics=(map.topics||[]).map(clean).filter(Boolean),signature=blueprint.sourceSignature||signatureForFallback(blueprint),contractId='h1-'+hash([cid,map.id,signature].join('|'));
 return{
  contract:'plano-arq-map-generation',contractVersion:GENERATION_CONTRACT,contractId,createdAt:new Date().toISOString(),
  contest:{id:cid,title:contest?.title||blueprint.contest?.title||'',organization:contest?.organization||'',position:contest?.position||blueprint.contest?.position||'',board:contest?.board||blueprint.contest?.board||'',notice:contest?.notice||schema?.notice||'',examDate:contest?.examDate||schema?.examDate?.date||''},
  map:{id:map.id,title:map.title,group:map.group||map.sectionLabel||'',sectionId:map.sectionId,sectionLabel:map.sectionLabel||'',part:map.part||1,parts:map.parts||1,weightPct:Number(map.weightPct||0),topicCount:topics.length,status:map.status,topics,sourceText:map.sourceText||'',sourceLabel:map.sourceLabel||'',createdFrom:map.createdFrom||'programa-do-edital'},
  section:section?{id:section.id||map.sectionId,label:section.label||map.sectionLabel||'',questions:section.questions??null,totalPoints:section.totalPoints??null,minimumPoints:section.minimumPoints??null,planWeight:section.planWeight??map.weightPct}:null,
  integration:{contestId:cid,mapId:map.id,blueprintSignature:signature,requiredMeta:{'plano-arq-contest-id':cid,'plano-arq-map-id':map.id,'plano-arq-blueprint-signature':signature}}
 }
}
function signatureForFallback(blueprint){return hash(JSON.stringify({contestId:blueprint?.contestId||'',maps:(blueprint?.maps||[]).map(x=>({id:x.id,topics:x.topics}))}))}
function generationCommand(cid,mapId,contest={},schema=null){
 const p=generationPackage(cid,mapId,contest,schema),m=p.map,c=p.contest,topicLines=m.topics.length?m.topics.map((x,i)=>`${i+1}. ${x}`).join('\n'):'— conteúdo programático não identificado —';
 return `GERAR MAPA DE ESTUDOS — PLANO ARQ · CONTRATO ${p.contractVersion}

Use integralmente a TEMPLATE HTML OFICIAL MAIS RECENTE que será anexada nesta conversa. As regras internas da template são a fonte principal de estrutura, design, interações, didática, testes, checkpoints, armazenamento e consistência. Este comando apenas define o escopo deste mapa.

CONCURSO
- ID: ${c.id}
- Concurso: ${c.title||'—'}
- Órgão: ${c.organization||'—'}
- Cargo: ${c.position||'—'}
- Banca: ${c.board||'—'}
- Edital: ${c.notice||'—'}
- Prova: ${c.examDate||'—'}

MAPA A GERAR
- mapId obrigatório: ${m.id}
- Título: ${m.title}
- Grupo/componente: ${m.group||'—'}
- Parte: ${m.part}/${m.parts}
- Peso de referência na prova: ${String(m.weightPct).replace('.',',')}%
- Origem: ${m.createdFrom}

CONTEÚDO PROGRAMÁTICO DESTE MAPA
${topicLines}

TRECHO-FONTE EXTRAÍDO DO EDITAL
${m.sourceText||'—'}

REGRAS DE ESCOPO
1. Gerar SOMENTE este mapa. Não incorporar automaticamente conteúdos destinados a outros mapas deste concurso.
2. Não inventar tópicos ausentes do escopo acima. Quando for necessário desenvolver, atualizar ou verificar o conteúdo, usar fontes oficiais e confiáveis pertinentes, sem alterar o escopo do edital.
3. A template anexada prevalece para todas as regras de geração. Não simplificar, remover ou substituir seus recursos.
4. Manter o conteúdo adequado a concurso público de nível superior e ao cargo indicado acima.
5. Questões e testes devem ser inéditos e compatíveis com o estilo da banca quando houver banca identificada; não copiar questões existentes.
6. O HTML deve ser responsivo e manter armazenamento/progresso isolados deste mapa.
7. Entregar um único arquivo HTML final pronto para importação no Plano ARQ.

CONTRATO DE INTEGRAÇÃO — NÃO ALTERAR
- plano-arq-contest-id = ${p.integration.contestId}
- plano-arq-map-id = ${p.integration.mapId}
- plano-arq-blueprint-signature = ${p.integration.blueprintSignature}

O HTML final deve conter, no <head>, exatamente:
<meta name="plano-arq-contest-id" content="${p.integration.contestId}">
<meta name="plano-arq-map-id" content="${p.integration.mapId}">
<meta name="plano-arq-blueprint-signature" content="${p.integration.blueprintSignature}">

Antes de entregar, auditar se todos os tópicos acima estão contemplados e se nenhum conteúdo de outro mapa foi incorporado sem necessidade.

PACOTE H1
${JSON.stringify(p,null,2)}
`
}
function markCommandCopied(cid,mapId){
 const b=load(cid);if(!b)return null;const at=new Date().toISOString(),maps=(b.maps||[]).map(m=>m.id===mapId?{...m,generation:{...(m.generation||{}),contractVersion:GENERATION_CONTRACT,commandCopiedAt:at}}:m);return save(cid,{...b,maps})
}
function metaValue(doc,name){return clean(doc.querySelector(`meta[name="${CSS.escape(name)}"]`)?.getAttribute('content')||'')}
function inspectGeneratedHtml(cid,mapId,html){
 const blueprint=load(cid),map=(blueprint?.maps||[]).find(x=>x.id===mapId),errors=[],warnings=[];
 if(!blueprint||!map)return{ok:false,errors:['Mapa preparado não encontrado'],warnings,meta:{},topicCount:0};
 if(typeof DOMParser==='undefined')return{ok:false,errors:['Este navegador não suporta a leitura segura do HTML'],warnings,meta:{},topicCount:0};
 const doc=new DOMParser().parseFromString(String(html||''),'text/html'),parserError=doc.querySelector('parsererror'),expectedSignature=blueprint.sourceSignature||signatureForFallback(blueprint);
 if(parserError||!doc.documentElement||!doc.head||!doc.body)errors.push('Arquivo HTML inválido ou incompleto');
 const meta={
  contestId:metaValue(doc,'plano-arq-contest-id'),
  mapId:metaValue(doc,'plano-arq-map-id'),
  blueprintSignature:metaValue(doc,'plano-arq-blueprint-signature'),
  storageId:metaValue(doc,'mindmap-storage-id'),
  displayTitle:metaValue(doc,'study-display-title'),
  shortCode:metaValue(doc,'study-short-code'),
  shortTitle:metaValue(doc,'study-short-title'),
  titleEmoji:metaValue(doc,'study-title-emoji'),
  fileVersion:metaValue(doc,'study-file-version'),
  board:metaValue(doc,'study-exam-board'),
  examContest:metaValue(doc,'study-exam-contest'),
  libraryGroup:metaValue(doc,'study-library-group'),
  libraryOrder:metaValue(doc,'study-library-order'),
  bridge:metaValue(doc,'plano-arq-bridge-version'),
  sourceTemplate:metaValue(doc,'plano-arq-source-template')
 };
 if(!meta.contestId)errors.push('Metadado plano-arq-contest-id ausente');else if(meta.contestId!==cid)errors.push('Este HTML pertence a outro concurso');
 if(!meta.mapId)errors.push('Metadado plano-arq-map-id ausente');else if(meta.mapId!==mapId)errors.push('Este HTML pertence a outro mapa');
 if(!meta.blueprintSignature)errors.push('Metadado plano-arq-blueprint-signature ausente');else if(meta.blueprintSignature!==expectedSignature)errors.push('O HTML foi gerado para uma versão anterior/diferente do edital');
 const topicCount=doc.querySelectorAll('[data-topic-id]').length;
 if(!topicCount)errors.push('Nenhum tópico de estudo foi identificado no HTML');
 if(!meta.storageId)warnings.push('mindmap-storage-id não identificado; a auditoria H3 deverá bloquear a ativação');
 if(!meta.displayTitle)warnings.push('study-display-title não identificado; a auditoria H3 deverá revisar a template');
 const hasRuntime=[...doc.querySelectorAll('script[src]')].some(x=>(x.getAttribute('src')||'').includes('study-map-runtime-v01.js'));
 const hasSharedCss=[...doc.querySelectorAll('link[href]')].some(x=>(x.getAttribute('href')||'').includes('study-map-shared-v01.css'));
 if(!hasRuntime)warnings.push('Runtime compartilhado do mapa não identificado');
 if(!hasSharedCss)warnings.push('CSS compartilhado do mapa não identificado');
 return{ok:errors.length===0,errors,warnings,meta,topicCount,title:clean(doc.title),expectedSignature}
}
async function importGeneratedHtml(cid,mapId,file){
 if(!file)throw new Error('Selecione o arquivo HTML gerado');
 const name=String(file.name||'mapa.html'),type=String(file.type||'').toLowerCase();
 if(!/\.html?$/i.test(name)&&type!=='text/html')throw new Error('Selecione um arquivo .html');
 if(Number(file.size||0)>25*1024*1024)throw new Error('O HTML excede o limite de 25 MB para importação');
 const html=await file.text(),check=inspectGeneratedHtml(cid,mapId,html);
 if(!check.ok){const e=new Error(check.errors.join(' · '));e.code='H2_CONTRACT_MISMATCH';e.details=check;throw e}
 const d=window.PLANO_ARQ_DATA;if(!d?.storeContestBlob)throw new Error('Armazenamento local ainda não está disponível');
 const storageId='study-map-html::'+mapId,at=new Date().toISOString();
 await d.storeContestBlob(cid,storageId,file,{name,type:type||'text/html',size:file.size});
 const b=load(cid);if(!b)throw new Error('Estrutura de estudos não encontrada');
 const maps=(b.maps||[]).map(m=>m.id===mapId?{...m,status:'imported-pending-audit',import:{contractVersion:IMPORT_CONTRACT,stored:true,storageId,filename:name,sizeBytes:Number(file.size||0),mimeType:type||'text/html',importedAt:at,localOnly:true,topicCountDetected:check.topicCount,titleDetected:check.title,meta:check.meta,warnings:check.warnings}}:m);
 const next=save(cid,{...b,maps});
 return{blueprint:next,map:maps.find(m=>m.id===mapId),check}
}
async function importedHtml(cid,mapId){
 const map=(load(cid)?.maps||[]).find(x=>x.id===mapId),storageId=map?.import?.storageId;if(!storageId)return null;
 return await window.PLANO_ARQ_DATA?.contestBlob?.(cid,storageId)
}
function clearImportedHtmlState(cid,mapId){
 const b=load(cid);if(!b)return null;const maps=(b.maps||[]).map(m=>m.id===mapId?{...m,status:m.topicCount?'ready-to-generate':'awaiting-content',import:null,audit:null}:m);return save(cid,{...b,maps})
}
const AUDIT_CONTROLS=['search','searchInfo','searchToggle','expandBtn','collapseBtn','highBtn','reviewBtn','clearBtn','closeFileBtn'];
const STOPWORDS=new Set('a o as os de da do das dos e em no na nos nas para por com sem um uma uns umas ou ao aos à às que se seu sua seus suas como mais menos sobre entre este esta estes estas isso isto edital mapa estudo'.split(' '));
function meaningfulTokens(v){return [...new Set(fold(v).split(/[^a-z0-9]+/).filter(x=>x.length>=3&&!STOPWORDS.has(x)))]}
function topicCoverage(topic,bodyFold){
 const full=fold(topic);if(!full)return 1;if(bodyFold.includes(full))return 1;
 const tokens=meaningfulTokens(topic);if(!tokens.length)return 1;
 const hit=tokens.filter(t=>bodyFold.includes(t)).length;return hit/tokens.length
}
function localDynamicMaterials(){
 const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k?.startsWith('planoarq:contest-materials::'))continue;const arr=safeJSON(localStorage.getItem(k),[]);if(Array.isArray(arr))out.push(...arr)}
 return out
}
async function auditImportedMap(cid,mapId){
 const blueprint=load(cid),map=(blueprint?.maps||[]).find(x=>x.id===mapId),rec=await importedHtml(cid,mapId),checks=[],errors=[],warnings=[];
 const add=(id,label,ok,detail='',severity='error')=>{checks.push({id,label,ok:!!ok,detail,severity});if(!ok)(severity==='warning'?warnings:errors).push(detail||label)};
 if(!blueprint||!map){add('map','Mapa preparado',false,'Mapa preparado não encontrado');return{ok:false,contract:AUDIT_CONTRACT,checks,errors,warnings}}
 if(!rec?.blob){add('file','HTML importado',false,'Arquivo HTML importado não está disponível neste dispositivo');return{ok:false,contract:AUDIT_CONTRACT,checks,errors,warnings}}
 const html=await rec.blob.text(),base=inspectGeneratedHtml(cid,mapId,html),doc=new DOMParser().parseFromString(html,'text/html'),meta=base.meta||{},topics=[...doc.querySelectorAll('[data-topic-id]')],topicIds=topics.map(x=>clean(x.getAttribute('data-topic-id'))).filter(Boolean),branchCards=[...doc.querySelectorAll('.branch-card')],branches=[...doc.querySelectorAll('main > .ramo')],bodyFold=fold(doc.body?.textContent||''),planned=(map.topics||[]).filter(Boolean);
 add('contract','Contrato do concurso/mapa',base.ok,base.errors?.join(' · ')||'IDs e assinatura do edital conferidos');
 const requiredMeta=['storageId','displayTitle','shortCode','fileVersion'],missingMeta=requiredMeta.filter(k=>!meta[k]);
 add('meta','Metadados da template',!missingMeta.length,missingMeta.length?'Ausentes: '+missingMeta.join(', '):'Metadados essenciais presentes');
 const viewport=clean(doc.querySelector('meta[name="viewport"]')?.getAttribute('content')||'');
 add('viewport','Viewport responsiva',/width\s*=\s*device-width/i.test(viewport),'A meta viewport deve usar width=device-width');
 add('mindmap','Estrutura principal',!!doc.querySelector('#mindmap.mindmap'),'#mindmap.mindmap obrigatório');
 add('branches','Ramos 1:1',branchCards.length>0&&branchCards.length===branches.length,`${branchCards.length} cartões de ramo · ${branches.length} ramos detalhados`);
 add('topics','Tópicos identificados',topics.length>=Math.max(1,planned.length),`${topics.length} tópicos no HTML · mínimo esperado ${Math.max(1,planned.length)}`);
 add('unique-topics','IDs de tópico únicos',topicIds.length===topics.length&&new Set(topicIds).size===topicIds.length,'Cada data-topic-id deve existir e ser único');
 const missingControls=AUDIT_CONTROLS.filter(id=>!doc.getElementById(id));
 add('controls','Controles funcionais da template',!missingControls.length,missingControls.length?'Ausentes: '+missingControls.join(', '):'Controles essenciais presentes');
 add('study-mode','Modo Estudo',!!doc.querySelector('[data-view="detail"]'),'Controle técnico do modo Estudo obrigatório');
 const scripts=[...doc.querySelectorAll('script[src]')].map(x=>x.getAttribute('src')||''),styles=[...doc.querySelectorAll('link[rel~="stylesheet"][href]')].map(x=>x.getAttribute('href')||'');
 add('bootstrap','Bootstrap compartilhado',scripts.some(x=>x.includes('study-map-bootstrap-v01.js')),'study-map-bootstrap-v01.js obrigatório');
 add('runtime','Runtime compartilhado',scripts.some(x=>x.includes('study-map-runtime-v01.js')),'study-map-runtime-v01.js obrigatório');
 add('shared-css','CSS compartilhado',styles.some(x=>x.includes('study-map-shared-v01.css')),'study-map-shared-v01.css obrigatório');
 const questionCount=doc.querySelectorAll('script.v134-question-data[type="application/json"]').length;
 add('questions','Testes por tópico',questionCount>=topics.length,`${questionCount} blocos de questões · ${topics.length} tópicos`);
 const coverage=planned.map(t=>({topic:t,score:topicCoverage(t,bodyFold)})),uncovered=coverage.filter(x=>x.score<.55);
 add('coverage','Cobertura do conteúdo do edital',!uncovered.length,uncovered.length?`${uncovered.length} item(ns) do edital sem correspondência suficiente: ${uncovered.slice(0,3).map(x=>x.topic).join(' · ')}`:`${planned.length} item(ns) do edital reconhecidos`);
 const existing=[...(window.PLANO_ARQ_MATERIALS?.materials||[]),...localDynamicMaterials()].filter(x=>x?.id===meta.storageId&&x?.contestId!==cid);
 add('storage','Armazenamento isolado',!!meta.storageId&&!existing.length,!meta.storageId?'mindmap-storage-id ausente':existing.length?'mindmap-storage-id já usado por outro concurso':'Namespace exclusivo');
 const externalExec=[...doc.querySelectorAll('script[src],link[rel~="stylesheet"][href]')].map(el=>el.getAttribute(el.tagName==='SCRIPT'?'src':'href')||'').filter(u=>/^https?:\/\//i.test(u)).filter(u=>{try{return new URL(u).origin!==location.origin}catch(_){return true}});
 const activeContent=doc.querySelectorAll('iframe,object,embed,form').length,jsUrls=[...doc.querySelectorAll('[href],[src]')].filter(el=>/^javascript:/i.test(el.getAttribute('href')||el.getAttribute('src')||'')).length;
 add('security','Dependências executáveis seguras',!externalExec.length&&!activeContent&&!jsUrls,externalExec.length?'Scripts/estilos externos não permitidos':activeContent?'iframe/object/embed/form não permitido':jsUrls?'URL javascript: não permitida':'Sem conteúdo executável externo');
 const inlineNet=[...doc.querySelectorAll('script:not([src])')].some(s=>/\b(fetch\s*\(|XMLHttpRequest\b|WebSocket\b|sendBeacon\s*\()/i.test(s.textContent||''));
 add('network','Código inline sem rede própria',!inlineNet,inlineNet?'Código inline tenta abrir comunicação de rede própria':'Sem chamadas de rede inline',inlineNet?'error':'warning');
 const report={ok:errors.length===0,contract:AUDIT_CONTRACT,auditedAt:new Date().toISOString(),mapId,contestId:cid,checks,errors,warnings,meta,stats:{topicCount:topics.length,branchCount:branches.length,questionCount,plannedTopicCount:planned.length,coveredTopicCount:planned.length-uncovered.length,coveragePct:planned.length?Math.round((planned.length-uncovered.length)*100/planned.length):100},filename:map.import?.filename||rec.name||''};
 const maps=(blueprint.maps||[]).map(m=>m.id===mapId?{...m,status:report.ok?'audit-approved':'audit-blocked',audit:report}:m);save(cid,{...blueprint,maps});
 return report
}
async function activateImportedMap(cid,mapId){
 const report=await auditImportedMap(cid,mapId);if(!report.ok){const e=new Error(report.errors[0]||'O mapa não passou na auditoria H3');e.code='H3_AUDIT_BLOCKED';e.report=report;throw e}
 const blueprint=load(cid),map=(blueprint?.maps||[]).find(x=>x.id===mapId),d=window.PLANO_ARQ_DATA;if(!map||!d?.upsertContestMaterial||!d?.upsertContestFile)throw new Error('Camada de dados ainda não está pronta');
 const meta=report.meta||{},materialId=meta.storageId,blobFileId=map.import?.storageId||('study-map-html::'+mapId),contest=d.contestById?.(cid)||{},at=new Date().toISOString();
 const material={
  id:materialId,storageNamespace:slug(materialId),src:'__indexeddb__',blobFileId,filename:map.import?.filename||'',title:meta.displayTitle||map.title,shortTitle:meta.shortTitle||map.title,shortCode:meta.shortCode||'MAPA',emoji:meta.titleEmoji||'',version:meta.fileVersion||'V01',versionNumber:Number(String(meta.fileVersion||'').match(/\d+/)?.[0]||1),versionCount:1,versions:[],board:meta.board||contest.board||'',contest:meta.examContest||[contest.title||contest.organization,contest.position].filter(Boolean).join(' · '),group:meta.libraryGroup||map.group||map.sectionLabel||'Outros',order:meta.libraryOrder||String((blueprint.maps||[]).findIndex(x=>x.id===mapId)+1).padStart(2,'0'),bridge:meta.bridge||'',sourceTemplate:meta.sourceTemplate||'',topicCount:report.stats.topicCount,branchCount:report.stats.branchCount,contestId:cid,mapId,dynamic:true,active:true,activatedAt:at,auditContract:AUDIT_CONTRACT
 };
 d.upsertContestMaterial(cid,material);
 d.upsertContestFile(cid,{id:blobFileId,title:material.title,filename:material.filename||(`${mapId}.html`),type:'html',mimeType:'text/html',sizeBytes:Number(map.import?.sizeBytes||0),category:'Mapa de estudo',status:'ativo',official:false,linkedToMap:true,mapId,storage:'indexeddb',storageKey:cid+'::'+blobFileId,localOnly:true,date:at.slice(0,10),description:'Mapa HTML auditado e ativado pela Etapa H3',contentUpdatedAt:map.import?.importedAt||at});
 const linked=linkMaterial(cid,mapId,material),fresh=(linked?.maps||[]).map(m=>m.id===mapId?{...m,status:'active',audit:{...report,activatedAt:at},import:{...(m.import||{}),activatedAt:at}}:m);
 const final=save(cid,{...linked,maps:fresh,summary:{...(linked?.summary||{}),linked:fresh.filter(x=>x.materialId).length,active:fresh.filter(x=>x.status==='active').length}});
 return{report,material,blueprint:final}
}
function linkMaterial(cid,mapId,material){const b=load(cid);if(!b)return null;const maps=(b.maps||[]).map(m=>m.id===mapId?{...m,materialId:material?.id||'',status:material?.id?'active':'planned',linkedAt:material?.id?new Date().toISOString():null}:m);return save(cid,{...b,maps,summary:{...b.summary,linked:maps.filter(x=>x.materialId).length,active:maps.filter(x=>x.status==='active').length}})}
window.PLANO_ARQ_STUDY_BLUEPRINT={version:VERSION,PREFIX,GENERATION_CONTRACT,IMPORT_CONTRACT,AUDIT_CONTRACT,key,splitTopics,matchSection,signature,load,save,build,buildAndSave,loadOrBuild,mapsForSection,generationPackage,generationCommand,markCommandCopied,inspectGeneratedHtml,importGeneratedHtml,importedHtml,clearImportedHtmlState,auditImportedMap,activateImportedMap,linkMaterial};
})();