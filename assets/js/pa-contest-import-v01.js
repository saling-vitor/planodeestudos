(()=>{
'use strict';
const VERSION='1.0', $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={step:1,mode:'choice',file:null,draft:null,returnFocus:null};
function fmtBytes(n){n=Number(n||0);if(n<1024)return n+' B';if(n<1024*1024)return Math.round(n/1024)+' KB';return (n/1024/1024).toFixed(1).replace('.',',')+' MB'}
function toast(msg){const t=$('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2100)}
function showMessage(text,error=false){const e=$('importMessage');if(!e)return;e.hidden=!text;e.textContent=text||'';e.classList.toggle('error',!!error)}
function validPdf(file){if(!file)return'Nenhum arquivo selecionado.';if(file.size<=0)return'O arquivo está vazio.';if(file.size>80*1024*1024)return'O PDF excede o limite de 80 MB.';if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf')return'Selecione um arquivo PDF.';return''}
function updateSteps(){document.querySelectorAll('#modal [data-step]').forEach(x=>x.hidden=Number(x.dataset.step)!==state.step);document.querySelectorAll('#modal [data-step-pill]').forEach(x=>{const n=Number(x.dataset.stepPill);x.classList.toggle('active',n===state.step);x.classList.toggle('done',n<state.step)});$('backStep').style.visibility=state.step===1?'hidden':'visible';$('nextStep').textContent=state.step===3?'Criar concurso':'Continuar'}
function statusTag(kind){const label=kind==='confirmed'?'Confirmado':kind==='review'?'Revisar':'Não encontrado';return '<span class="source-state '+kind+'">'+label+'</span>'}
const nval=v=>{const n=Number(String(v??'').trim().replace(',','.'));return Number.isFinite(n)?n:null};
function fieldStatus(d,key,fallback){return d?._status?.[key]||fallback}
function objectiveOf(d){return (d?.schema?.stages||d?.stages||[]).find(s=>s?.type==='objective')||null}
function sectionsOf(d){const s=d?.sections||objectiveOf(d)?.sections;return Array.isArray(s)?s:[]}
function scheduleOf(d){const s=d?.schedule||d?.schema?.schedule;return Array.isArray(s)?s:[]}
function renderExamReview(d){
 const objective=objectiveOf(d),sections=sectionsOf(d),duration=d?.durationMinutes??objective?.durationMinutes??'';
 if(!sections.length)return '<div class="review-section"><div class="review-section-head"><h3>Estrutura da prova</h3><span>Não identificada</span></div><div class="wizard-message">A composição da prova não foi identificada automaticamente. O concurso pode ser criado, mas o Planejamento só receberá pesos quando essa estrutura for cadastrada.</div></div>';
 const tq=sections.reduce((a,s)=>a+(Number(s.questions)||0),0),tp=sections.reduce((a,s)=>a+(Number(s.totalPoints)||0),0);
 return '<div class="review-section"><div class="review-section-head"><h3>Estrutura da prova</h3><span>Edite qualquer valor que não coincidir com o edital</span></div>'+
 '<div class="review-metrics"><div><span>Questões</span><b id="rwTotalQuestions">'+tq+'</b></div><div><span>Pontos</span><b id="rwTotalPoints">'+String(tp).replace('.',',')+'</b></div><label><span>Duração (min)</span><input id="rwDuration" type="number" min="0" step="1" value="'+esc(duration)+'"></label></div>'+
 '<div class="review-table"><div class="review-table-head"><span>Componente</span><span>Questões</span><span>Valor</span><span>Pontos</span><span>Mínimo</span></div>'+
 sections.map((s,i)=>'<div class="review-table-row" data-review-section="'+i+'"><input data-sec="label" value="'+esc(s.label||'')+'" aria-label="Componente '+(i+1)+'"><input data-sec="questions" type="number" min="0" step="1" value="'+esc(s.questions??'')+'" aria-label="Questões '+(i+1)+'"><input data-sec="pointsPerQuestion" type="number" min="0" step="any" value="'+esc(s.pointsPerQuestion??'')+'" aria-label="Valor por questão '+(i+1)+'"><input data-sec="totalPoints" type="number" min="0" step="any" value="'+esc(s.totalPoints??'')+'" aria-label="Pontos '+(i+1)+'"><input data-sec="minimumPoints" type="number" min="0" step="any" value="'+esc(s.minimumPoints??'')+'" aria-label="Mínimo '+(i+1)+'"></div>').join('')+
 '</div></div>';
}
function renderScheduleReview(d){
 const events=scheduleOf(d);
 if(!events.length)return '<div class="review-section"><div class="review-section-head"><h3>Cronograma</h3><span>Não identificado</span></div><div class="wizard-message">Nenhuma data do cronograma foi identificada automaticamente. A data da prova acima continua editável.</div></div>';
 return '<div class="review-section"><div class="review-section-head"><h3>Cronograma</h3><span>'+events.length+' evento'+(events.length===1?'':'s')+' identificado'+(events.length===1?'':'s')+'</span></div><div class="schedule-review">'+
 events.map((e,i)=>'<div class="schedule-review-row" data-review-event="'+i+'" data-kind="'+esc(e.kind||'event')+'"><input data-event="date" type="date" value="'+esc(e.date||'')+'" aria-label="Data do evento '+(i+1)+'"><input data-event="label" value="'+esc(e.label||'')+'" aria-label="Descrição do evento '+(i+1)+'"><span>'+esc(e.kind||'evento')+'</span></div>').join('')+
 '</div></div>';
}
function renderContentReview(d){
 const content=Array.isArray(d?.content)?d.content:[],labels=content.map(x=>x?.label).filter(Boolean);
 if(!labels.length)return '';
 return '<div class="review-section"><div class="review-section-head"><h3>Programa identificado</h3><span>'+labels.length+' bloco'+(labels.length===1?'':'s')+'</span></div><div class="content-review">'+labels.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div></div>';
}
function renderReview(){
 const d=state.draft||manualDraft(),auto=state.mode==='auto',fallback=auto?'review':'missing';
 $('reviewForm').innerHTML='<div class="review-section"><div class="review-section-head"><h3>Identificação</h3><span>'+(auto?'Dados extraídos do edital e editáveis':'Preenchimento manual')+'</span></div><div class="form-grid">'+
 '<div class="field full"><label>Concurso '+statusTag(fieldStatus(d,'title',fallback))+'</label><input id="rwTitle" value="'+esc(d.title)+'" placeholder="Nome curto do concurso"></div>'+
 '<div class="field full"><label>Órgão / instituição '+statusTag(fieldStatus(d,'organization',fallback))+'</label><input id="rwOrg" value="'+esc(d.organization)+'" placeholder="Órgão / instituição"></div>'+
 '<div class="field"><label>Cargo '+statusTag(fieldStatus(d,'position',fallback))+'</label><input id="rwPosition" value="'+esc(d.position)+'" placeholder="Arquiteto"></div>'+
 '<div class="field"><label>Banca '+statusTag(fieldStatus(d,'board',fallback))+'</label><input id="rwBoard" value="'+esc(d.board)+'" placeholder="Ex.: FUNDATEC"></div>'+
 '<div class="field full"><label>Cidade / UF '+statusTag(fieldStatus(d,'city',fallback))+'</label><input id="rwCity" value="'+esc(d.city)+'" placeholder="Ex.: Porto Alegre/RS"></div>'+
 '</div>'+
 ((d.positionCode||d.vacancies!=null||d.workloadHours||d.remuneration)?'<div class="review-inline-meta">'+
 (d.positionCode?'<span><b>Código</b>'+esc(d.positionCode)+'</span>':'')+
 (d.vacancies!=null?'<span><b>Vagas</b>'+esc(d.vacancies)+(d.reserve?' + CR':'')+'</span>':'')+
 (d.workloadHours?'<span><b>Jornada</b>'+esc(d.workloadHours)+'h/sem</span>':'')+
 (d.remuneration?'<span><b>Remuneração</b>'+esc(d.remuneration)+'</span>':'')+
 '</div>':'')+
 '</div>'+
 '<div class="review-section"><div class="review-section-head"><h3>Edital e prova</h3><span>Revise antes de criar</span></div><div class="form-grid">'+
 '<div class="field"><label>Edital '+statusTag(fieldStatus(d,'notice',fallback))+'</label><input id="rwNotice" value="'+esc(d.notice)+'" placeholder="Ex.: Edital 001/2027"></div>'+
 '<div class="field"><label>Data da prova '+statusTag(fieldStatus(d,'examDate',fallback))+'</label><input id="rwExamDate" type="date" value="'+esc(d.examDate)+'"></div>'+
 '<div class="field full"><label>Observação</label><input id="rwNote" value="'+esc(d.note||'')+'" placeholder="Opcional"></div>'+
 '</div></div>'+
 renderExamReview(d)+renderScheduleReview(d)+renderContentReview(d);
}
function collectReview(){
 const base={...(state.draft||{})},title=$('rwTitle')?.value.trim()||'',organization=$('rwOrg')?.value.trim()||'',position=$('rwPosition')?.value.trim()||'',board=$('rwBoard')?.value.trim()||'',city=$('rwCity')?.value.trim()||'',notice=$('rwNotice')?.value.trim()||'',examDate=$('rwExamDate')?.value||'',note=$('rwNote')?.value.trim()||'',durationMinutes=nval($('rwDuration')?.value);
 const previous=sectionsOf(base),rows=[...document.querySelectorAll('[data-review-section]')];
 let sections=rows.map((row,i)=>{const q=nval(row.querySelector('[data-sec="questions"]')?.value),w=nval(row.querySelector('[data-sec="pointsPerQuestion"]')?.value),p=nval(row.querySelector('[data-sec="totalPoints"]')?.value),mn=nval(row.querySelector('[data-sec="minimumPoints"]')?.value),old=previous[i]||{};return{...old,label:row.querySelector('[data-sec="label"]')?.value.trim()||old.label||('Componente '+(i+1)),questions:q,pointsPerQuestion:w,totalPoints:p,minimumPoints:mn,mapGroups:Array.isArray(old.mapGroups)&&old.mapGroups.length?old.mapGroups:[row.querySelector('[data-sec="label"]')?.value.trim()||old.label||('Componente '+(i+1))]}}).filter(s=>s.label);
 const totalQuestions=sections.reduce((a,s)=>a+(Number(s.questions)||0),0),totalPoints=sections.reduce((a,s)=>a+(Number(s.totalPoints)||0),0);
 if(totalPoints>0)sections=sections.map(s=>({...s,planWeight:Math.round((Number(s.totalPoints)||0)*10000/totalPoints)/100,planWeightSource:'calculated'}));
 const oldSchedule=scheduleOf(base),eventRows=[...document.querySelectorAll('[data-review-event]')],schedule=eventRows.length?eventRows.map((row,i)=>({...oldSchedule[i],date:row.querySelector('[data-event="date"]')?.value||'',label:row.querySelector('[data-event="label"]')?.value.trim()||'',kind:row.dataset.kind||oldSchedule[i]?.kind||'event'})).filter(e=>e.date||e.label):oldSchedule;
 const oldSchema=base.schema||{},oldStages=oldSchema.stages||base.stages||[],oldObjective=oldStages.find(s=>s?.type==='objective')||null,others=oldStages.filter(s=>s?.type!=='objective');
 const objective=sections.length?{...(oldObjective||{}),id:oldObjective?.id||'objective',type:'objective',label:oldObjective?.label||'Prova Objetiva',planningMode:oldObjective?.planningMode||'weighted-sections',date:examDate||oldObjective?.date||'',durationMinutes:durationMinutes??oldObjective?.durationMinutes??null,totalQuestions:totalQuestions||null,totalPoints:totalPoints||null,sections}:oldObjective;
 const stages=objective?[objective,...others]:oldStages;
 const schema={...oldSchema,board,organization,position,notice,examDate:{...(oldSchema.examDate||{}),date:examDate||oldSchema.examDate?.date||''},stages,schedule};
 return{...base,title,organization,position,board,city,notice,examDate,note,durationMinutes:durationMinutes??base.durationMinutes??null,sections,stages,schedule,schema};
}
function renderSummary(){
 const d=collectReview();state.draft=d;const objective=objectiveOf(d),sections=sectionsOf(d),events=scheduleOf(d),content=Array.isArray(d.content)?d.content:[];
 const structure=objective?(String(objective.totalQuestions??'—')+' questões · '+String(objective.totalPoints??'—')+' pontos · '+sections.length+' componente'+(sections.length===1?'':'s')):'Não estruturada';
 $('summary').innerHTML=[['Concurso',d.title],['Órgão',d.organization],['Cargo',d.position],['Banca',d.board||'Não identificado'],['Local',d.city||'Não identificado'],['Edital',d.notice||'Não identificado'],['Prova',d.examDate||'Não definida'],['Estrutura',structure],['Cronograma',events.length+' evento'+(events.length===1?'':'s')],['Programa',content.length+' bloco'+(content.length===1?'':'s')]].map(([a,b])=>'<div class="summary-item"><span>'+esc(a)+'</span><b>'+esc(b)+'</b></div>').join('');
}
function chooseManual(){state.mode='manual';state.draft=manualDraft();state.step=2;renderReview();$('nextStep').hidden=false;updateSteps();$('rwTitle')?.focus()}
function chooseFile(file){const err=validPdf(file);if(err){showMessage(err,true);return}state.file=file;state.mode='auto';showMessage('');$('selectedNoticeFile').hidden=false;$('selectedNoticeFile').innerHTML='<div class="file-mark">PDF</div><div><strong>'+esc(file.name)+'</strong><span>'+fmtBytes(file.size)+' · pronto para análise</span></div><button type="button" class="ghost-btn" id="changeNoticeFile">Trocar</button>';$('changeNoticeFile').onclick=()=>$('noticeFile').click();$('nextStep').hidden=false}
async function next(){
 if(state.step===1){
  if(state.mode==='choice'){toast('Selecione o edital ou use a criação manual.');return}
  if(state.mode==='manual'){chooseManual();return}
  const parser=window.PLANO_ARQ_EDICT_PARSER;
  if(!parser?.analyzeIntoWizard){showMessage('A análise automática será ativada na próxima etapa. O arquivo foi validado e você pode continuar manualmente agora.',true);return}
  return parser.analyzeIntoWizard(state)
 }
 if(state.step===2){
  const d=collectReview();if(!d.title){toast('Informe o nome curto do concurso.');$('rwTitle')?.focus();return}if(!d.position){toast('Informe o cargo.');$('rwPosition')?.focus();return}
  state.draft=d;state.step=3;renderSummary();updateSteps();return
 }
 if(state.step===3){
  const d=state.draft||collectReview(),D=window.PLANO_ARQ_DATA;if(!D?.saveContest||!D?.saveExamSchema||!D?.upsertContestFile){toast('Dados do Portal ainda não carregaram.');return}
  const year=(d.examDate||String(d.notice||'').match(/20\d{2}/)?.[0]||new Date().getFullYear()),slug=v=>String(v||'').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),base=slug(d.id||`${d.title}-${d.position}-${year}`)||('concurso-'+Date.now());
  let id=base,n=2;while(D.contestById(id))id=base+'-'+n++;
  const createdAt=new Date().toISOString(),createdDay=createdAt.slice(0,10),fileId=state.file?'edital-principal':null;
  let fileMeta=null;
  try{
   if(state.file){
    if(!D.storeContestBlob)throw new Error('Armazenamento local do PDF não está disponível.');
    await D.storeContestBlob(id,fileId,state.file,{name:state.file.name,type:state.file.type,size:state.file.size});
    fileMeta={id:fileId,title:d.notice||('Edital · '+d.position),filename:state.file.name,type:'pdf',mimeType:state.file.type||'application/pdf',sizeBytes:state.file.size,category:'Edital',status:'vigente',official:true,linkedToEdital:true,storage:'indexeddb',storageKey:id+'::'+fileId,localOnly:true,date:d.publicationDate||'',organization:d.organization||d.title,board:d.board||'',description:'Edital principal importado na criação do concurso',contentUpdatedAt:createdAt};
   }
   let schema=null;
   if(d.schema||d.stages?.length||d.sections?.length){
    const sourceSchema=d.schema||{},docs=[...(Array.isArray(sourceSchema.documents)?sourceSchema.documents:[])];
    if(fileMeta&&!docs.some(x=>(x.id||x.file)===fileId))docs.push({id:fileId,label:fileMeta.title,type:'Edital',file:fileMeta.storageKey,status:'vigente',publicationDate:fileMeta.date,storage:'indexeddb'});
    schema={...sourceSchema,id,contestId:id,status:'reviewed',board:d.board||sourceSchema.board||'',organization:d.organization||sourceSchema.organization||'',position:d.position||sourceSchema.position||'',positionCode:d.positionCode||sourceSchema.positionCode||'',notice:d.notice||sourceSchema.notice||'',examDate:{...(sourceSchema.examDate||{}),date:d.examDate||sourceSchema.examDate?.date||''},stages:d.stages||sourceSchema.stages||[],schedule:d.schedule||sourceSchema.schedule||[],content:d.content||sourceSchema.content||[],documents:docs,source:state.mode==='auto'?'pdf-import':'user',reviewedAt:createdAt};
    D.saveExamSchema(id,schema);
   }
   if(fileMeta)D.upsertContestFile(id,fileMeta);
   const contest={id,title:d.title,organization:d.organization||d.title,position:d.position,positionCode:d.positionCode||'',board:d.board||'',notice:d.notice||'',city:d.city||'',examDate:d.examDate||'',examDateStatus:d.examDateStatus||schema?.examDate?.status||'',status:'active',edital:fileId||'',examSchemaId:schema?id:'',note:d.note||'',createdAt:createdDay,source:state.mode==='auto'?'pdf-import':'user',importedEdict:!!fileMeta};
   D.saveContest(contest);
   D.saveImportDraft?.(id,{...d,contestId:id,fileId,createdAt,source:contest.source});
   localStorage.setItem('planoarq:active-contest:v1',id);close();toast('Novo concurso criado.');location.href='edital.html?contest='+encodeURIComponent(id)
  }catch(err){
   if(fileId)try{await D.deleteContestBlob?.(id,fileId)}catch(_){}
   toast(err?.message||'Não foi possível criar o concurso.');
  }
 }
}
function back(){if(state.step===3){state.step=2;renderReview();updateSteps();return}if(state.step===2){state.step=1;updateSteps()}}
function reset(){state.step=1;state.mode='choice';state.file=null;state.draft=null;$('noticeFile').value='';$('selectedNoticeFile').hidden=true;$('selectedNoticeFile').innerHTML='';$('analysisPanel').hidden=true;$('analysisPanel').innerHTML='';$('cargoPanel').hidden=true;$('cargoPanel').innerHTML='';$('reviewForm').innerHTML='';$('summary').innerHTML='';$('nextStep').hidden=true;showMessage('');updateSteps()}
function open(){state.returnFocus=document.activeElement;reset();$('modal').classList.add('open');$('modal').setAttribute('aria-hidden','false');requestAnimationFrame(()=>$('noticeDrop')?.focus())}
function close(){$('modal').classList.remove('open');$('modal').setAttribute('aria-hidden','true');const f=state.returnFocus;state.returnFocus=null;requestAnimationFrame(()=>f?.focus?.())}
function bind(){const drop=$('noticeDrop'),file=$('noticeFile');$('selectNoticeFile').onclick=e=>{e.stopPropagation();file.click()};drop.onclick=e=>{if(!e.target.closest('button'))file.click()};drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();file.click()}};['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('drag')}));['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('drag')}));drop.addEventListener('drop',e=>chooseFile(e.dataTransfer?.files?.[0]));file.onchange=()=>chooseFile(file.files?.[0]);$('manualContestBtn').onclick=chooseManual;$('closeModal').onclick=close;$('cancelBtn').onclick=close;$('nextStep').onclick=next;$('backStep').onclick=back;$('modal').addEventListener('pointerdown',e=>{if(e.target===$('modal'))close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('modal')?.classList.contains('open'))close()})}
bind();
window.PLANO_ARQ_CONTEST_IMPORT={version:VERSION,state,open,close,updateSteps,renderReview,collectReview,renderSummary,next,toast,showMessage,statusTag,esc};
})();