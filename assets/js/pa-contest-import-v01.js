(()=>{
'use strict';
const VERSION='1.3', $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={step:1,mode:'choice',file:null,draft:null,returnFocus:null};
function fmtBytes(n){n=Number(n||0);if(n<1024)return n+' B';if(n<1024*1024)return Math.round(n/1024)+' KB';return (n/1024/1024).toFixed(1).replace('.',',')+' MB'}
function toast(msg){const t=$('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2100)}
function showMessage(text,error=false){const e=$('importMessage');if(!e)return;e.hidden=!text;e.textContent=text||'';e.classList.toggle('error',!!error)}
function validPdf(file){if(!file)return'Nenhum arquivo selecionado.';if(file.size<=0)return'O arquivo está vazio.';if(file.size>80*1024*1024)return'O PDF excede o limite de 80 MB.';if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf')return'Selecione um arquivo PDF.';return''}
function updateSteps(){document.querySelectorAll('#modal [data-step]').forEach(x=>x.hidden=Number(x.dataset.step)!==state.step);document.querySelectorAll('#modal [data-step-pill]').forEach(x=>{const n=Number(x.dataset.stepPill);x.classList.toggle('active',n===state.step);x.classList.toggle('done',n<state.step)});$('backStep').style.visibility=state.step===1?'hidden':'visible';$('nextStep').textContent=state.step===3?'Criar concurso':'Continuar'}
function statusTag(kind){const label=kind==='confirmed'?'Confirmado':kind==='review'?'Revisar':'Não encontrado';return '<span class="source-state '+kind+'">'+label+'</span>'}
const nval=v=>{const n=Number(String(v??'').trim().replace(',','.'));return Number.isFinite(n)?n:null};
const fold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const slugId=v=>fold(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function stableHash(v){let h=2166136261;for(const ch of String(v||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function placeParts(value,fallbackUf=''){
 const raw=String(value||'').trim(),m=raw.match(/^(.*?)(?:\s*\/\s*([A-Z]{2}))$/i),cityName=(m?.[1]||raw).trim(),uf=(m?.[2]||fallbackUf||'').toUpperCase().trim();
 return{cityName,uf,city:cityName?(uf?cityName+'/'+uf:cityName):''}
}
function contestBaseId(d,year){
 if(d.id)return slugId(d.id);
 const place=placeParts(d.city,d.uf),org=d.organization||d.officialName||d.title||'concurso',role=d.positionCode||d.position||'cargo';
 const readable=slugId([org,role,year].filter(Boolean).join('-'))||'concurso';
 const identity=[org,role,d.position||'',d.notice||'',place.uf||'',year].join('|');
 return readable+'-'+stableHash(identity).slice(0,6)
}
function fieldStatus(d,key,fallback){return d?._status?.[key]||fallback}
function objectiveOf(d){return (d?.schema?.stages||d?.stages||[]).find(s=>s?.type==='objective')||null}
function sectionsOf(d){const s=d?.sections||objectiveOf(d)?.sections;return Array.isArray(s)?s:[]}
function scheduleOf(d){const s=d?.schedule||d?.schema?.schedule;return Array.isArray(s)?s:[]}
function manualDraft(){return{title:'',officialName:'',organization:'',position:'',positionCode:'',board:'',city:'',cityName:'',uf:'',notice:'',publicationDate:'',examDate:'',examDateStatus:'',durationMinutes:null,vacancies:null,reserve:false,workloadHours:null,remuneration:'',requirements:'',stages:[],sections:[],schedule:[],rules:[],content:[],schema:null,source:'user',_status:{title:'missing',organization:'missing',position:'missing',board:'missing',city:'missing',notice:'missing',examDate:'missing'}}}
function evidenceRoot(d){return d?._evidence||d?.schema?.evidence||null}
function fieldEvidence(d,key){return evidenceRoot(d)?.fields?.[key]||null}
function sectionEvidence(d,section,index){const list=evidenceRoot(d)?.sections||[];return list.find(x=>section?.id&&x.id===section.id)||list[index]||null}
function contentEvidence(d,block,index){const list=evidenceRoot(d)?.content||[];return list.find(x=>block?.sectionId&&x.id===block.sectionId)||list[index]||null}
function sourceRefsLabel(refs){const list=[...new Set((refs||[]).filter(Boolean))];return list.length?list.slice(0,3).join(', ')+(list.length>3?' +'+(list.length-3):''):''}
function reviewEvidence(e){
 if(!e)return'';
 const pct=Math.round((Number(e.confidence)||0)*100),refs=sourceRefsLabel(e.sourceRefs),label=e.status==='missing'?'Sem evidência':'Confiança '+pct+'%';
 return '<small class="review-evidence '+esc(e.status||'review')+'"><span>'+esc(label)+'</span>'+(refs?'<span>Fonte '+esc(refs)+'</span>':'')+'</small>'
}
function renderIdentificationReview(d,auto,fallback){
 const noteVisible=!auto||!!d.note;
 return '<div class="review-section"><div class="review-section-head"><h3>Identificação</h3><span>'+(auto?'Dados extraídos do edital e editáveis':'Preenchimento manual')+'</span></div><div class="form-grid">'+
 '<div class="field full"><label>Concurso '+statusTag(fieldStatus(d,'title',fallback))+'</label><input id="rwTitle" value="'+esc(d.title)+'" placeholder="Nome curto do concurso">'+reviewEvidence(fieldEvidence(d,'title'))+'</div>'+
 '<div class="field full"><label>Órgão / instituição '+statusTag(fieldStatus(d,'organization',fallback))+'</label><input id="rwOrg" value="'+esc(d.organization)+'" placeholder="Órgão / instituição">'+reviewEvidence(fieldEvidence(d,'organization'))+'</div>'+
 '<div class="field"><label>Cargo '+statusTag(fieldStatus(d,'position',fallback))+'</label><input id="rwPosition" value="'+esc(d.position)+'" placeholder="Arquiteto">'+reviewEvidence(fieldEvidence(d,'position'))+'</div>'+
 '<div class="field"><label>Banca '+statusTag(fieldStatus(d,'board',fallback))+'</label><input id="rwBoard" value="'+esc(d.board)+'" placeholder="Ex.: FUNDATEC">'+reviewEvidence(fieldEvidence(d,'board'))+'</div>'+
 '<div class="field full"><label>Cidade / UF '+statusTag(fieldStatus(d,'city',fallback))+'</label><input id="rwCity" value="'+esc(d.city)+'" placeholder="Ex.: Porto Alegre/RS">'+reviewEvidence(fieldEvidence(d,'city'))+'</div>'+
 (noteVisible?'<div class="field full"><label>Observação</label><input id="rwNote" value="'+esc(d.note||'')+'" placeholder="Opcional"></div>':'')+
 '</div>'+
 ((d.positionCode||d.examGroup||d.vacancies!=null||d.workloadHours||d.remuneration)?'<div class="review-inline-meta">'+
 (d.positionCode?'<span><b>Código</b>'+esc(d.positionCode)+reviewEvidence(fieldEvidence(d,'positionCode'))+'</span>':'')+
 (d.examGroup?'<span><b>Grupo</b>'+esc(d.examGroup)+reviewEvidence(fieldEvidence(d,'examGroup'))+'</span>':'')+
 (d.vacancies!=null?'<span><b>Vagas</b>'+esc(d.vacancies)+(d.reserve?' + CR':'')+'</span>':'')+
 (d.workloadHours?'<span><b>Jornada</b>'+esc(d.workloadHours)+'h/sem</span>':'')+
 (d.remuneration?'<span><b>Remuneração</b>'+esc(d.remuneration)+'</span>':'')+
 '</div>':'')+
 '</div>'
}
function minimumLabel(kind,value){if(value===null||value===undefined||value==='')return'';return kind==='percentage'?'mínimo geral de '+String(value).replace('.',',')+'%':'mínimo geral de '+String(value).replace('.',',')+' pontos'}
function renderObjectiveReview(d,auto,fallback){
 const objective=objectiveOf(d),duration=d?.durationMinutes??objective?.durationMinutes??null,minimum=objective?.minimum||null,character=objective?.character||'',answerModel=objective?.answerModel||'',alternatives=objective?.alternatives??'',scoringRuleRaw=objective?.scoringRuleRaw||'',showDuration=duration!==null&&duration!==undefined&&duration!=='';
 return '<div class="review-section"><div class="review-section-head"><h3>Prova Objetiva</h3><span>Revise somente os dados da objetiva</span></div><div class="form-grid">'+
 '<div class="field"><label>Edital '+statusTag(fieldStatus(d,'notice',fallback))+'</label><input id="rwNotice" value="'+esc(d.notice)+'" placeholder="Ex.: Edital 001/2027">'+reviewEvidence(fieldEvidence(d,'notice'))+'</div>'+
 '<div class="field"><label>Data da prova '+statusTag(fieldStatus(d,'examDate',fallback))+'</label><input id="rwExamDate" type="date" value="'+esc(d.examDate)+'">'+reviewEvidence(fieldEvidence(d,'examDate'))+'</div>'+
 (showDuration?'<div class="field"><label>Duração (min) '+statusTag(fieldEvidence(d,'durationMinutes')?.status||'review')+'</label><input id="rwDuration" type="number" min="0" step="1" value="'+esc(duration)+'">'+reviewEvidence(fieldEvidence(d,'durationMinutes'))+'</div>':'')+
 (character?'<div class="field"><label>Caráter '+statusTag(fieldEvidence(d,'character')?.status||'review')+'</label><input id="rwCharacter" value="'+esc(character)+'">'+reviewEvidence(fieldEvidence(d,'character'))+'</div>':'')+
 '<div class="field"><label>Modelo de respostas '+statusTag(fieldEvidence(d,'responseModel')?.status||(answerModel?'review':'missing'))+'</label><select id="rwAnswerModel"><option value="" '+(!answerModel?'selected':'')+'>Não identificado</option><option value="multiple-choice" '+(answerModel==='multiple-choice'?'selected':'')+'>Múltipla escolha</option><option value="true-false" '+(answerModel==='true-false'?'selected':'')+'>Certo / Errado</option></select>'+reviewEvidence(fieldEvidence(d,'responseModel'))+'</div>'+
 ((answerModel==='multiple-choice'||alternatives)?'<div class="field"><label>Alternativas por questão</label><input id="rwAlternatives" type="number" min="2" max="10" step="1" value="'+esc(alternatives)+'"></div>':'')+
 (scoringRuleRaw?'<div class="field full"><label>Regra de correção identificada</label><input id="rwScoringRule" value="'+esc(scoringRuleRaw)+'"></div>':'')+
 (minimum?'<div class="field full"><label>Mínimo geral '+statusTag(fieldEvidence(d,'minimum')?.status||'review')+'</label><div class="review-unit-field"><input id="rwMinimum" type="number" min="0" step="any" value="'+esc(minimum.value??'')+'"><select id="rwMinimumKind" aria-label="Unidade do mínimo geral"><option value="points" '+(minimum.kind==='points'?'selected':'')+'>pontos</option><option value="percentage" '+(minimum.kind==='percentage'?'selected':'')+'>%</option></select></div>'+reviewEvidence(fieldEvidence(d,'minimum'))+'</div>':'')+
 '</div></div>'
}
function sectionRowHtml(s,i,sourceIndex,d){
 const minimum=s.minimumPoints??s.minimumQuestions??'',minKind=s.minimumQuestions!==null&&s.minimumQuestions!==undefined?'questions':'points',ev=sourceIndex>=0?sectionEvidence(d,s,sourceIndex):null;
 return '<div class="review-table-row" data-review-section="'+i+'" data-source-index="'+sourceIndex+'" data-min-kind="'+minKind+'">'+
 '<input data-sec="label" value="'+esc(s.label||'')+'" aria-label="Componente '+(i+1)+'">'+
 '<input data-sec="questions" type="number" min="0" step="1" value="'+esc(s.questions??'')+'" aria-label="Questões '+(i+1)+'">'+
 '<input data-sec="pointsPerQuestion" type="number" min="0" step="any" value="'+esc(s.pointsPerQuestion??'')+'" aria-label="Valor por questão '+(i+1)+'">'+
 '<input data-sec="totalPoints" type="number" min="0" step="any" value="'+esc(s.totalPoints??'')+'" aria-label="Pontos '+(i+1)+'">'+
 '<input data-sec="minimum" type="number" min="0" step="any" value="'+esc(minimum)+'" aria-label="Mínimo '+(i+1)+'">'+
 '<button type="button" class="icon-btn review-remove" data-remove-review-section aria-label="Remover componente '+(i+1)+'">×</button>'+
 (ev?'<div class="review-row-evidence">'+reviewEvidence(ev)+'</div>':'')+
 '</div>'
}
function renderExamReview(d){
 const sections=sectionsOf(d),tq=sections.reduce((a,s)=>a+(Number(s.questions)||0),0),tp=sections.reduce((a,s)=>a+(Number(s.totalPoints)||0),0);
 return '<div class="review-section"><div class="review-section-head"><h3>Estrutura</h3><span>'+(sections.length?sections.length+' componente'+(sections.length===1?'':'s')+' identificado'+(sections.length===1?'':'s'):'Nenhum componente identificado')+'</span></div>'+
 '<div class="review-metrics"><div><span>Questões</span><b id="rwTotalQuestions">'+tq+'</b></div><div><span>Pontos</span><b id="rwTotalPoints">'+String(tp).replace('.',',')+'</b></div></div>'+
 (sections.length?'<div class="review-table"><div class="review-table-head"><span>Componente</span><span>Questões</span><span>Valor</span><span>Pontos</span><span>Mínimo</span><span>Ação</span></div>'+sections.map((s,i)=>sectionRowHtml(s,i,i,d)).join('')+'</div>':'<div class="review-table"><div class="review-table-head"><span>Componente</span><span>Questões</span><span>Valor</span><span>Pontos</span><span>Mínimo</span><span>Ação</span></div></div><div class="wizard-message">A composição da prova objetiva não foi identificada automaticamente. Adicione os componentes que constam no edital.</div>')+
 '<div class="review-section-actions"><button type="button" class="ghost-btn review-add" data-add-review-section>Adicionar componente</button></div></div>'
}
function renderContentReview(d){
 const content=Array.isArray(d?.content)?d.content:[];
 return '<div class="review-section"><div class="review-section-head"><h3>Conteúdo Programático</h3><span>'+(content.length?content.length+' bloco'+(content.length===1?'':'s')+' identificado'+(content.length===1?'':'s'):'Não identificado')+'</span></div>'+
 (content.length?'<div class="review-program-list">'+content.map((b,i)=>{const ev=contentEvidence(d,b,i);return '<div class="review-program-card" data-review-content="'+i+'" data-source-index="'+i+'"><div class="review-program-head"><input data-content="label" value="'+esc(b.label||'')+'" aria-label="Componente do conteúdo '+(i+1)+'">'+reviewEvidence(ev)+'</div><textarea data-content="text" rows="4" aria-label="Conteúdo programático '+(i+1)+'">'+esc(b.text||'')+'</textarea></div>'}).join('')+'</div>':'<div class="wizard-message">O conteúdo programático não foi localizado para o cargo/grupo selecionado. Não será inventado conteúdo ausente no edital.</div>')+
 '</div>'
}
function conflictValueText(v){
 const x=v?.value??v;if(x===null||x===undefined)return'';
 if(typeof x==='object'){if(x.sourceLabel)return x.sourceLabel+(x.page?' · p.'+x.page:'');if(x.label)return x.label;try{return JSON.stringify(x)}catch(_){return String(x)}}
 return (v?.kind?v.kind+': ':'')+String(x)
}
function renderReviewIssues(d){
 const evidence=evidenceRoot(d),conflicts=evidence?.conflicts||d?.schema?.conflicts||[],labels={organization:'Órgão',position:'Cargo',objectiveLocation:'Localização da objetiva',objectiveTable:'Estrutura da objetiva',examDate:'Data da prova',durationMinutes:'Duração',minimum:'Mínimo geral',program:'Conteúdo programático'},attention=[];
 for(const key of Object.keys(labels)){const e=evidence?.fields?.[key];if(e&&(e.status==='review'||e.status==='missing'))attention.push({key,label:labels[key],e})}
 const ok=!conflicts.length&&!attention.length;
 return '<div class="review-section review-issues '+(ok?'ok':'needs-review')+'"><div class="review-section-head"><h3>Conflitos / Dados a revisar</h3><span>'+(ok?'Nenhum conflito detectado':(conflicts.length+attention.length)+' ponto'+((conflicts.length+attention.length)===1?'':'s')+' para conferir')+'</span></div>'+
 (ok?'<div class="wizard-message review-ok">Os dados principais da prova objetiva não apresentam conflitos detectados.</div>':'')+
 (conflicts.length?'<div class="review-conflict-list">'+conflicts.map(c=>'<div class="review-conflict"><strong>'+esc(c.message||'Conflito identificado')+'</strong>'+(Array.isArray(c.values)&&c.values.length?'<span>Valores: '+esc(c.values.map(conflictValueText).filter(Boolean).join(' · '))+'</span>':'')+(c.sourceRefs?.length?'<small>Fontes '+esc(sourceRefsLabel(c.sourceRefs))+'</small>':'')+'</div>').join('')+'</div>':'')+
 (attention.length?'<div class="review-attention-list">'+attention.map(x=>'<div class="review-attention"><div><strong>'+esc(x.label)+'</strong><span>'+esc(x.e.reason||'Requer conferência antes de criar.')+'</span></div>'+reviewEvidence(x.e)+'</div>').join('')+'</div>':'')+
 '</div>'
}
function recalcReviewTotals(){
 const rows=[...document.querySelectorAll('[data-review-section]')],q=rows.reduce((a,row)=>a+(nval(row.querySelector('[data-sec="questions"]')?.value)||0),0),p=rows.reduce((a,row)=>a+(nval(row.querySelector('[data-sec="totalPoints"]')?.value)||0),0);
 const tq=$('rwTotalQuestions'),tp=$('rwTotalPoints');if(tq)tq.textContent=String(q);if(tp)tp.textContent=String(Math.round(p*10000)/10000).replace('.',',')
}
function bindReviewActions(){
 const form=$('reviewForm');if(!form)return;
 form.onclick=e=>{const add=e.target.closest('[data-add-review-section]'),remove=e.target.closest('[data-remove-review-section]');if(add){const table=form.querySelector('.review-table');if(!table)return;const rows=table.querySelectorAll('[data-review-section]'),wrap=document.createElement('div');wrap.innerHTML=sectionRowHtml({label:'',questions:null,pointsPerQuestion:null,totalPoints:null,minimumPoints:null},rows.length,-1,state.draft||{});table.appendChild(wrap.firstElementChild);recalcReviewTotals();return}if(remove){remove.closest('[data-review-section]')?.remove();recalcReviewTotals()}};
 form.oninput=e=>{if(e.target.closest('[data-review-section]'))recalcReviewTotals()}
}
function renderReview(){
 const d=state.draft||manualDraft(),auto=state.mode==='auto',fallback=auto?'review':'missing';
 $('reviewForm').innerHTML=renderIdentificationReview(d,auto,fallback)+renderObjectiveReview(d,auto,fallback)+renderExamReview(d)+renderContentReview(d)+renderReviewIssues(d);
 bindReviewActions()
}
function collectReview(){
 const base={...(state.draft||{})},title=$('rwTitle')?.value.trim()||'',organization=$('rwOrg')?.value.trim()||'',position=$('rwPosition')?.value.trim()||'',board=$('rwBoard')?.value.trim()||'',city=$('rwCity')?.value.trim()||'',notice=$('rwNotice')?.value.trim()||'',examDate=$('rwExamDate')?.value||'',note=$('rwNote')?$('rwNote').value.trim():(base.note||''),durationMinutes=$('rwDuration')?nval($('rwDuration').value):(base.durationMinutes??objectiveOf(base)?.durationMinutes??null);
 const previous=sectionsOf(base),rows=[...document.querySelectorAll('[data-review-section]')];
 let sections=rows.map((row,i)=>{const sourceIndex=Number(row.dataset.sourceIndex),old=sourceIndex>=0?(previous[sourceIndex]||{}):{},q=nval(row.querySelector('[data-sec="questions"]')?.value),w=nval(row.querySelector('[data-sec="pointsPerQuestion"]')?.value),p=nval(row.querySelector('[data-sec="totalPoints"]')?.value),mn=nval(row.querySelector('[data-sec="minimum"]')?.value),kind=row.dataset.minKind||'points',label=row.querySelector('[data-sec="label"]')?.value.trim()||old.label||('Componente '+(i+1)),next={...old,id:old.id||slugId(label)||('section-'+(i+1)),label,questions:q,pointsPerQuestion:w,totalPoints:p,mapGroups:Array.isArray(old.mapGroups)&&old.mapGroups.length?old.mapGroups:[label]};if(kind==='questions'){next.minimumQuestions=mn;next.minimumPoints=null;next.minimum=mn===null?null:{kind:'questions',value:mn,source:old.minimum?.source||'user-review'}}else{next.minimumPoints=mn;next.minimumQuestions=null;next.minimum=mn===null?null:{kind:'points',value:mn,source:old.minimum?.source||'user-review'}}return next}).filter(s=>s.label);
 const totalQuestions=sections.reduce((a,s)=>a+(Number(s.questions)||0),0),totalPoints=sections.reduce((a,s)=>a+(Number(s.totalPoints)||0),0);
 if(totalPoints>0)sections=sections.map(s=>({...s,planWeight:Math.round((Number(s.totalPoints)||0)*10000/totalPoints)/100,planWeightSource:'calculated'}));
 const oldContent=Array.isArray(base.content)?base.content:[],contentRows=[...document.querySelectorAll('[data-review-content]')],content=contentRows.length?contentRows.map((row,i)=>{const sourceIndex=Number(row.dataset.sourceIndex),old=sourceIndex>=0?(oldContent[sourceIndex]||{}):{};return{...old,label:row.querySelector('[data-content="label"]')?.value.trim()||old.label||('Conteúdo '+(i+1)),text:row.querySelector('[data-content="text"]')?.value.trim()||''}}).filter(x=>x.label||x.text):oldContent;
 const schedule=scheduleOf(base),oldSchema=base.schema||{},oldStages=oldSchema.stages||base.stages||[],oldObjective=oldStages.find(s=>s?.type==='objective')||null,character=$('rwCharacter')?$('rwCharacter').value.trim():(oldObjective?.character||''),answerModel=$('rwAnswerModel')?.value||oldObjective?.answerModel||'',alternatives=answerModel==='true-false'?2:($('rwAlternatives')?nval($('rwAlternatives').value):(oldObjective?.alternatives??null)),scoringRuleRaw=$('rwScoringRule')?$('rwScoringRule').value.trim():(oldObjective?.scoringRuleRaw||''),minimumValue=$('rwMinimum')?nval($('rwMinimum').value):(oldObjective?.minimum?.value??null),minimumKind=$('rwMinimumKind')?.value||oldObjective?.minimum?.kind||'points',minimum=$('rwMinimum')?(minimumValue===null?null:{...(oldObjective?.minimum||{}),kind:minimumKind,value:minimumValue,label:minimumLabel(minimumKind,minimumValue)}):(oldObjective?.minimum||null);
 const objectiveNeeded=!!oldObjective||sections.length>0||!!examDate||durationMinutes!==null,objective=objectiveNeeded?{...(oldObjective||{}),id:oldObjective?.id||'objective',type:'objective',label:oldObjective?.label||'Prova Objetiva',planningMode:oldObjective?.planningMode||'weighted-sections',character,date:examDate||oldObjective?.date||'',durationMinutes,totalQuestions:sections.length?(totalQuestions||null):(oldObjective?.totalQuestions??null),totalPoints:sections.length?(totalPoints||null):(oldObjective?.totalPoints??null),answerModel,alternatives,scoringModel:oldObjective?.scoringModel||(answerModel?'standard':''),scoringRuleRaw,minimum,sections}:null;
 const stages=objective?[objective]:[],schema={...oldSchema,board,organization,position,notice,examDate:{...(oldSchema.examDate||{}),date:examDate||oldSchema.examDate?.date||''},stages,schedule,content};
 return{...base,title,organization,position,board,city,notice,examDate,note,durationMinutes,sections,stages,schedule,content,schema}
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
  const year=String(d.examDate||d.notice||new Date().getFullYear()).match(/20\d{2}/)?.[0]||String(new Date().getFullYear()),base=contestBaseId(d,year)||('concurso-'+Date.now());
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
    const place=placeParts(d.city,d.uf);schema={...sourceSchema,id,contestId:id,status:'reviewed',board:d.board||sourceSchema.board||'',organization:d.organization||sourceSchema.organization||'',position:d.position||sourceSchema.position||'',positionCode:d.positionCode||sourceSchema.positionCode||'',city:place.city||sourceSchema.city||'',cityName:place.cityName||sourceSchema.cityName||'',uf:place.uf||sourceSchema.uf||'',notice:d.notice||sourceSchema.notice||'',examDate:{...(sourceSchema.examDate||{}),date:d.examDate||sourceSchema.examDate?.date||''},stages:d.stages||sourceSchema.stages||[],schedule:d.schedule||sourceSchema.schedule||[],content:d.content||sourceSchema.content||[],documents:docs,source:state.mode==='auto'?'pdf-import':'user',reviewedAt:createdAt};
    D.saveExamSchema(id,schema);
   }
   if(fileMeta)D.upsertContestFile(id,fileMeta);
   const place=placeParts(d.city,d.uf),contest={id,title:d.title,organization:d.organization||d.title,position:d.position,positionCode:d.positionCode||'',board:d.board||'',notice:d.notice||'',city:place.city,cityName:place.cityName,uf:place.uf,examDate:d.examDate||'',examDateStatus:d.examDateStatus||schema?.examDate?.status||'',status:'active',edital:fileId||'',examSchemaId:schema?id:'',note:d.note||'',createdAt:createdDay,source:state.mode==='auto'?'pdf-import':'user',importedEdict:!!fileMeta};
   const studyBlueprint=schema?window.PLANO_ARQ_STUDY_BLUEPRINT?.buildAndSave?.(id,schema,contest):null;
   if(studyBlueprint)contest.studyBlueprint={key:'planoarq:study-blueprint::'+id,maps:studyBlueprint.summary?.maps||0,topics:studyBlueprint.summary?.topics||0,coveragePct:studyBlueprint.summary?.coveragePct||0};
   D.saveContest(contest);
   D.saveImportDraft?.(id,{...d,contestId:id,fileId,createdAt,source:contest.source});
   localStorage.setItem('planoarq:active-contest:v1',id);close();toast(studyBlueprint?'Concurso criado e estrutura de estudos preparada.':'Novo concurso criado.');location.href='edital.html?contest='+encodeURIComponent(id)
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