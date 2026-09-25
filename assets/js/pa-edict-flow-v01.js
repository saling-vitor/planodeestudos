(()=>{
'use strict';
const VERSION='1.0';
function analysisHtml(){return'<div class="review-section"><div class="review-section-head"><h3>Analisando edital</h3><span id="edictProgressMeta">Preparando PDF</span></div><div class="analysis-list"><div class="analysis-row done" data-a="file"><b>Arquivo carregado</b><span>✓</span></div><div class="analysis-row" data-a="text"><b>Texto do PDF</b><span>○</span></div><div class="analysis-row" data-a="contest"><b>Concurso e cargos</b><span>○</span></div><div class="analysis-row" data-a="exam"><b>Estrutura da prova</b><span>○</span></div><div class="analysis-row" data-a="content"><b>Conteúdo e cronograma</b><span>○</span></div></div></div>'}
function setAnalysis(key,state,label){const row=document.querySelector('[data-a="'+key+'"]');if(row){row.classList.toggle('done',state==='done');row.classList.toggle('active',state==='active');const s=row.querySelector('span');if(s)s.textContent=state==='done'?'✓':state==='active'?'→':'○'}const m=document.getElementById('edictProgressMeta');if(label&&m)m.textContent=label}
function chooseCargo(list){
 return new Promise(resolve=>{
  const p=document.getElementById('cargoPanel');p.hidden=false;
  p.innerHTML='<div class="review-section"><div class="review-section-head"><h3>Qual cargo você deseja preparar?</h3><span>'+list.length+' cargos identificados</span></div><div class="cargo-list">'+list.map((c,i)=>'<label class="cargo-choice"><input type="radio" name="edictCargo" value="'+i+'"><span><b>'+c.name+'</b><small>'+(c.code||'Cargo identificado')+'</small></span></label>').join('')+'</div><button type="button" class="primary-btn" id="confirmEdictCargo" disabled>Usar este cargo</button></div>';
  p.querySelectorAll('input[name="edictCargo"]').forEach(r=>r.onchange=()=>document.getElementById('confirmEdictCargo').disabled=false);
  document.getElementById('confirmEdictCargo').onclick=()=>{const r=p.querySelector('input[name="edictCargo"]:checked');if(!r)return;p.hidden=true;resolve(list[Number(r.value)])};
 });
}
async function analyzeIntoWizard(state){
 const W=window.PLANO_ARQ_CONTEST_IMPORT,Reader=window.PLANO_ARQ_PDF_READER,Parser=window.PLANO_ARQ_EDICT_PARSER,file=state.file;
 if(!file||!W||!Reader?.read||!Parser?.parseDocument){W?.showMessage?.('Não foi possível iniciar a análise automática.',true);return}
 document.getElementById('importChoice').hidden=true;
 const panel=document.getElementById('analysisPanel');panel.hidden=false;panel.innerHTML=analysisHtml();document.getElementById('nextStep').hidden=true;
 try{
  setAnalysis('text','active','Lendo texto nativo do PDF');
  const doc=await Reader.read(file,p=>{const el=document.getElementById('edictProgressMeta');if(!el)return;if(p.kind==='read')el.textContent='Lendo página '+p.current+' de '+p.total;else if(p.kind==='ocr-start')el.textContent='PDF digitalizado · preparando OCR';else if(p.kind==='ocr')el.textContent='OCR · página '+p.current+' de '+p.total});
  setAnalysis('text','done',doc.ocr?'Texto identificado por OCR':'Texto identificado');
  setAnalysis('contest','active','Identificando concurso e cargos');
  const preliminary=Parser.parseDocument(doc,null);let selected=preliminary.cargos.length===1?preliminary.cargos[0]:null;
  if(preliminary.cargos.length>1)selected=await chooseCargo(preliminary.cargos);
  if(!selected&&preliminary.cargos.length===0)throw new Error('Nenhum cargo foi identificado automaticamente. Continue manualmente e revise os dados.');
  setAnalysis('contest','done','Cargo selecionado');setAnalysis('exam','active','Extraindo prova e critérios');await new Promise(r=>setTimeout(r,0));
  const result=Parser.parseDocument(doc,selected);setAnalysis('exam','done','Estrutura da prova organizada');setAnalysis('content','done','Conteúdo e cronograma organizados');
  state.draft=result.draft;state.analysis=result;state.step=2;panel.hidden=true;W.renderReview();document.getElementById('nextStep').hidden=false;W.updateSteps();document.getElementById('reviewForm')?.scrollIntoView({block:'start'});
 }catch(e){
  panel.hidden=true;document.getElementById('cargoPanel').hidden=true;document.getElementById('importChoice').hidden=false;W.showMessage(e?.message||'Falha no processamento do edital.',true);
  const next=document.getElementById('nextStep');if(next)next.hidden=true;
 }
}
window.PLANO_ARQ_EDICT_FLOW={version:VERSION,analyzeIntoWizard,chooseCargo};
if(window.PLANO_ARQ_EDICT_PARSER)window.PLANO_ARQ_EDICT_PARSER.analyzeIntoWizard=analyzeIntoWizard;
})();