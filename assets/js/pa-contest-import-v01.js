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
function manualDraft(){return{title:'',organization:'',position:'Arquiteto',board:'',city:'',notice:'',examDate:'',note:'',source:'manual'}}
function renderReview(){
 const d=state.draft||manualDraft(),auto=state.mode==='auto',tag=auto?'review':'missing';
 $('reviewForm').innerHTML=`<div class="review-section"><div class="review-section-head"><h3>Identificação</h3><span>${auto?'Dados do edital editáveis':'Preenchimento manual'}</span></div><div class="form-grid">
 <div class="field full"><label>Concurso ${statusTag(tag)}</label><input id="rwTitle" value="${esc(d.title)}" placeholder="Nome curto do concurso"></div>
 <div class="field full"><label>Órgão / instituição ${statusTag(tag)}</label><input id="rwOrg" value="${esc(d.organization)}" placeholder="Órgão / instituição"></div>
 <div class="field"><label>Cargo ${statusTag(tag)}</label><input id="rwPosition" value="${esc(d.position)}" placeholder="Arquiteto"></div>
 <div class="field"><label>Banca ${statusTag(tag)}</label><input id="rwBoard" value="${esc(d.board)}" placeholder="Ex.: FUNDATEC"></div>
 <div class="field full"><label>Cidade / UF ${statusTag(tag)}</label><input id="rwCity" value="${esc(d.city)}" placeholder="Ex.: Porto Alegre/RS"></div>
 </div></div>
 <div class="review-section"><div class="review-section-head"><h3>Edital e prova</h3><span>Revise antes de criar</span></div><div class="form-grid">
 <div class="field"><label>Edital ${statusTag(tag)}</label><input id="rwNotice" value="${esc(d.notice)}" placeholder="Ex.: Edital 001/2027"></div>
 <div class="field"><label>Data da prova ${statusTag(tag)}</label><input id="rwExamDate" type="date" value="${esc(d.examDate)}"></div>
 <div class="field full"><label>Observação</label><input id="rwNote" value="${esc(d.note)}" placeholder="Opcional"></div>
 </div></div>`;
}
function collectReview(){return{...(state.draft||{}),title:$('rwTitle')?.value.trim()||'',organization:$('rwOrg')?.value.trim()||'',position:$('rwPosition')?.value.trim()||'',board:$('rwBoard')?.value.trim()||'',city:$('rwCity')?.value.trim()||'',notice:$('rwNotice')?.value.trim()||'',examDate:$('rwExamDate')?.value||'',note:$('rwNote')?.value.trim()||''}}
function renderSummary(){const d=collectReview();state.draft=d;$('summary').innerHTML=[['Concurso',d.title],['Órgão',d.organization],['Cargo',d.position],['Banca',d.board||'Não identificado'],['Local',d.city||'Não identificado'],['Edital',d.notice||'Não identificado'],['Prova',d.examDate||'Não definida']].map(([a,b])=>'<div class="summary-item"><span>'+esc(a)+'</span><b>'+esc(b)+'</b></div>').join('')}
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
  const d=state.draft||collectReview(),D=window.PLANO_ARQ_DATA;if(!D?.saveContest){toast('Dados do Portal ainda não carregaram.');return}
  const year=(d.examDate||String(d.notice||'').match(/20\d{2}/)?.[0]||new Date().getFullYear()),slug=v=>String(v||'').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),base=slug(d.id||`${d.title}-${d.position}-${year}`)||('concurso-'+Date.now());
  let id=base,n=2;while(D.contestById(id))id=base+'-'+n++;
  const contest={id,title:d.title,organization:d.organization||d.title,position:d.position,board:d.board||'',notice:d.notice||'',city:d.city||'',examDate:d.examDate||'',status:'active',edital:'',note:d.note||'',createdAt:new Date().toISOString().slice(0,10),source:state.mode==='auto'?'pdf-import':'user'};
  D.saveContest(contest);localStorage.setItem('planoarq:active-contest:v1',id);close();toast('Novo concurso criado.');location.href='edital.html?contest='+encodeURIComponent(id)
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